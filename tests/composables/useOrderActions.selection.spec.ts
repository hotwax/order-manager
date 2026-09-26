import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { modalController } from '@ionic/vue';
import { api } from '@common';
import { showToast } from '@/utils';
import { useOrderActions } from '@/composables/useOrderActions';
import type { EnrichedOrder, EnrichedOrderItem, EnrichedShipGroup } from '@/types/orderDetail';

vi.mock('@common', async (importOriginal) => ({ ...(await importOriginal<any>()), api: vi.fn() }));
vi.mock('@ionic/vue', async (importOriginal) => ({ ...(await importOriginal<any>()), modalController: { create: vi.fn() } }));
vi.mock('@/utils', async (importOriginal) => ({ ...(await importOriginal<any>()), showToast: vi.fn() }));

const item = (orderItemSeqId: string, statusId: string) =>
  ({ orderItemSeqId, shipGroupSeqId: '00001', statusId, facilityId: 'F', productId: 'P', quantity: 1 }) as EnrichedOrderItem;

/** The next modal dismisses with this result. */
function dismissModalWith(result: { data?: any; role?: string }) {
  vi.mocked(modalController.create).mockResolvedValue({
    present: vi.fn(),
    onWillDismiss: vi.fn().mockResolvedValue(result),
  } as any);
}

function setup(isVirtual: boolean, items: EnrichedOrderItem[], checked: string[] = []) {
  const shipGroup = { id: '00001', facilityId: isVirtual ? '_NA_' : 'F', isVirtual, items } as EnrichedShipGroup;
  const order = {
    id: 'O1',
    statusId: 'ORDER_APPROVED',
    shipGroups: [shipGroup],
    groupedItems: items.map((groupItem) => ({ externalId: groupItem.orderItemSeqId, items: [groupItem] })),
  } as unknown as EnrichedOrder;
  const loadOrder = vi.fn();
  const selectedShipGroupItems = ref<Record<string, string[]>>({ '00001': checked });
  const actions = useOrderActions({
    order: ref(order),
    loadOrder,
    selectedItemIds: ref(new Set<string>()),
    selectedShipGroupItems,
    selectedSegment: ref('ship-groups'),
  });
  return { actions, shipGroup, loadOrder, selectedShipGroupItems };
}

const calls = () => vi.mocked(api).mock.calls.map(([request]: any) => ({ url: request.url, data: request.data }));

describe('ship group selection actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(api).mockReset().mockResolvedValue({ data: {} });
    vi.mocked(modalController.create).mockReset();
    vi.mocked(showToast).mockReset();
  });

  it('parks every open item of the checked selection, then clears it and reloads', async () => {
    const { actions, shipGroup, loadOrder, selectedShipGroupItems } = setup(true, [item('01', 'ITEM_APPROVED'), item('02', 'ITEM_CANCELLED'), item('03', 'ITEM_APPROVED')], ['01', '02']);
    dismissModalWith({ data: 'PARKING_1' });

    await actions.parkSelectedItems(shipGroup);

    expect(calls()).toEqual([
      { url: 'oms/orders/O1/moveItemToParking', data: { orderId: 'O1', orderItemSeqId: '01', shipGroupSeqId: '00001', toFacilityId: 'PARKING_1' } },
    ]);
    expect(selectedShipGroupItems.value['00001']).toEqual([]);
    expect(showToast).toHaveBeenCalledWith('Items moved to parking.');
    expect(loadOrder).toHaveBeenCalledWith('O1', true);
  });

  it('pulls back the open items in one reject call with the chosen reason', async () => {
    const { actions, shipGroup } = setup(false, [item('01', 'ITEM_APPROVED'), item('02', 'ITEM_COMPLETED'), item('03', 'ITEM_APPROVED')]);
    dismissModalWith({ role: 'confirm', data: { rejectionReasonId: 'REJ_RSN_DAMAGED' } });

    await actions.rejectSelectedItems(shipGroup);

    expect(calls()).toEqual([{
      url: 'oms/orders/O1/reject',
      data: {
        orderId: 'O1',
        items: [
          { orderItemSeqId: '01', quantity: '1', rejectionReasonId: 'REJ_RSN_DAMAGED' },
          { orderItemSeqId: '03', quantity: '1', rejectionReasonId: 'REJ_RSN_DAMAGED' },
        ],
      },
    }]);
  });

  it('releases only items still before fulfillment, one allocation each', async () => {
    const { actions, shipGroup } = setup(true, [item('01', 'ITEM_APPROVED'), item('02', 'ITEM_COMPLETED'), item('03', 'ITEM_REJECTED')]);
    dismissModalWith({ data: 'BROADWAY' });

    await actions.releaseSelectedItems(shipGroup);

    const release = { facilityId: 'BROADWAY', orderFacilityChange: { changeReasonEnumId: 'RELEASED' } };
    expect(calls()).toEqual([
      { url: 'oms/orders/O1/items/01/allocation', data: release },
      { url: 'oms/orders/O1/items/03/allocation', data: release },
    ]);
    expect(showToast).toHaveBeenCalledWith('Items released to facility.');
  });

  it('does nothing when the operator backs out of the prompt', async () => {
    const { actions, shipGroup, loadOrder, selectedShipGroupItems } = setup(false, [item('01', 'ITEM_APPROVED')], ['01']);
    dismissModalWith({ role: 'cancel' });

    await actions.rejectSelectedItems(shipGroup);

    expect(api).not.toHaveBeenCalled();
    expect(loadOrder).not.toHaveBeenCalled();
    expect(selectedShipGroupItems.value['00001']).toEqual(['01']);
  });

  it('keeps the selection and reports the failure when the call fails', async () => {
    const { actions, shipGroup, loadOrder, selectedShipGroupItems } = setup(true, [item('01', 'ITEM_APPROVED')], ['01']);
    dismissModalWith({ data: 'PARKING_1' });
    vi.mocked(api).mockRejectedValue(new Error('boom'));

    await actions.parkSelectedItems(shipGroup);

    expect(showToast).toHaveBeenCalledWith('Failed to park items. Please try again.');
    expect(loadOrder).not.toHaveBeenCalled();
    expect(selectedShipGroupItems.value['00001']).toEqual(['01']);
  });

  it('refuses without prompting when the validator does', async () => {
    // A physical group cannot be parked; the dual button shows Pull back there.
    const { actions, shipGroup } = setup(false, [item('01', 'ITEM_APPROVED')]);

    await actions.parkSelectedItems(shipGroup);

    expect(modalController.create).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Items can only be parked from a virtual/brokering facility.');
  });
});
