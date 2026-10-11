import { modalController } from "@ionic/vue";
import { flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { useOrderActions } from "@/composables/useOrderActions";
import type { EnrichedOrder, EnrichedOrderItem, EnrichedShipGroup } from "@/types/orderDetail";

vi.mock("@ionic/vue", async (importOriginal) => ({ ...(await importOriginal<any>()), modalController: { create: vi.fn() }, alertController: { create: vi.fn() } }));
vi.mock("@/utils", async (importOriginal) => ({ ...(await importOriginal<any>()), showToast: vi.fn() }));

/** One item at a real store, and one parked at a virtual location. */
const shipGroups = [
  { id: "00001", facilityId: "STORE_A", isVirtual: false },
  { id: "00002", facilityId: "PARKING", isVirtual: true },
] as EnrichedShipGroup[];
const items = [
  { orderItemSeqId: "01", shipGroupSeqId: "00001", facilityId: "STORE_A", statusId: "ITEM_APPROVED", productId: "P1", quantity: 1 },
  { orderItemSeqId: "02", shipGroupSeqId: "00002", facilityId: "PARKING", statusId: "ITEM_APPROVED", productId: "P2", quantity: 1 },
] as EnrichedOrderItem[];

function setup() {
  const order = {
    id: "O1",
    statusId: "ORDER_APPROVED",
    shipGroups: shipGroups.map((shipGroup) => ({ ...shipGroup, items: items.filter((entry) => entry.shipGroupSeqId === shipGroup.id) })),
    groupedItems: items.map((groupItem) => ({ externalId: groupItem.orderItemSeqId, items: [groupItem] })),
  } as unknown as EnrichedOrder;

  return useOrderActions({
    order: ref(order),
    loadOrder: vi.fn(),
    selectedItemIds: ref(new Set<string>()),
    selectedShipGroupItems: ref({}),
    selectedSegment: ref("items"),
    canRequestInventoryTransfer: ref(true),
  });
}

/** The props the facility picker opened with, after the user closes it without choosing. */
async function pickerProps(open: () => Promise<unknown>) {
  vi.mocked(modalController.create).mockResolvedValueOnce({ present: vi.fn(), onWillDismiss: vi.fn().mockResolvedValue({ data: undefined }) } as any);
  await open();
  await flushPromises();

  return (vi.mocked(modalController.create).mock.calls.at(-1)?.[0] as any)?.componentProps;
}

describe("facility picker current facility", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(modalController.create).mockReset();
  });

  it("pins the store an item is at, so moving it starts from where it is", async () => {
    const actions = setup();
    const props = await pickerProps(() => actions.rejectAndReleaseItem(items[0]));
    expect(modalController.create).toHaveBeenCalledTimes(1);
    expect(props.currentFacilityId).toBe("STORE_A");
  });

  it("pins nothing for an item in a virtual location, where every facility is a choice", async () => {
    const actions = setup();
    const props = await pickerProps(() => actions.rejectAndReleaseItem(items[1]));
    expect(modalController.create).toHaveBeenCalledTimes(1);
    expect(props.items.map((entry: any) => entry.orderItemSeqId)).toEqual(["02"]);
    expect(props.currentFacilityId).toBeUndefined();
  });
});
