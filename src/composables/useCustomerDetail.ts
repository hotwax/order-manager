import { computed } from 'vue';
import { useCustomerStore } from '@/store/customer';

/**
 * Thin view adapter for CustomerDetail.vue. Reads from the customer Pinia store
 * and exposes computed bindings + actions. It does NOT make HTTP calls directly -
 * the store owns orchestration and the services own transport.
 *
 * @param getPartyId reactive accessor for the current party id (e.g. () => props.customerId)
 */
export function useCustomerDetail(getPartyId: () => string) {
  const store = useCustomerStore();
  const partyId = computed(() => getPartyId());

  const customer = computed(() => store.getCustomer(partyId.value));
  const loading = computed(() => store.sectionStatus(partyId.value, 'profile') === 'loading');
  const error = computed(() => store.sectionError(partyId.value, 'profile'));

  const contactSections = computed(() => store.contactSections(partyId.value));
  const personalRelationships = computed(() => store.personalRelationships(partyId.value));
  const duplicateRelationships = computed(() => store.duplicateRelationships(partyId.value));
  const timeline = computed(() => store.customerTimeline(partyId.value));
  const recentOrders = computed(() => store.recentOrders(partyId.value));
  const openTasks = computed(() => store.openTasks(partyId.value));
  const customerReturns = computed(() => (store as any).returns(partyId.value));
  const customerCommunications = computed(() => (store as any).communications(partyId.value));
  const ordersStatus = computed(() => (store as any).sectionStatus(partyId.value, 'recentOrders'));
  const tasksStatus = computed(() => (store as any).sectionStatus(partyId.value, 'tasks'));
  const returnsStatus = computed(() => (store as any).sectionStatus(partyId.value, 'returns'));
  const commsStatus = computed(() => (store as any).sectionStatus(partyId.value, 'communications'));
  const lifetimeValue = computed(() => store.lifetimeValue(partyId.value));
  const lifetimeOrders = computed(() => store.lifetimeOrders(partyId.value));
  const lifetimeCurrency = computed(() => store.lifetimeCurrency(partyId.value));
  const customerSince = computed(() => store.customerSince(partyId.value));

  function load() {
    return store.setCurrentCustomer(partyId.value);
  }

  function refresh() {
    return store.refreshCustomer(partyId.value);
  }

  function expireRelationship(keyFields: { partyIdFrom: string; partyIdTo: string; roleTypeIdFrom: string; roleTypeIdTo: string; fromDate: string }, thruDate: string) {
    return store.expireRelationship(keyFields, thruDate);
  }

  function createRelationship(input: { partyIdFrom: string; partyIdTo: string; partyRelationshipTypeId: string; fromDate: string; comments?: string }) {
    return store.createRelationship(input);
  }

  function addContact(contactMechTypeId: string, data: Record<string, string>) {
    return (store as any).addContact(partyId.value, contactMechTypeId, data);
  }

  function updateContact(contactMechTypeId: string, contactMechId: string, data: Record<string, string>) {
    return (store as any).updateContact(partyId.value, contactMechTypeId, contactMechId, data);
  }

  function expireContact(contactMechId: string) {
    return (store as any).expireContact(partyId.value, contactMechId);
  }

  function loadReturns() {
    return (store as any).loadCustomerReturns(partyId.value);
  }

  function loadCommunications() {
    return (store as any).loadCustomerCommunications(partyId.value);
  }

  return {
    store,
    customer,
    loading,
    error,
    contactSections,
    personalRelationships,
    duplicateRelationships,
    timeline,
    recentOrders,
    openTasks,
    customerReturns,
    customerCommunications,
    ordersStatus,
    tasksStatus,
    returnsStatus,
    commsStatus,
    lifetimeValue,
    lifetimeOrders,
    lifetimeCurrency,
    customerSince,
    load,
    refresh,
    expireRelationship,
    createRelationship,
    addContact,
    updateContact,
    expireContact,
    loadReturns,
    loadCommunications
  };
}
