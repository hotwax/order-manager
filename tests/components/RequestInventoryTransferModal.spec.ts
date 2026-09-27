import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RequestInventoryTransferModal from '@/components/inventory/RequestInventoryTransferModal.vue';

const mocks = vi.hoisted(() => ({
  item: {} as Record<string, unknown>,
  fetchFacilityStock: vi.fn(),
  fetchFacilitySalesVelocity: vi.fn(),
  fetchDistancesFromFacility: vi.fn(),
  requestInventoryTransfers: vi.fn(),
  dismiss: vi.fn(),
  fetchInventoryTransfers: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('@common', () => ({
  DxpShopifyImg: { template: '<img />' },
  logger: { error: vi.fn() },
  translate: (key: string, params?: Record<string, unknown>) => key.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '')),
}));

vi.mock('@ionic/vue', () => {
  const component = { template: '<div><slot /></div>' };
  const button = { props: ['disabled'], emits: ['click'], template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>' };
  return {
    IonButton: button, IonButtons: component, IonContent: component, IonFab: component,
    IonFabButton: { ...button, template: '<button class="fab" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>' },
    IonHeader: component, IonIcon: component,
    IonItem: { emits: ['click'], template: '<div class="item" @click="$emit(\'click\')"><slot /></div>' },
    IonItemDivider: { template: '<div class="divider"><slot /></div>' },
    IonLabel: component, IonList: component,
    IonSelect: { name: 'IonSelect', props: ['modelValue', 'label'], emits: ['update:modelValue'], template: '<div class="select">{{ label }}<slot /></div>' },
    IonSelectOption: component, IonSpinner: component,
    IonTextarea: { props: ['modelValue'], emits: ['update:modelValue'], template: '<textarea class="comments" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
    IonThumbnail: component, IonTitle: { template: '<h1 class="title"><slot /></h1>' }, IonToolbar: component,
    IonToggle: { name: 'IonToggle', props: ['modelValue'], emits: ['update:modelValue'], template: '<label class="toggle"><slot /></label>' },
    modalController: { dismiss: mocks.dismiss },
  };
});

const facilities: Record<string, Record<string, string>> = {
  DEST_WH: { facilityId: 'DEST_WH', facilityName: 'Destination WH', facilityTypeId: 'WAREHOUSE', parentTypeId: 'DISTRIBUTION_CENTER' },
  WH_A: { facilityId: 'WH_A', facilityName: 'Warehouse A', facilityTypeId: 'WAREHOUSE', parentTypeId: 'DISTRIBUTION_CENTER' },
  WH_B: { facilityId: 'WH_B', facilityName: 'Warehouse B', facilityTypeId: 'WAREHOUSE', parentTypeId: 'DISTRIBUTION_CENTER' },
  STORE_A: { facilityId: 'STORE_A', facilityName: 'Store A', facilityTypeId: 'RETAIL_STORE', parentTypeId: 'PHYSICAL_STORE' },
  STORE_B: { facilityId: 'STORE_B', facilityName: 'Store B', facilityTypeId: 'RETAIL_STORE', parentTypeId: 'PHYSICAL_STORE' },
  PARKING: { facilityId: 'PARKING', facilityName: 'Backorder parking', facilityTypeId: 'BACKORDER', parentTypeId: 'VIRTUAL_FACILITY' },
};

vi.mock('@/store/orderDetail', () => ({
  useOrderDetailStore: () => ({
    enrichedOrderByOrderId: () => ({ shipGroups: [{ items: [mocks.item] }] }),
    fetchInventoryTransfers: mocks.fetchInventoryTransfers,
  }),
}));
vi.mock('@/store/seed', () => ({
  useSeedStore: () => ({
    loadFacilities: vi.fn(),
    facilities: { ids: Object.keys(facilities), byId: facilities },
    facilityName: (facilityId: string) => facilities[facilityId]?.facilityName || facilityId,
  }),
}));
vi.mock('@/composables/useProductIdentity', () => ({
  useProductIdentity: () => ({ getProduct: () => null, primaryIdentifier: () => '649A-678:S', secondaryIdentifier: () => '141914', featureLabel: () => 'S' }),
}));
vi.mock('@/composables/useOrderDistances', () => ({ fetchDistancesFromFacility: mocks.fetchDistancesFromFacility }));
vi.mock('@/services/inventoryTransfers', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  fetchFacilityStock: mocks.fetchFacilityStock,
  fetchFacilitySalesVelocity: mocks.fetchFacilitySalesVelocity,
  requestInventoryTransfers: mocks.requestInventoryTransfers,
}));
vi.mock('@/utils', () => ({ showToast: mocks.showToast }));

const mountModal = async () => {
  const wrapper = mount(RequestInventoryTransferModal, { props: { orderId: 'O1', orderItemSeqId: '01', destinationFacilityId: 'DEST_WH' } });
  await flushPromises();
  return wrapper;
};
type Wrapper = Awaited<ReturnType<typeof mountModal>>;

const dividers = (wrapper: Wrapper) => wrapper.findAll('.divider').map((divider) => divider.text());
/** The facility rows of step 1, in the order shown, by facility id. */
const listedFacilities = (wrapper: Wrapper) =>
  wrapper.findAll('.item').map((row) => Object.keys(facilities).find((facilityId) => row.text().includes(facilityId))).filter(Boolean);
const row = (wrapper: Wrapper, facilityId: string) => wrapper.findAll('.item').find((candidate) => candidate.text().includes(facilityId))!;
const rowText = (wrapper: Wrapper, facilityId: string) => row(wrapper, facilityId).text().replace(/\s+/g, '');
const afterRows = (wrapper: Wrapper) =>
  wrapper.findAll('.item').filter((candidate) => candidate.text().includes('After transfer')).map((candidate) => candidate.text().replace(/\s+/g, ''));
const button = (wrapper: Wrapper, label: string) => wrapper.findAll('button').find((candidate) => candidate.attributes('aria-label') === label)!;

describe('request inventory transfer modal', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((value) => typeof value === 'function' && (value as any).mockReset());
    mocks.item = { orderItemSeqId: '01', productId: 'P1', name: 'Blouse', statusId: 'ITEM_APPROVED', quantity: 2 };
    mocks.fetchFacilityStock.mockResolvedValue({
      DEST_WH: { atp: 0, qoh: 1 }, WH_A: { atp: 5, qoh: 5 }, WH_B: { atp: 20, qoh: 22 }, STORE_A: { atp: 2, qoh: 3 }, STORE_B: { atp: 0, qoh: 0 },
    });
    mocks.fetchFacilitySalesVelocity.mockResolvedValue({ WH_A: 0.3, STORE_B: 0.1 });
    mocks.fetchDistancesFromFacility.mockResolvedValue({ WH_A: 12.34 });
    mocks.requestInventoryTransfers.mockResolvedValue(['T9']);
  });

  it('lists warehouses, then stores, leaving out the destination and virtual facilities', async () => {
    const wrapper = await mountModal();

    expect(dividers(wrapper)).toEqual(['Warehouses', 'Retail stores']);
    // Most available first.
    expect(listedFacilities(wrapper)).toEqual(['WH_B', 'WH_A', 'STORE_A', 'STORE_B']);
    expect(mocks.fetchFacilityStock).toHaveBeenCalledWith('P1', ['WH_A', 'WH_B', 'STORE_A', 'STORE_B', 'DEST_WH']);
    expect(mocks.fetchFacilitySalesVelocity).toHaveBeenCalledWith('P1');
    expect(mocks.fetchDistancesFromFacility).toHaveBeenCalledWith('DEST_WH');
  });

  it('shows each facility\'s distance from the destination, its ATP and QOH, and its sales per day', async () => {
    const wrapper = await mountModal();

    expect(rowText(wrapper, 'WH_A')).toContain('WH_A12.3miles5ATP5QOH0.3Sales/day');
    // No location to measure from, so no distance line; and no sales in the window.
    expect(rowText(wrapper, 'WH_B')).toContain('WH_B20ATP22QOH0Sales/day');
    expect(rowText(wrapper, 'WH_B')).not.toContain('miles');
  });

  it('sorts each group by sales velocity when asked', async () => {
    const wrapper = await mountModal();

    expect(wrapper.findComponent({ name: 'IonSelect' }).props('modelValue')).toBe('inventory');
    wrapper.findComponent({ name: 'IonSelect' }).vm.$emit('update:modelValue', 'velocity');
    await flushPromises();

    expect(listedFacilities(wrapper)).toEqual(['WH_A', 'WH_B', 'STORE_B', 'STORE_A']);
  });

  it('sorts each group alphabetically when asked', async () => {
    const wrapper = await mountModal();

    wrapper.findComponent({ name: 'IonSelect' }).vm.$emit('update:modelValue', 'name');
    await flushPromises();

    expect(listedFacilities(wrapper)).toEqual(['WH_A', 'WH_B', 'STORE_A', 'STORE_B']);
  });

  it('hides facilities with nothing available to move when asked', async () => {
    const wrapper = await mountModal();

    expect(wrapper.find('.toggle').text()).toBe('Hide out of stock');
    wrapper.findComponent({ name: 'IonToggle' }).vm.$emit('update:modelValue', true);
    await flushPromises();

    // STORE_B has none; the stores group keeps the one with stock.
    expect(listedFacilities(wrapper)).toEqual(['WH_B', 'WH_A', 'STORE_A']);
  });

  it('keeps a facility whose stock could not be loaded, rather than hiding it as out of stock', async () => {
    mocks.fetchFacilityStock.mockRejectedValue(new Error('down'));
    const wrapper = await mountModal();

    wrapper.findComponent({ name: 'IonToggle' }).vm.$emit('update:modelValue', true);
    await flushPromises();

    expect(listedFacilities(wrapper)).toHaveLength(4);
  });

  it('shows a dash, not zero, where stock or sales could not be loaded', async () => {
    mocks.fetchFacilityStock.mockRejectedValue(new Error('down'));
    mocks.fetchFacilitySalesVelocity.mockRejectedValue(new Error('down'));
    const wrapper = await mountModal();

    expect(rowText(wrapper, 'WH_B')).toContain('WH_B-ATP-QOH-Sales/day');
  });

  it('reviews the chosen source like an existing transfer, then saves the request with its comment', async () => {
    const wrapper = await mountModal();

    await row(wrapper, 'WH_B').trigger('click');
    await flushPromises();

    expect(wrapper.find('.title').text()).toBe('Review transfer');
    expect(dividers(wrapper)).toEqual(['Transfer from', 'Transfer to']);
    // The whole item moves.
    expect(wrapper.text()).toContain('2 qty');
    expect(afterRows(wrapper)).toEqual(['Aftertransfer18(-2)20(-2)', 'Aftertransfer2(+2)3(+2)']);

    await wrapper.find('.comments').setValue('  Rush  ');
    await wrapper.find('.fab').trigger('click');
    await flushPromises();

    expect(mocks.requestInventoryTransfers).toHaveBeenCalledWith({
      requestReferencePrefix: expect.stringMatching(/^ORDER_MANAGER-O1-\d+$/),
      transfers: [{ productId: 'P1', quantity: 2, facilityId: 'WH_B', facilityIdTo: 'DEST_WH', orderId: 'O1', orderItemSeqId: '01', comments: 'Rush' }],
    });
    expect(mocks.dismiss).toHaveBeenCalledWith({ inventoryTransferIds: ['T9'] }, 'confirm');
    // The order's transfers reload before the modal closes, so the item no longer offers a transfer.
    expect(mocks.fetchInventoryTransfers).toHaveBeenCalledWith('O1');
    expect(mocks.fetchInventoryTransfers.mock.invocationCallOrder[0]).toBeLessThan(mocks.dismiss.mock.invocationCallOrder[0]);
  });

  it('goes back to the list without saving', async () => {
    const wrapper = await mountModal();

    await row(wrapper, 'WH_A').trigger('click');
    await button(wrapper, 'Back').trigger('click');
    await flushPromises();

    expect(dividers(wrapper)).toEqual(['Warehouses', 'Retail stores']);
    expect(wrapper.find('.fab').exists()).toBe(false);
    expect(mocks.requestInventoryTransfers).not.toHaveBeenCalled();
  });

  it('stays open and says so when the request fails', async () => {
    mocks.requestInventoryTransfers.mockRejectedValue(new Error('down'));
    const wrapper = await mountModal();

    await row(wrapper, 'WH_A').trigger('click');
    await wrapper.find('.fab').trigger('click');
    await flushPromises();

    expect(mocks.showToast).toHaveBeenCalledWith('Failed to request inventory transfer. Please try again.');
    expect(mocks.dismiss).not.toHaveBeenCalled();
    expect(mocks.fetchInventoryTransfers).not.toHaveBeenCalled();
    expect(wrapper.find('.fab').attributes('disabled')).toBeUndefined();
  });
});
