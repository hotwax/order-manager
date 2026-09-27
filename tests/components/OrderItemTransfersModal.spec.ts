import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrderItemTransfersModal from '@/components/orders/OrderItemTransfersModal.vue';
import type { EnrichedTransfer } from '@/types/orderDetail';

const mocks = vi.hoisted(() => ({
  transfers: [] as any[],
  canManage: true,
  alertRole: 'confirm',
  fetchInventoryTransfers: vi.fn(),
  executeInventoryTransfer: vi.fn(),
  cancelInventoryTransfer: vi.fn(),
  fetchFacilityStock: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('@common', () => ({
  DxpShopifyImg: { template: '<img />' },
  logger: { error: vi.fn() },
  translate: (key: string, params?: Record<string, unknown>) => key.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '')),
}));

vi.mock('@ionic/vue', () => {
  const component = { template: '<div><slot /></div>' };
  return {
    IonBadge: { template: '<span class="badge"><slot /></span>' },
    IonButton: { props: ['disabled'], emits: ['click'], template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>' },
    IonButtons: component, IonContent: component, IonFooter: { template: '<footer><slot /></footer>' }, IonHeader: component, IonIcon: component,
    IonItem: { template: '<div class="item"><slot /></div>' }, IonItemDivider: { template: '<div class="divider"><slot /></div>' },
    IonLabel: component, IonList: component, IonThumbnail: component, IonTitle: component, IonToolbar: component,
    alertController: { create: vi.fn(async () => ({ present: vi.fn(), onDidDismiss: async () => ({ role: mocks.alertRole }) })) },
    modalController: { dismiss: vi.fn() },
  };
});

vi.mock('@/store/orderDetail', () => ({
  useOrderDetailStore: () => ({
    enrichedOrderByOrderId: () => ({ shipGroups: [{ items: [{ orderItemSeqId: '02', productId: 'P1', name: 'Blouse', quantity: 1, transfers: mocks.transfers }] }] }),
    fetchInventoryTransfers: mocks.fetchInventoryTransfers,
  }),
}));
vi.mock('@/store/user', () => ({ useUserStore: () => ({ hasPermission: () => mocks.canManage }) }));
vi.mock('@/composables/useProductIdentity', () => ({
  useProductIdentity: () => ({ getProduct: () => null, primaryIdentifier: () => '649A-678:S', secondaryIdentifier: () => '141914', featureLabel: () => 'S' }),
}));
vi.mock('@/services/inventoryTransfers', () => ({
  fetchFacilityStock: mocks.fetchFacilityStock,
  executeInventoryTransfer: mocks.executeInventoryTransfer,
  cancelInventoryTransfer: mocks.cancelInventoryTransfer,
}));
vi.mock('@/utils', () => ({ showToast: mocks.showToast }));

const requested: EnrichedTransfer = {
  id: '100428', statusId: 'IXF_REQUESTED', status: 'Requested', isOpen: true, quantity: 1,
  fromFacilityId: 'WH_51ST_ST', fromFacilityName: '2301 E. 51st St.', toFacilityId: '100002', toFacilityName: 'CAN WH - Ponyride',
  sourceLabel: 'Regional brokering', comments: '', reason: '',
};

const mountModal = async () => {
  const wrapper = mount(OrderItemTransfersModal, { props: { orderId: 'O1', orderItemSeqId: '02' } });
  await flushPromises();
  return wrapper;
};
const facilityRow = (wrapper: Awaited<ReturnType<typeof mountModal>>, facilityId: string) =>
  wrapper.findAll('.item').find((row) => row.text().includes(facilityId))!.text().replace(/\s+/g, '');
const afterRows = (wrapper: Awaited<ReturnType<typeof mountModal>>) =>
  wrapper.findAll('.item').filter((row) => row.text().includes('After transfer')).map((row) => row.text().replace(/\s+/g, ''));
const button = (wrapper: Awaited<ReturnType<typeof mountModal>>, label: string) =>
  wrapper.findAll('button').find((candidate) => candidate.text() === label);

describe('order item transfers modal', () => {
  beforeEach(() => {
    mocks.transfers = [requested];
    mocks.canManage = true;
    mocks.alertRole = 'confirm';
    Object.values(mocks).forEach((value) => typeof value === 'function' && 'mockReset' in value && (value as any).mockReset());
    mocks.fetchFacilityStock.mockResolvedValue({ WH_51ST_ST: { atp: 38, qoh: 38 }, '100002': { atp: 0, qoh: 1 } });
    mocks.executeInventoryTransfer.mockResolvedValue({});
    mocks.cancelInventoryTransfer.mockResolvedValue({});
  });

  it('shows each side\'s stock now, and after the transfer completes with the change', async () => {
    const wrapper = await mountModal();

    expect(mocks.fetchFacilityStock).toHaveBeenCalledWith('P1', ['WH_51ST_ST', '100002']);
    expect(wrapper.findAll('.divider').map((divider) => divider.text())).toEqual(['Transfer from', 'Transfer to']);
    expect(facilityRow(wrapper, 'WH_51ST_ST')).toContain('38ATP38QOH');
    expect(facilityRow(wrapper, '100002')).toContain('0ATP1QOH');
    expect(afterRows(wrapper)).toEqual(['Aftertransfer37(-1)37(-1)', 'Aftertransfer1(+1)2(+1)']);
  });

  it('completes the transfer only after confirming, then reloads transfers and stock', async () => {
    const wrapper = await mountModal();

    mocks.alertRole = 'cancel';
    await button(wrapper, 'Complete transfer')!.trigger('click');
    await flushPromises();
    expect(mocks.executeInventoryTransfer).not.toHaveBeenCalled();

    mocks.alertRole = 'confirm';
    await button(wrapper, 'Complete transfer')!.trigger('click');
    await flushPromises();
    expect(mocks.executeInventoryTransfer).toHaveBeenCalledWith('100428');
    expect(mocks.fetchInventoryTransfers).toHaveBeenCalledWith('O1');
    expect(mocks.fetchFacilityStock).toHaveBeenCalledTimes(2);
    expect(mocks.showToast).toHaveBeenCalledWith('Transfer completed.');
  });

  it('cancels the transfer after confirming', async () => {
    const wrapper = await mountModal();

    await button(wrapper, 'Cancel transfer')!.trigger('click');
    await flushPromises();

    expect(mocks.cancelInventoryTransfer).toHaveBeenCalledWith('100428');
    expect(mocks.fetchInventoryTransfers).toHaveBeenCalledWith('O1');
  });

  it('offers no actions without the permission, or once the transfer is no longer open', async () => {
    mocks.canManage = false;
    expect((await mountModal()).find('footer').exists()).toBe(false);

    mocks.canManage = true;
    mocks.transfers = [{ ...requested, statusId: 'IXF_COMPLETE', status: 'Complete', isOpen: false }];
    const wrapper = await mountModal();
    expect(wrapper.find('footer').exists()).toBe(false);
    // A finished transfer shows where stock stands now, with nothing still to move.
    expect(facilityRow(wrapper, 'WH_51ST_ST')).toContain('38ATP38QOH');
    expect(afterRows(wrapper)).toEqual([]);
  });

  it('names the transfer by its id, and puts why it is in its status under the status', async () => {
    mocks.transfers = [{ ...requested, statusId: 'IXF_CANCELLED', status: 'Cancelled', isOpen: false, reason: 'Order item reallocated to another facility' }];
    const wrapper = await mountModal();

    expect(wrapper.findAll('.overline').map((overline) => overline.text())).toContain('Inventory transfer: 100428');
    const status = wrapper.findAll('[slot="end"]').find((label) => label.find('.badge').exists())!;
    expect(status.find('.badge').text()).toBe('Cancelled');
    expect(status.find('p').text()).toBe('Order item reallocated to another facility');
  });

  it('keeps older transfers below the current one', async () => {
    mocks.transfers = [requested, { ...requested, id: '100001', statusId: 'IXF_CANCELLED', status: 'Cancelled', isOpen: false, reason: 'Order item reallocated to another facility' }];
    const wrapper = await mountModal();

    expect(wrapper.findAll('.divider').map((divider) => divider.text())).toEqual(['Transfer from', 'Transfer to', 'Earlier transfers']);
    expect(wrapper.text()).toContain('Order item reallocated to another facility');
  });
});
