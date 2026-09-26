import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { api } from '@common';
import { showToast } from '@/utils';
import { useOrderActions } from '@/composables/useOrderActions';
import type { EnrichedOrder, EnrichedOrderItem, EnrichedShipGroup } from '@/types/orderDetail';

vi.mock('@common', async (importOriginal) => ({ ...(await importOriginal<any>()), api: vi.fn() }));
vi.mock('@/utils', async (importOriginal) => ({ ...(await importOriginal<any>()), showToast: vi.fn() }));

const item = (orderItemSeqId: string, statusId: string) =>
  ({ orderItemSeqId, shipGroupSeqId: '00001', statusId, facilityId: 'F', productId: 'P', quantity: 1 }) as EnrichedOrderItem;

function setup(items: EnrichedOrderItem[] = [item('01', 'ITEM_APPROVED')]) {
  const shipGroup = {
    id: '00001', facilityId: 'F', isVirtual: false, items,
    shippingAddress: { contactMechId: 'CM_1' },
  } as unknown as EnrichedShipGroup;
  const order = {
    id: 'O1',
    statusId: 'ORDER_APPROVED',
    customer: { partyId: 'CUST_1' },
    shipGroups: [shipGroup],
    groupedItems: items.map((groupItem) => ({ externalId: groupItem.orderItemSeqId, items: [groupItem] })),
  } as unknown as EnrichedOrder;
  const loadOrder = vi.fn();
  const actions = useOrderActions({
    order: ref(order),
    loadOrder,
    selectedItemIds: ref(new Set<string>()),
    selectedShipGroupItems: ref({}),
    selectedSegment: ref('ship-groups'),
  });
  return { actions, shipGroup, loadOrder };
}

const address = { address1: '1 Main St', address2: '', city: 'Boston', postalCode: '02110', stateProvinceGeoId: 'MA', countryGeoId: 'USA' };

describe('ship group edits', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(api).mockReset().mockResolvedValue({ data: {} });
    vi.mocked(showToast).mockReset();
  });

  it('saves the fields, then closes the editor, confirms and reloads', async () => {
    const { actions, shipGroup, loadOrder } = setup();
    actions.setShipGroupEditor(shipGroup, 'gift');

    await actions.saveShipGroupFields(shipGroup, { fields: { giftMessage: 'Happy birthday' }, success: 'Gift message saved.', failure: 'Failed to save gift message.' });

    expect(vi.mocked(api).mock.calls[0][0]).toMatchObject({ url: 'oms/orders/O1/shipGroups/00001', method: 'PUT', data: { giftMessage: 'Happy birthday' } });
    expect(actions.shipGroupEditor(shipGroup)).toBeNull();
    expect(showToast).toHaveBeenCalledWith('Gift message saved.');
    expect(loadOrder).toHaveBeenCalledWith('O1', true);
    expect(actions.savingShipGroupId.value).toBe('');
  });

  it('keeps the editor and its draft open when the save fails', async () => {
    const { actions, shipGroup, loadOrder } = setup();
    actions.setShipGroupEditor(shipGroup, 'instructions');
    vi.mocked(api).mockRejectedValue(new Error('boom'));

    await actions.saveShipGroupFields(shipGroup, { fields: { shippingInstructions: 'Leave at door' }, success: 'Instructions saved.', failure: 'Failed to save instructions.' });

    expect(actions.shipGroupEditor(shipGroup)).toBe('instructions');
    expect(showToast).toHaveBeenCalledWith('Failed to save instructions.');
    expect(loadOrder).not.toHaveBeenCalled();
    expect(actions.savingShipGroupId.value).toBe('');
  });

  it('marks the ship group as saving while the call is in flight', async () => {
    const { actions, shipGroup } = setup();
    let seenWhileSaving = '';
    vi.mocked(api).mockImplementation(async () => { seenWhileSaving = actions.savingShipGroupId.value; return { data: {} }; });

    await actions.saveShipGroupFields(shipGroup, { fields: { giftMessage: null }, success: 'Gift message cleared.', failure: 'Failed to clear gift message.' });

    expect(seenWhileSaving).toBe('00001');
  });

  it('saves the address against the placing customer and the group\'s contact mech', async () => {
    const { actions, shipGroup } = setup();
    actions.setShipGroupEditor(shipGroup, 'address');

    await actions.saveShippingAddress(shipGroup, address);

    expect(vi.mocked(api).mock.calls[0][0]).toMatchObject({
      url: 'oms/orders/O1/shipGroups/00001/shippingInformation',
      method: 'PUT',
      data: { ...address, partyId: 'CUST_1', contactMechId: 'CM_1', contactMechPurposeTypeId: 'SHIPPING_LOCATION', isEdited: true },
    });
    expect(actions.shipGroupEditor(shipGroup)).toBeNull();
    expect(showToast).toHaveBeenCalledWith('Shipping address updated successfully.');
  });

  it('asks the validator again before saving an address, since the group can settle while the editor is open', async () => {
    const { actions, shipGroup } = setup([item('01', 'ITEM_CANCELLED')]);
    actions.setShipGroupEditor(shipGroup, 'address');

    await actions.saveShippingAddress(shipGroup, address);

    expect(api).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Every item in this ship group has been cancelled or completed.');
    expect(actions.shipGroupEditor(shipGroup)).toBe('address');
  });

  it('opens one editor at a time, scoped to its ship group', () => {
    const { actions, shipGroup } = setup();
    const other = { ...shipGroup, id: '00002' } as EnrichedShipGroup;

    actions.setShipGroupEditor(shipGroup, 'shippingDates');
    expect(actions.shipGroupEditor(shipGroup)).toBe('shippingDates');
    expect(actions.shipGroupEditor(other)).toBeNull();

    actions.setShipGroupEditor(other, 'gift');
    expect(actions.shipGroupEditor(shipGroup)).toBeNull();
    expect(actions.shipGroupEditor(other)).toBe('gift');
  });
});
