import { DateTime } from 'luxon';
import { defineStore } from 'pinia';
import { api, useSolrSearch, logger, translate } from '@common';
import {
  asList,
  buildCustomerOrdersPayload,
  buildCustomerSearchPayload,
  normalizeCustomerCommunication,
  normalizeCustomerProfile,
  normalizeCustomerRelationship,
  normalizeCustomerTask,
  orderProgressStatuses,
  partyNameRow,
  summarizeCustomerOrderGroup,
  type CustomerOrdersResult,
  type CustomerSearchParams,
  type CustomerSearchResult,
  type RelationshipInput,
  type RelationshipKey
} from '@/utils/customer';
import { toStringValue } from '@/utils/orderDocs';
import { useReturnsStore } from '@/store/returns';
import { refreshAfterMutation } from '@/db/appDbSync';
import type {
  ContactSection,
  CustomerCommunicationSummary,
  CustomerOrderSummary,
  CustomerProfile,
  CustomerRelationship,
  CustomerTaskSummary,
  CustomerTimelineEvent,
  LoadStatus,
  SourceEntry
} from '@/types/customer';
import type { ReturnSummary } from '@/types/returns';
import type { Customer } from '@/types/order';

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
  returnsByPartyId: Record<string, SourceEntry<ReturnSummary[]>>;
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
  useCustomerStore().indexCustomer(partyId).catch((e) => logger.error(`[customer index] failed for ${partyId}:`, e));
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
    openTasksHasMore: (state) => (partyId: string): boolean =>
      state.tasksByPartyId[partyId]?.hasMore ?? false,
    unfillableOrders: (state) => (partyId: string): CustomerOrderSummary[] =>
      state.unfillableByPartyId[partyId]?.payload || [],
    returns: (state) => (partyId: string): ReturnSummary[] =>
      state.returnsByPartyId[partyId]?.payload || [],
    communications: (state) => (partyId: string): CustomerCommunicationSummary[] =>
      state.communicationsByPartyId[partyId]?.payload || [],

    mergableDuplicates: (state) => (partyId: string): Array<{ partyId: string; name: string }> =>
      state.mergableDuplicatesByPartyId[partyId] || []
  },

  actions: {
    async searchCustomers(params: CustomerSearchParams = {}): Promise<CustomerSearchResult> {
      const resp = await useSolrSearch().runSolrQuery(buildCustomerSearchPayload(params));
      return {
        customers: resp?.data?.response?.docs ?? [],
        total: resp?.data?.response?.numFound ?? 0
      };
    },

    async getPartyNames(partyIds: string[]): Promise<Array<{ partyId: string; name: string; partyTypeId: string }>> {
      if (!partyIds.length) return [];
      const response = await api({
        url: 'oms/parties',
        method: 'get',
        params: { partyId_op: 'in', partyId: partyIds.join(',') }
      });
      return asList(response.data).map(partyNameRow);
    },

    /**
     * Customer 360 profile read. Calls GET /oms/customers/{partyId} (the Party
     * `customerDetail` entity master) and flattens the nested master into the
     * CustomerProfile shape the detail store/getters consume. Bounded profile only -
     * orders, tasks, returns, and communications are separate paginated calls.
     */
    async getCustomerProfile(partyId: string): Promise<CustomerProfile> {
      const response = await api({
        url: `oms/customers/${partyId}`,
        method: 'get'
      });
      return normalizeCustomerProfile(response.data, partyId);
    },

    /**
     * Customer orders + lifetime aggregates from Solr (enterpriseSearch core,
     * docType:ORDER, customerPartyId). Goes through the backend-aware useSolrSearch
     * (Moqui search/query vs OFBiz runSolrQuery). Order docs
     * are per-item, so we group by orderId. We PAGE THROUGH every group so the lifetime
     * value/count are accurate regardless of order volume (ngroups = order count; one
     * grandTotal per group summed = lifetime value). A Solr stats/facet sum can replace
     * this loop later for performance.
     */
    async getCustomerOrdersFromSolr(partyId: string, params: { pageSize?: number } = {}): Promise<CustomerOrdersResult> {
      const { runSolrQuery } = useSolrSearch();
      const pageSize = params.pageSize ?? 200;
      const maxPages = 50; // safety cap (~10k orders)

      const orders: CustomerOrderSummary[] = [];
      let lifetimeOrders = 0;
      let currencyUom = 'USD';

      for (let page = 0; page < maxPages; page++) {
        const response = await runSolrQuery(buildCustomerOrdersPayload(partyId, page, pageSize));

        const grouped = response.data?.grouped?.orderId;
        const groups: any[] = grouped?.groups || [];
        lifetimeOrders = Number(grouped?.ngroups ?? (page * pageSize + groups.length));
        if (!groups.length) break;

        groups.forEach((group) => orders.push(summarizeCustomerOrderGroup(group)));

        if (orders.length >= lifetimeOrders) break;
      }

      // Fetch grandTotal and currencyUom from the Orders REST API for all orders,
      // since grandTotal is not indexed in the Solr ORDER doc.
      let lifetimeValue = 0;
      if (orders.length) {
        try {
          const orderIds = orders.map((o) => o.orderId).join(',');
          const ordersRes = await api({
            url: 'oms/orders',
            method: 'get',
            params: { orderId_op: 'in', orderId: orderIds, pageSize: orders.length }
          });
          const orderHeaders: any[] = asList(ordersRes.data);
          const totalsById: Record<string, { grandTotal: number; currencyUom: string }> = {};
          orderHeaders.forEach((h: any) => {
            const id = toStringValue(h.orderId);
            if (id) totalsById[id] = { grandTotal: Number(h.grandTotal || 0), currencyUom: toStringValue(h.currencyUom) || 'USD' };
          });
          orders.forEach((order) => {
            const totals = totalsById[order.orderId];
            if (totals) {
              order.grandTotal = totals.grandTotal;
              currencyUom = totals.currencyUom || currencyUom;
            }
            lifetimeValue += order.grandTotal;
          });
        } catch {
          // Best-effort — lifetime value stays 0 if the batch call fails
        }
      }

      // Earliest order date (orders are sorted desc) - "customer since" fallback.
      const firstOrderDate = orders.reduce((min, order) => {
        if (!order.orderDate) return min;
        return !min || order.orderDate < min ? order.orderDate : min;
      }, '');

      return { orders, lifetimeOrders, lifetimeValue, currencyUom, firstOrderDate };
    },

    /**
     * Current statuses that drive an order's progress, hydrated from the official get-order API
     * (GET oms/orders?orderId=... - the same path the order detail page uses), NOT from Solr.
     * The caller maps each status to StatusItem.statusAge to compute the progress percentage.
     */
    async getOrderProgressStatuses(orderId: string): Promise<string[]> {
      const response = await api({ url: 'oms/orders', method: 'get', params: { orderId, dependentLevels: 1 } });
      return orderProgressStatuses(Array.isArray(response.data) ? response.data[0] : response.data);
    },

    /** Customer tasks via GET /oms/workEffortPartyAssignments (WorkEffortPartyDetail). */
    async getCustomerTasks(
      partyId: string,
      params: { taskStatusId?: string; pageSize?: number; pageIndex?: number; orderByField?: string } = {}
    ): Promise<CustomerTaskSummary[]> {
      const response = await api({
        url: 'oms/workEffortPartyAssignments',
        method: 'get',
        params: {
          partyId,
          roleTypeId: 'CUSTOMER',
          taskStatusId: params.taskStatusId,
          pageSize: params.pageSize ?? 20,
          pageIndex: params.pageIndex ?? 0,
          orderByField: params.orderByField
        }
      });
      return asList(response.data).map(normalizeCustomerTask);
    },

    /**
     * Customer relationships from the dedicated /oms/partyRelationships endpoint (both
     * directions, merged). Used instead of the Party master's nested relationshipsFrom/To
     * because relationship-based master finds are cached and miss newly-created rows; the
     * direct entity-list query stays fresh.
     */
    async getCustomerRelationships(partyId: string): Promise<CustomerRelationship[]> {
      const [fromRes, toRes] = await Promise.all([
        api({ url: 'oms/partyRelationships', method: 'get', params: { partyIdFrom: partyId } }),
        api({ url: 'oms/partyRelationships', method: 'get', params: { partyIdTo: partyId } })
      ]);

      const seen = new Set<string>();
      const merged: CustomerRelationship[] = [];
      [...asList(fromRes.data), ...asList(toRes.data)].forEach((row) => {
        const relationship = normalizeCustomerRelationship(row);
        const key = [relationship.partyIdFrom, relationship.partyIdTo, relationship.roleTypeIdFrom, relationship.roleTypeIdTo, relationship.fromDate].join('|');
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(relationship);
      });
      return merged;
    },

    async createPartyRelationship(input: RelationshipInput): Promise<void> {
      await api({
        url: 'oms/partyRelationships',
        method: 'post',
        data: {
          roleTypeIdFrom: 'CUSTOMER',
          roleTypeIdTo: 'CUSTOMER',
          ...input
        }
      });
    },

    async expirePartyRelationship(key: RelationshipKey, thruDate: number): Promise<void> {
      await api({
        url: 'oms/partyRelationships',
        method: 'put',
        data: { ...key, thruDate }
      });
    },

    async createPartyEmail(partyId: string, data: { infoString: string; contactMechPurposeTypeId?: string }): Promise<void> {
      await api({ url: `oms/customers/${partyId}/emails`, method: 'post', data: { partyId, ...data } });
    },

    async updatePartyEmail(partyId: string, contactMechId: string, data: { infoString: string; contactMechPurposeTypeId?: string }): Promise<void> {
      await api({ url: `oms/customers/${partyId}/emails`, method: 'put', data: { partyId, contactMechId, ...data } });
    },

    async createPartyTelecomNumber(partyId: string, data: { contactNumber: string; countryCode?: string; areaCode?: string; contactMechPurposeTypeId?: string }): Promise<void> {
      await api({ url: `oms/customers/${partyId}/telecomNumbers`, method: 'post', data: { partyId, ...data } });
    },

    async updatePartyTelecomNumber(partyId: string, contactMechId: string, data: { contactNumber: string; countryCode?: string; areaCode?: string; contactMechPurposeTypeId?: string }): Promise<void> {
      await api({ url: `oms/customers/${partyId}/telecomNumbers`, method: 'put', data: { partyId, contactMechId, ...data } });
    },

    async createPartyPostalAddress(partyId: string, data: { address1: string; city: string; postalCode: string; address2?: string; stateProvinceGeoId?: string; countryGeoId?: string; contactMechPurposeTypeId?: string }): Promise<void> {
      await api({ url: `oms/customers/${partyId}/postalAddresses`, method: 'post', data: { partyId, ...data } });
    },

    async updatePartyPostalAddress(partyId: string, contactMechId: string, data: { address1: string; city: string; postalCode: string; address2?: string; stateProvinceGeoId?: string; countryGeoId?: string; contactMechPurposeTypeId?: string }): Promise<void> {
      await api({ url: `oms/customers/${partyId}/postalAddresses`, method: 'put', data: { partyId, contactMechId, ...data } });
    },

    async expirePartyContactMech(partyId: string, contactMechId: string): Promise<void> {
      await api({ url: `oms/customers/${partyId}/contactMechs/${contactMechId}`, method: 'delete', data: { partyId, contactMechId } });
    },

    async getCustomerCommunications(partyId: string): Promise<CustomerCommunicationSummary[]> {
      const [fromRes, toRes] = await Promise.all([
        api({ url: 'oms/customers/communications', method: 'get', params: { partyIdFrom: partyId, orderByField: '-entryDate', pageSize: 100 } }),
        api({ url: 'oms/customers/communications', method: 'get', params: { partyIdTo: partyId, orderByField: '-entryDate', pageSize: 100 } })
      ]);
      const seen = new Set<string>();
      const results: CustomerCommunicationSummary[] = [];
      for (const doc of [...asList(fromRes.data), ...asList(toRes.data)]) {
        const id = toStringValue(doc.communicationEventId);
        if (id && !seen.has(id)) {
          seen.add(id);
          results.push(normalizeCustomerCommunication(doc));
        }
      }
      return results.sort((a, b) => (b.entryDate || '').localeCompare(a.entryDate || ''));
    },

    async searchShopifyCustomers(shopId: string, searchText: string): Promise<Customer[]> {
      const response = await api({
        url: 'oms/shopify/customers',
        method: 'get',
        params: {
          shopId,
          searchText
        }
      });
      return response.data?.customers || [];
    },

    async createShopifyCustomer(shopId: string, customerData: any): Promise<any> {
      const response = await api({
        url: 'oms/shopify/customers',
        method: 'post',
        data: {
          shopId,
          ...customerData
        }
      });
      return response.data;
    },

    async getShopifyShops(params: { productStoreId: string }): Promise<any[]> {
      const response = await api({
        url: 'oms/shopifyShops/shops',
        method: 'get',
        params
      });
      return response.data || [];
    },

    async findShopifyDuplicateParties(partyId: string, shopifyIdValue: string): Promise<Array<{ partyId: string; name: string }>> {
      const response = await api({
        url: 'oms/parties/identifications',
        method: 'get',
        params: {
          partyIdentificationTypeId: 'SHOPIFY_CUST_ID',
          idValue: shopifyIdValue,
          partyId,
          partyId_not: 'Y'
        }
      });
      const partyIds = asList(response.data)
        .map((item: any) => toStringValue(item.partyId))
        .filter(Boolean);
      if (!partyIds.length) return [];
      const names = await this.getPartyNames(partyIds);
      const nameMap: Record<string, string> = {};
      names.forEach((n) => { if (n.partyId) nameMap[n.partyId] = n.name; });
      return partyIds.map((id) => ({ partyId: id, name: nameMap[id] || id }));
    },

    async ensurePartyRole(partyId: string, roleTypeId: string): Promise<void> {
      await api({
        url: `oms/parties/${partyId}/roles`,
        method: 'post',
        data: { partyId, roleTypeId }
      });
    },

    async deleteCustomerDetails(partyId: string): Promise<void> {
      await api({
        url: `oms/customers/${partyId}`,
        method: 'delete'
      });
    },

    async indexCustomer(partyId: string): Promise<void> {
      await api({
        url: 'oms/search/index/customer',
        method: 'post',
        data: { partyId }
      });
    },

    setCurrentCustomer(partyId: string) {
      this.currentPartyId = partyId;
      return this.loadCustomerDashboard(partyId);
    },

    // Prefetch on detail route mount. Profile failure fails the page; section
    // failures (orders/tasks) are isolated to their own source bucket.
    async loadCustomerDashboard(partyId: string, force = false) {
      await Promise.allSettled([
        this.loadCustomerProfile(partyId, force),
        this.loadCustomerOrders(partyId, force),
        this.loadCustomerTasks(partyId, force),
        this.loadCustomerRelationships(partyId, force)
      ]);
      await (this as any).loadMergableDuplicates(partyId);
    },

    async loadCustomerProfile(partyId: string, force = false) {
      if (!partyId) return;
      const existing = this.profilesById[partyId];
      if (existing?.status === 'loaded' && !force) return;

      this.profilesById[partyId] = { ...(existing || newSource<CustomerProfile | null>(null)), status: 'loading', error: '' };
      try {
        const profile = await this.getCustomerProfile(partyId);
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
          error: error?.message || translate('Failed to load customer')
        };
      }
    },

    async loadCustomerOrders(partyId: string, force = false) {
      if (!partyId) return;
      const existing = this.recentOrdersByPartyId[partyId];
      if (existing?.status === 'loaded' && !force) return;

      this.recentOrdersByPartyId[partyId] = { ...(existing || newSource<CustomerOrderSummary[]>([])), status: 'loading', error: '' };
      try {
        const result = await this.getCustomerOrdersFromSolr(partyId, { pageSize: 100 });

        // Real progress for the rendered cards: hydrate each via the official get-order API
        // (not Solr). The page words progress from these statuses' ages (useCustomerDetail).
        const displayCount = 12;
        await Promise.all(result.orders.slice(0, displayCount).map(async (order) => {
          try {
            const statusIds = await this.getOrderProgressStatuses(order.orderId);
            if (statusIds.length) order.progressStatusIds = statusIds;
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
        if (orderProductIds.length) refreshAfterMutation('product', { productIds: orderProductIds }).catch(() => {});
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
          error: error?.message || translate('Failed to load orders')
        };
      }
    },

    async loadCustomerTasks(partyId: string, force = false) {
      if (!partyId) return;
      const existing = this.tasksByPartyId[partyId];
      if (existing?.status === 'loaded' && !force) return;

      const pageSize = Number(import.meta.env.VITE_VIEW_SIZE) || 10;
      this.tasksByPartyId[partyId] = { ...(existing || newSource<CustomerTaskSummary[]>([])), status: 'loading', error: '' };
      try {
        const tasks = await this.getCustomerTasks(partyId, { taskStatusId: 'TASK_CREATED', pageSize, pageIndex: 0 });
        this.tasksByPartyId[partyId] = {
          payload: tasks,
          status: 'loaded',
          loadedAt: new Date().toISOString(),
          error: '',
          pageIndex: 0,
          pageSize,
          hasMore: tasks.length >= pageSize
        };
      } catch (error: any) {
        this.tasksByPartyId[partyId] = {
          payload: [],
          status: 'error',
          loadedAt: '',
          error: error?.message || translate('Failed to load tasks')
        };
      }
    },

    async loadMoreCustomerTasks(partyId: string) {
      if (!partyId) return;
      const existing = this.tasksByPartyId[partyId];
      if (!existing?.hasMore || existing.status === 'loading') return;

      const pageSize = existing.pageSize ?? (Number(import.meta.env.VITE_VIEW_SIZE) || 10);
      const nextPage = (existing.pageIndex ?? 0) + 1;
      this.tasksByPartyId[partyId] = { ...existing, status: 'loading', error: '' };
      try {
        const more = await this.getCustomerTasks(partyId, { taskStatusId: 'TASK_CREATED', pageSize, pageIndex: nextPage });
        this.tasksByPartyId[partyId] = {
          payload: [...(existing.payload || []), ...more],
          status: 'loaded',
          loadedAt: new Date().toISOString(),
          error: '',
          pageIndex: nextPage,
          pageSize,
          hasMore: more.length >= pageSize
        };
      } catch (error: any) {
        this.tasksByPartyId[partyId] = { ...existing, status: 'error', error: error?.message || translate('Failed to load more tasks') };
      }
    },

    async loadCustomerReturns(partyId: string, force = false) {
      if (!partyId) return;
      const existing = this.returnsByPartyId[partyId];
      if (existing?.status === 'loaded' && !force) return;

      this.returnsByPartyId[partyId] = { ...(existing || newSource<ReturnSummary[]>([])), status: 'loading', error: '' };
      try {
        const result = await useReturnsStore().listReturns({ fromPartyId: partyId, pageIndex: 0, pageSize: 100 });
        const returns = result.items;
        this.returnsByPartyId[partyId] = {
          payload: returns,
          status: 'loaded',
          loadedAt: new Date().toISOString(),
          error: '',
          total: result.total
        };
      } catch (error: any) {
        this.returnsByPartyId[partyId] = {
          payload: [],
          status: 'error',
          loadedAt: '',
          error: error?.message || translate('Failed to load returns')
        };
      }
    },

    async loadCustomerCommunications(partyId: string, force = false) {
      if (!partyId) return;
      const existing = this.communicationsByPartyId[partyId];
      if (existing?.status === 'loaded' && !force) return;

      this.communicationsByPartyId[partyId] = { ...(existing || newSource<CustomerCommunicationSummary[]>([])), status: 'loading', error: '' };
      try {
        const comms = await this.getCustomerCommunications(partyId);
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
          error: error?.message || translate('Failed to load communications')
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
        const results = await this.getPartyNames(missing);
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
        const relationships = await this.getCustomerRelationships(partyId);
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
          error: error?.message || translate('Failed to load relationships')
        };
      }
    },

    async addContact(partyId: string, contactMechTypeId: string, data: Record<string, string>) {
      if (contactMechTypeId === 'EMAIL_ADDRESS') {
        await this.createPartyEmail(partyId, data as any);
      } else if (contactMechTypeId === 'TELECOM_NUMBER') {
        await this.createPartyTelecomNumber(partyId, data as any);
      } else if (contactMechTypeId === 'POSTAL_ADDRESS') {
        await this.createPartyPostalAddress(partyId, data as any);
      }
      await this.loadCustomerProfile(partyId, true);
      triggerCustomerIndex(partyId);
    },

    async updateContact(partyId: string, contactMechTypeId: string, contactMechId: string, data: Record<string, string>) {
      if (contactMechTypeId === 'EMAIL_ADDRESS') {
        await this.updatePartyEmail(partyId, contactMechId, data as any);
      } else if (contactMechTypeId === 'TELECOM_NUMBER') {
        await this.updatePartyTelecomNumber(partyId, contactMechId, data as any);
      } else if (contactMechTypeId === 'POSTAL_ADDRESS') {
        await this.updatePartyPostalAddress(partyId, contactMechId, data as any);
      }
      await this.loadCustomerProfile(partyId, true);
      triggerCustomerIndex(partyId);
    },

    async expireContact(partyId: string, contactMechId: string) {
      await this.expirePartyContactMech(partyId, contactMechId);
      await this.loadCustomerProfile(partyId, true);
      triggerCustomerIndex(partyId);
    },

    async createRelationship(input: { partyIdFrom: string; partyIdTo: string; partyRelationshipTypeId: string; roleTypeIdFrom: string; roleTypeIdTo: string; fromDate: number; comments?: string }) {
      await Promise.all([
        this.ensurePartyRole(input.partyIdFrom, input.roleTypeIdFrom),
        this.ensurePartyRole(input.partyIdTo, input.roleTypeIdTo)
      ]);
      await this.createPartyRelationship(input);
      const partyId = this.currentPartyId || input.partyIdFrom;
      await Promise.all([
        this.loadCustomerProfile(partyId, true),
        this.loadCustomerRelationships(partyId, true)
      ]);
      triggerCustomerIndex(partyId);
    },

    async expireRelationship(key: { partyIdFrom: string; partyIdTo: string; roleTypeIdFrom: string; roleTypeIdTo: string; fromDate: string }, thruDate: number) {
      await this.expirePartyRelationship(key, thruDate);
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
        const candidates = await this.findShopifyDuplicateParties(partyId, shopifyId.idValue);
        this.mergableDuplicatesByPartyId[partyId] = candidates.filter((c) => !alreadyMergedIds.has(c.partyId));
      } catch {
        this.mergableDuplicatesByPartyId[partyId] = [];
      }
    },

    async mergeContact(currentPartyId: string, duplicatePartyId: string) {
      await Promise.all([
        this.ensurePartyRole(currentPartyId, 'CUSTOMER'),
        this.ensurePartyRole(duplicatePartyId, 'CUSTOMER')
      ]);
      await this.createPartyRelationship({
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
