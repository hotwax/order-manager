import { DateTime } from 'luxon';
import { defineStore } from 'pinia';
import {
  createPartyEmail,
  createPartyPostalAddress,
  createPartyRelationship,
  createPartyTelecomNumber,
  ensurePartyRole,
  expirePartyContactMech,
  expirePartyRelationship,
  findShopifyDuplicateParties,
  indexCustomer,
  updatePartyEmail,
  updatePartyPostalAddress,
  updatePartyTelecomNumber,
  getCustomerCommunications,
  getCustomerOrdersFromSolr,
  getCustomerProfile,
  getCustomerRelationships,
  getCustomerReturns,
  getCustomerTasks,
  getOrderProgressStatuses,
  getPartyNames
} from '@/services/customer';
import { useSeedStore } from '@/store/seed';
import { useProductMaster } from '@/composables/useProductMaster';
import { commonUtil } from '@common';
import type {
  ContactSection,
  CustomerCommunicationSummary,
  CustomerOrderSummary,
  CustomerProfile,
  CustomerRelationship,
  CustomerReturnSummary,
  CustomerTaskSummary,
  CustomerTimelineEvent,
  LoadStatus,
  SourceEntry
} from '@/types/customer';

// Relationship taxonomy for splitting the Relationships card vs the Merged
// contacts (duplicate) card. Personal types are the blood-relative set seeded
// for the first build, plus the parent types.
const DUPLICATE_REL_TYPE = 'DUPLICATE';

const CONTACT_SECTION_DEFS: Array<{ key: string; label: string; contactMechTypeId: string }> = [
  { key: 'email', label: 'Email', contactMechTypeId: 'EMAIL_ADDRESS' },
  { key: 'phone', label: 'Phone', contactMechTypeId: 'TELECOM_NUMBER' },
  { key: 'address', label: 'Address', contactMechTypeId: 'POSTAL_ADDRESS' }
];

type SectionKey = 'profile' | 'recentOrders' | 'tasks' | 'unfillable' | 'returns' | 'communications';

interface CustomerDetailState {
  currentPartyId: string;
  profilesById: Record<string, SourceEntry<CustomerProfile | null>>;
  recentOrdersByPartyId: Record<string, SourceEntry<CustomerOrderSummary[]>>;
  tasksByPartyId: Record<string, SourceEntry<CustomerTaskSummary[]>>;
  unfillableByPartyId: Record<string, SourceEntry<CustomerOrderSummary[]>>;
  returnsByPartyId: Record<string, SourceEntry<CustomerReturnSummary[]>>;
  communicationsByPartyId: Record<string, SourceEntry<CustomerCommunicationSummary[]>>;
  relationshipsByPartyId: Record<string, SourceEntry<CustomerRelationship[]>>;
  mergableDuplicatesByPartyId: Record<string, Array<{ partyId: string; name: string }>>;
  lifetimeByPartyId: Record<string, { orders: number; value: number; currencyUom: string; firstOrderDate: string }>;
  partyNamesById: Record<string, string>;
}

function newSource<T>(payload: T): SourceEntry<T> {
  return { payload, status: 'idle', loadedAt: '', error: '' };
}

function contactDisplay(contactMech: CustomerProfile['contactMechs'][number]): string {
  if (contactMech.contactMechTypeId === 'TELECOM_NUMBER' && contactMech.telecomNumber) {
    const { countryCode, areaCode, contactNumber } = contactMech.telecomNumber;
    return [countryCode, areaCode, contactNumber].filter(Boolean).join(' ').trim() || contactMech.infoString;
  }
  if (contactMech.contactMechTypeId === 'POSTAL_ADDRESS' && contactMech.postalAddress) {
    const address = contactMech.postalAddress;
    return [
      address.address1,
      address.address2,
      [address.city, address.stateProvinceGeoId, address.postalCode].filter(Boolean).join(', '),
      address.countryGeoId
    ].filter(Boolean).join(', ');
  }
  return contactMech.infoString;
}

function isActiveThru(thruDate?: string): boolean {
  if (!thruDate) return true;
  const millis = Number(thruDate);
  return Number.isFinite(millis) ? millis > Date.now() : true;
}

function isContactActive(fromDate?: string, thruDate?: string): boolean {
  const now = Date.now();
  if (fromDate) {
    const from = Number(fromDate);
    if (Number.isFinite(from) && from > now) return false;
  }
  return isActiveThru(thruDate);
}

// Order/ship-group progress: target = (#statuses x 100); current = sum of each status's
// StatusItem.statusAge. Robust to whatever statuses exist (order items now, shipment items
// when the order payload includes them). Capped at 1.
function computeProgress(statusIds: string[], statusAge: (statusId: string) => number): number {
  if (!statusIds.length) return 0;
  const target = statusIds.length * 100;
  const current = statusIds.reduce((sum, statusId) => sum + statusAge(statusId), 0);
  return target ? Math.min(current / target, 1) : 0;
}

// Color the progress bar by the least-progressed (min statusAge) status via the shared
// status-color map: all complete -> success, in progress -> primary/medium, cancelled -> danger.
function progressStatusColor(statusIds: string[], statusAge: (statusId: string) => number): string {
  if (!statusIds.length) return 'medium';
  const rep = statusIds.reduce((min, statusId) => (statusAge(statusId) < statusAge(min) ? statusId : min), statusIds[0]);
  return commonUtil.getStatusColor(rep);
}

function relationshipKey(relationship: CustomerRelationship): string {
  return [
    relationship.partyIdFrom,
    relationship.partyIdTo,
    relationship.roleTypeIdFrom,
    relationship.roleTypeIdTo,
    relationship.fromDate
  ].join('|');
}

function allRelationships(profile: CustomerProfile | null, loadedRelationships: CustomerRelationship[] = []): CustomerRelationship[] {
  const relationships = [
    ...(profile?.relationshipsFrom || []),
    ...(profile?.relationshipsTo || []),
    ...loadedRelationships
  ];
  const seen = new Set<string>();

  return relationships.filter((relationship) => {
    const key = relationshipKey(relationship);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function triggerCustomerIndex(partyId: string): void {
  indexCustomer(partyId).catch((e) => console.error(`[customer index] failed for ${partyId}:`, e));
}

export const useCustomerStore = defineStore('customerDetail', {
  state: (): CustomerDetailState => ({
    currentPartyId: '',
    profilesById: {},
    recentOrdersByPartyId: {},
    tasksByPartyId: {},
    unfillableByPartyId: {},
    returnsByPartyId: {},
    communicationsByPartyId: {},
    relationshipsByPartyId: {},
    mergableDuplicatesByPartyId: {},
    lifetimeByPartyId: {},
    partyNamesById: {}
  }),

  getters: {
    currentCustomer(state): CustomerProfile | null {
      return state.profilesById[state.currentPartyId]?.payload || null;
    },
    getCustomer: (state) => (partyId: string): CustomerProfile | null =>
      state.profilesById[partyId]?.payload || null,

    lifetimeValue: (state) => (partyId: string): number =>
      state.lifetimeByPartyId[partyId]?.value ?? 0,
    lifetimeOrders: (state) => (partyId: string): number =>
      state.lifetimeByPartyId[partyId]?.orders ?? 0,
    lifetimeCurrency: (state) => (partyId: string): string =>
      state.lifetimeByPartyId[partyId]?.currencyUom || 'USD',

    // "Customer since": prefer the party's createdDate; fall back to the earliest
    // order date, because Shopify-imported customers have no Party.createdDate.
    customerSince: (state) => (partyId: string): string =>
      state.profilesById[partyId]?.payload?.createdStamp
      || state.lifetimeByPartyId[partyId]?.firstOrderDate
      || '',

    sectionStatus: (state) => (partyId: string, section: SectionKey): LoadStatus => {
      const buckets: Record<SectionKey, Record<string, SourceEntry<any>>> = {
        profile: state.profilesById,
        recentOrders: state.recentOrdersByPartyId,
        tasks: state.tasksByPartyId,
        unfillable: state.unfillableByPartyId,
        returns: state.returnsByPartyId,
        communications: state.communicationsByPartyId
      };
      return buckets[section]?.[partyId]?.status || 'idle';
    },
    sectionError: (state) => (partyId: string, section: SectionKey): string => {
      const buckets: Record<SectionKey, Record<string, SourceEntry<any>>> = {
        profile: state.profilesById,
        recentOrders: state.recentOrdersByPartyId,
        tasks: state.tasksByPartyId,
        unfillable: state.unfillableByPartyId,
        returns: state.returnsByPartyId,
        communications: state.communicationsByPartyId
      };
      return buckets[section]?.[partyId]?.error || '';
    },

    // Contact card: one section per type (Email / Phone / Address) with active values.
    contactSections: (state) => (partyId: string): ContactSection[] => {
      const profile = state.profilesById[partyId]?.payload || null;
      const contactMechs = profile?.contactMechs || [];
      return CONTACT_SECTION_DEFS.map((def) => ({
        key: def.key,
        label: def.label,
        contactMechTypeId: def.contactMechTypeId,
        values: contactMechs
          .filter((contactMech) => contactMech.contactMechTypeId === def.contactMechTypeId && isContactActive(contactMech.fromDate, contactMech.thruDate))
          .sort((a, b) => (Number(b.fromDate) || 0) - (Number(a.fromDate) || 0))
          .map((contactMech) => ({
            display: contactDisplay(contactMech),
            contactMechId: contactMech.contactMechId,
            contactMechTypeId: contactMech.contactMechTypeId,
            contactMechPurposeTypeId: contactMech.contactMechPurposeTypeId,
            active: isActiveThru(contactMech.thruDate)
          }))
      }));
    },

    // Relationships card: all relationships except DUPLICATE (those go to the Merged contacts card).
    personalRelationships: (state) => (partyId: string) => {
      const relationships = allRelationships(
        state.profilesById[partyId]?.payload || null,
        state.relationshipsByPartyId[partyId]?.payload || []
      );
      return relationships
        .filter((relationship) => relationship.partyRelationshipTypeId !== DUPLICATE_REL_TYPE)
        .map((relationship) => {
          const isFrom = relationship.partyIdFrom === partyId;
          const relatedId = isFrom ? relationship.partyIdTo : relationship.partyIdFrom;
          return {
            relatedPartyId: relatedId,
            relatedPartyName: state.partyNamesById[relatedId] || (isFrom ? relationship.toPartyName : relationship.fromPartyName) || relatedId,
            relationshipName: relationship.relationshipName,
            partyRelationshipTypeId: relationship.partyRelationshipTypeId,
            fromDate: relationship.fromDate,
            thruDate: relationship.thruDate,
            active: isActiveThru(relationship.thruDate),
            key: relationshipKey(relationship),
            keyFields: {
              partyIdFrom: relationship.partyIdFrom,
              partyIdTo: relationship.partyIdTo,
              roleTypeIdFrom: relationship.roleTypeIdFrom,
              roleTypeIdTo: relationship.roleTypeIdTo,
              fromDate: relationship.fromDate
            }
          };
        });
    },

    // Merged contacts card: DUPLICATE relationship rows (duplicate -> canonical).
    duplicateRelationships: (state) => (partyId: string) => {
      const relationships = allRelationships(
        state.profilesById[partyId]?.payload || null,
        state.relationshipsByPartyId[partyId]?.payload || []
      );
      return relationships
        .filter((relationship) => relationship.partyRelationshipTypeId === DUPLICATE_REL_TYPE)
        .map((relationship) => ({
          duplicatePartyId: relationship.partyIdFrom,
          canonicalPartyId: relationship.partyIdTo,
          duplicatePartyName: state.partyNamesById[relationship.partyIdFrom] || relationship.fromPartyName || relationship.partyIdFrom,
          canonicalPartyName: state.partyNamesById[relationship.partyIdTo] || relationship.toPartyName || relationship.partyIdTo,
          isCanonical: relationship.partyIdTo === partyId,
          fromDate: relationship.fromDate,
          thruDate: relationship.thruDate,
          active: isActiveThru(relationship.thruDate),
          key: relationshipKey(relationship),
          keyFields: {
            partyIdFrom: relationship.partyIdFrom,
            partyIdTo: relationship.partyIdTo,
            roleTypeIdFrom: relationship.roleTypeIdFrom,
            roleTypeIdTo: relationship.roleTypeIdTo,
            fromDate: relationship.fromDate
          }
        }));
    },

    customerTimeline: (state) => (partyId: string): CustomerTimelineEvent[] => {
      const profile = state.profilesById[partyId]?.payload || null;
      if (!profile) return [];
      const events: CustomerTimelineEvent[] = [];
      if (profile.createdStamp) {
        events.push({ id: 'created', type: 'created', label: `Created by ${profile.createdByUserLogin}`, at: profile.createdStamp, sourceId: profile.id });
      }
      return events;
    },

    recentOrders: (state) => (partyId: string): CustomerOrderSummary[] =>
      state.recentOrdersByPartyId[partyId]?.payload || [],
    openTasks: (state) => (partyId: string): CustomerTaskSummary[] =>
      state.tasksByPartyId[partyId]?.payload || [],
    unfillableOrders: (state) => (partyId: string): CustomerOrderSummary[] =>
      state.unfillableByPartyId[partyId]?.payload || [],
    returns: (state) => (partyId: string): CustomerReturnSummary[] =>
      state.returnsByPartyId[partyId]?.payload || [],
    communications: (state) => (partyId: string): CustomerCommunicationSummary[] =>
      state.communicationsByPartyId[partyId]?.payload || [],

    mergableDuplicates: (state) => (partyId: string): Array<{ partyId: string; name: string }> =>
      state.mergableDuplicatesByPartyId[partyId] || []
  },

  actions: {
    setCurrentCustomer(partyId: string) {
      this.currentPartyId = partyId;
      return this.loadCustomerDashboard(partyId);
    },

    // Prefetch on detail route mount. Profile failure fails the page; section
    // failures (orders/tasks) are isolated to their own source bucket.
    async loadCustomerDashboard(partyId: string, force = false) {
      const seed = useSeedStore();
      await Promise.allSettled([
        this.loadCustomerProfile(partyId, force),
        this.loadCustomerOrders(partyId, force),
        this.loadCustomerTasks(partyId, force),
        (seed as any).loadPartyRelationshipTypes()
      ]);
      await (this as any).loadMergableDuplicates(partyId);
    },

    async loadCustomerProfile(partyId: string, force = false) {
      if (!partyId) return;
      const existing = this.profilesById[partyId];
      if (existing?.status === 'loaded' && !force) return;

      this.profilesById[partyId] = { ...(existing || newSource<CustomerProfile | null>(null)), status: 'loading', error: '' };
      try {
        const profile = await getCustomerProfile(partyId);
        this.profilesById[partyId] = {
          payload: profile,
          status: 'loaded',
          loadedAt: new Date().toISOString(),
          error: ''
        };
        const allRels = [...(profile.relationshipsFrom || []), ...(profile.relationshipsTo || [])];
        if (allRels.length) await (this as any).resolveRelationshipPartyNames(partyId, allRels);
      } catch (error: any) {
        this.profilesById[partyId] = {
          payload: null,
          status: 'error',
          loadedAt: '',
          error: error?.message || 'Failed to load customer'
        };
      }
    },

    async loadCustomerOrders(partyId: string, force = false) {
      if (!partyId) return;
      const existing = this.recentOrdersByPartyId[partyId];
      if (existing?.status === 'loaded' && !force) return;

      this.recentOrdersByPartyId[partyId] = { ...(existing || newSource<CustomerOrderSummary[]>([])), status: 'loading', error: '' };
      try {
        const result = await getCustomerOrdersFromSolr(partyId, { pageSize: 100 });

        // Real progress for the rendered cards: hydrate each via the official get-order API
        // (not Solr) and compute from order-item (+ shipment-item) status ages.
        const seed = useSeedStore();
        const displayCount = 12;
        await Promise.all(result.orders.slice(0, displayCount).map(async (order) => {
          try {
            const statusIds = await getOrderProgressStatuses(order.orderId);
            if (statusIds.length) {
              order.progressValue = computeProgress(statusIds, (statusId) => seed.statusAge(statusId));
              order.progressLabel = `${Math.round(order.progressValue * 100)}% complete`;
              order.progressColor = progressStatusColor(statusIds, (statusId) => seed.statusAge(statusId));
            }
          } catch {
            // keep the Solr status fallback on a per-order failure
          }
        }));

        this.recentOrdersByPartyId[partyId] = {
          payload: result.orders,
          status: 'loaded',
          loadedAt: new Date().toISOString(),
          error: '',
          total: result.lifetimeOrders
        };
        const orderProductIds = result.orders.flatMap((o) => o.items.map((item) => item.productId)).filter(Boolean);
        if (orderProductIds.length) useProductMaster().prefetch(orderProductIds).catch(() => {});
        this.lifetimeByPartyId[partyId] = {
          orders: result.lifetimeOrders,
          value: result.lifetimeValue,
          currencyUom: result.currencyUom,
          firstOrderDate: result.firstOrderDate
        };
      } catch (error: any) {
        this.recentOrdersByPartyId[partyId] = {
          payload: [],
          status: 'error',
          loadedAt: '',
          error: error?.message || 'Failed to load orders'
        };
      }
    },

    async loadCustomerTasks(partyId: string, force = false) {
      if (!partyId) return;
      const existing = this.tasksByPartyId[partyId];
      if (existing?.status === 'loaded' && !force) return;

      this.tasksByPartyId[partyId] = { ...(existing || newSource<CustomerTaskSummary[]>([])), status: 'loading', error: '' };
      try {
        const tasks = await getCustomerTasks(partyId, { statusId: 'ORD_HOLD_OPEN' });
        this.tasksByPartyId[partyId] = {
          payload: tasks,
          status: 'loaded',
          loadedAt: new Date().toISOString(),
          error: '',
          total: tasks.length
        };
      } catch (error: any) {
        this.tasksByPartyId[partyId] = {
          payload: [],
          status: 'error',
          loadedAt: '',
          error: error?.message || 'Failed to load tasks'
        };
      }
    },

    async loadCustomerReturns(partyId: string, force = false) {
      if (!partyId) return;
      const existing = this.returnsByPartyId[partyId];
      if (existing?.status === 'loaded' && !force) return;

      this.returnsByPartyId[partyId] = { ...(existing || newSource<CustomerReturnSummary[]>([])), status: 'loading', error: '' };
      try {
        const returns = await getCustomerReturns(partyId);
        this.returnsByPartyId[partyId] = {
          payload: returns,
          status: 'loaded',
          loadedAt: new Date().toISOString(),
          error: '',
          total: returns.length
        };
        const returnProductIds = returns.flatMap((r) => r.items.map((item) => item.productId)).filter(Boolean) as string[];
        if (returnProductIds.length) useProductMaster().prefetch(returnProductIds).catch(() => {});
      } catch (error: any) {
        this.returnsByPartyId[partyId] = {
          payload: [],
          status: 'error',
          loadedAt: '',
          error: error?.message || 'Failed to load returns'
        };
      }
    },

    async loadCustomerCommunications(partyId: string, force = false) {
      if (!partyId) return;
      const existing = this.communicationsByPartyId[partyId];
      if (existing?.status === 'loaded' && !force) return;

      this.communicationsByPartyId[partyId] = { ...(existing || newSource<CustomerCommunicationSummary[]>([])), status: 'loading', error: '' };
      try {
        const comms = await getCustomerCommunications(partyId);
        this.communicationsByPartyId[partyId] = {
          payload: comms,
          status: 'loaded',
          loadedAt: new Date().toISOString(),
          error: '',
          total: comms.length
        };
      } catch (error: any) {
        this.communicationsByPartyId[partyId] = {
          payload: [],
          status: 'error',
          loadedAt: '',
          error: error?.message || 'Failed to load communications'
        };
      }
    },

    async resolveRelationshipPartyNames(currentPartyId: string, relationships: CustomerRelationship[]) {
      const missing = [...new Set(
        relationships.flatMap((r) => [r.partyIdFrom, r.partyIdTo])
          .filter((id) => id && id !== currentPartyId && !this.partyNamesById[id])
      )];
      if (!missing.length) return;
      try {
        const results = await getPartyNames(missing);
        results.forEach((result) => {
          if (result.partyId) this.partyNamesById[result.partyId] = result.name;
        });
      } catch {
        // name resolution is best-effort; IDs will show as fallback
      }
    },

    async loadCustomerRelationships(partyId: string, force = false) {
      if (!partyId) return;
      const existing = this.relationshipsByPartyId[partyId];
      if (existing?.status === 'loaded' && !force) return;

      this.relationshipsByPartyId[partyId] = { ...(existing || newSource<CustomerRelationship[]>([])), status: 'loading', error: '' };
      try {
        const relationships = await getCustomerRelationships(partyId);
        this.relationshipsByPartyId[partyId] = {
          payload: relationships,
          status: 'loaded',
          loadedAt: new Date().toISOString(),
          error: '',
          total: relationships.length
        };
        await this.resolveRelationshipPartyNames(partyId, relationships);
      } catch (error: any) {
        this.relationshipsByPartyId[partyId] = {
          payload: [],
          status: 'error',
          loadedAt: '',
          error: error?.message || 'Failed to load relationships'
        };
      }
    },

    async addContact(partyId: string, contactMechTypeId: string, data: Record<string, string>) {
      // Optimistic update
      const profile = this.profilesById[partyId]?.payload;
      let infoString = data.infoString || '';
      if (profile) {
        if (contactMechTypeId === 'EMAIL_ADDRESS') {
          infoString = data.emailAddress || data.infoString;
        } else if (contactMechTypeId === 'TELECOM_NUMBER') {
          infoString = [data.countryCode ? `+${data.countryCode}` : '', data.areaCode, data.contactNumber].filter(Boolean).join(' ') || data.infoString;
        }
        profile.contactMechs.push({
          partyId,
          contactMechId: 'temp_' + Date.now(),
          contactMechTypeId,
          contactMechPurposeTypeId: data.contactMechPurposeTypeId || '',
          purposeTypeIds: data.contactMechPurposeTypeId ? [data.contactMechPurposeTypeId] : [],
          infoString,
          fromDate: Date.now().toString()
        });
      }

      if (contactMechTypeId === 'EMAIL_ADDRESS') {
        await createPartyEmail(partyId, data as any);
      } else if (contactMechTypeId === 'TELECOM_NUMBER') {
        await createPartyTelecomNumber(partyId, data as any);
      } else if (contactMechTypeId === 'POSTAL_ADDRESS') {
        await createPartyPostalAddress(partyId, data as any);
      }
      triggerCustomerIndex(partyId);

      // Poll for fresh data in background
      (async () => {
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          try {
            const freshProfile = await getCustomerProfile(partyId);
            const hasNew = freshProfile.contactMechs.some(c => c.infoString === infoString);
            if (hasNew || i === 4) {
              this.profilesById[partyId] = {
                payload: freshProfile,
                status: 'loaded',
                loadedAt: new Date().toISOString(),
                error: ''
              };
              break;
            }
          } catch (e) {
            // ignore
          }
        }
      })();
    },

    async updateContact(partyId: string, contactMechTypeId: string, contactMechId: string, data: Record<string, string>) {
      // Optimistic update
      const profile = this.profilesById[partyId]?.payload;
      if (profile) {
        const contact = profile.contactMechs.find(c => c.contactMechId === contactMechId);
        if (contact) {
          if (contactMechTypeId === 'EMAIL_ADDRESS') {
            contact.infoString = data.emailAddress || data.infoString;
          } else if (contactMechTypeId === 'TELECOM_NUMBER') {
            const countryCode = data.countryCode || '';
            const areaCode = data.areaCode || '';
            const contactNumber = data.contactNumber || '';
            contact.telecomNumber = { ...contact.telecomNumber, countryCode, areaCode, contactNumber };
            contact.infoString = [countryCode ? `+${countryCode}` : '', areaCode, contactNumber].filter(Boolean).join(' ') || data.infoString;
          } else if (contactMechTypeId === 'POSTAL_ADDRESS') {
            contact.postalAddress = { ...contact.postalAddress, ...data } as any;
          }
        }
      }

      if (contactMechTypeId === 'EMAIL_ADDRESS') {
        await updatePartyEmail(partyId, contactMechId, data as any);
      } else if (contactMechTypeId === 'TELECOM_NUMBER') {
        await updatePartyTelecomNumber(partyId, contactMechId, data as any);
      } else if (contactMechTypeId === 'POSTAL_ADDRESS') {
        await updatePartyPostalAddress(partyId, contactMechId, data as any);
      }
      triggerCustomerIndex(partyId);

      // Poll for fresh data in background
      (async () => {
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          try {
            const freshProfile = await getCustomerProfile(partyId);
            const oldContact = freshProfile.contactMechs.find(c => c.contactMechId === contactMechId);
            const isFresh = !oldContact || (oldContact.thruDate && Number(oldContact.thruDate) <= Date.now());
            if (isFresh || i === 4) {
              this.profilesById[partyId] = {
                payload: freshProfile,
                status: 'loaded',
                loadedAt: new Date().toISOString(),
                error: ''
              };
              break;
            }
          } catch (e) {
            // ignore
          }
        }
      })();
    },

    async expireContact(partyId: string, contactMechId: string) {
      // Optimistic update
      const profile = this.profilesById[partyId]?.payload;
      if (profile) {
        const contact = profile.contactMechs.find(c => c.contactMechId === contactMechId);
        if (contact) {
          contact.thruDate = Date.now().toString();
        }
      }

      await expirePartyContactMech(partyId, contactMechId);
      triggerCustomerIndex(partyId);

      // Poll for fresh data in background
      (async () => {
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          try {
            const freshProfile = await getCustomerProfile(partyId);
            const oldContact = freshProfile.contactMechs.find(c => c.contactMechId === contactMechId);
            if (!oldContact || (oldContact.thruDate && Number(oldContact.thruDate) <= Date.now()) || i === 4) {
              this.profilesById[partyId] = {
                payload: freshProfile,
                status: 'loaded',
                loadedAt: new Date().toISOString(),
                error: ''
              };
              break;
            }
          } catch (e) {
            // ignore
          }
        }
      })();
    },

    async createRelationship(input: { partyIdFrom: string; partyIdTo: string; partyRelationshipTypeId: string; roleTypeIdFrom: string; roleTypeIdTo: string; fromDate: number; comments?: string }) {
      await Promise.all([
        ensurePartyRole(input.partyIdFrom, input.roleTypeIdFrom),
        ensurePartyRole(input.partyIdTo, input.roleTypeIdTo)
      ]);
      await createPartyRelationship(input);
      const partyId = this.currentPartyId || input.partyIdFrom;
      await Promise.all([
        this.loadCustomerProfile(partyId, true),
        this.loadCustomerRelationships(partyId, true)
      ]);
      triggerCustomerIndex(partyId);
    },

    async expireRelationship(key: { partyIdFrom: string; partyIdTo: string; roleTypeIdFrom: string; roleTypeIdTo: string; fromDate: string }, thruDate: number) {
      await expirePartyRelationship(key, thruDate);
      await Promise.all([
        this.loadCustomerProfile(this.currentPartyId, true),
        this.loadCustomerRelationships(this.currentPartyId, true)
      ]);
      triggerCustomerIndex(this.currentPartyId);
    },

    async loadMergableDuplicates(partyId: string) {
      if (!partyId) return;
      const profile = this.profilesById[partyId]?.payload;
      if (!profile) return;
      const shopifyId = profile.identifications.find((id) => id.partyIdentificationTypeId === 'SHOPIFY_CUST_ID');
      if (!shopifyId) return;

      // Build the set of parties already linked via an active DUPLICATE relationship
      // so we never surface them as merge candidates again.
      const loadedRelationships = this.relationshipsByPartyId[partyId]?.payload || [];
      const alreadyMergedIds = new Set(
        allRelationships(profile, loadedRelationships)
          .filter((r) => r.partyRelationshipTypeId === DUPLICATE_REL_TYPE && isActiveThru(r.thruDate))
          .flatMap((r) => [r.partyIdFrom, r.partyIdTo])
          .filter((id) => id !== partyId)
      );

      try {
        const candidates = await findShopifyDuplicateParties(partyId, shopifyId.idValue);
        this.mergableDuplicatesByPartyId[partyId] = candidates.filter((c) => !alreadyMergedIds.has(c.partyId));
      } catch {
        this.mergableDuplicatesByPartyId[partyId] = [];
      }
    },

    async mergeContact(currentPartyId: string, duplicatePartyId: string) {
      await Promise.all([
        ensurePartyRole(currentPartyId, 'CUSTOMER'),
        ensurePartyRole(duplicatePartyId, 'CUSTOMER')
      ]);
      await createPartyRelationship({
        partyIdFrom: duplicatePartyId,
        partyIdTo: currentPartyId,
        partyRelationshipTypeId: 'DUPLICATE',
        fromDate: DateTime.now().toMillis()
      });
      // Reload profile and relationships first so loadMergableDuplicates
      // sees the newly created relationship when filtering candidates.
      await Promise.all([
        this.loadCustomerProfile(currentPartyId, true),
        this.loadCustomerRelationships(currentPartyId, true)
      ]);
      await (this as any).loadMergableDuplicates(currentPartyId);
    },

    refreshCustomer(partyId: string) {
      return this.loadCustomerDashboard(partyId, true);
    }
  },

  // Customer detail is PII composed from several freshness-sensitive sources;
  // it should behave like orderDetail, not the persisted search stores.
  persist: false
});
