/* eslint-disable vue/one-component-per-file, vue/require-prop-types */
import { readFileSync } from "fs";
import { resolve } from "path";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick } from "vue";
import type { ReturnDetail } from "@/types/returns";
import ReturnDetailView from "@/views/ReturnDetail.vue";

const returnsService = vi.hoisted(() => ({
  getReturn: vi.fn(),
  approveReturn: vi.fn(),
  pushToShopify: vi.fn(),
}));

vi.mock("@/services/returns", () => returnsService);
vi.mock("@/components/common/EmptyState.vue", () => ({
  default: { props: ["title", "message"], template: "<div>{{ title }}: {{ message }}</div>" },
}));
vi.mock("@/components/common/ErrorState.vue", () => ({
  default: { props: ["title", "message"], template: "<div role=\"alert\">{{ title }}: {{ message }}</div>" },
}));
vi.mock("@/store/seed", () => ({
  useSeedStore: () => ({
    describe: (value: string) => ({
      RETURN_REQUESTED: "Requested",
      RETURN_ACCEPTED: "Accepted",
      RTN_DEFECTIVE: "Defective",
    }[value] || value),
  }),
}));
vi.mock("@/store/user", () => ({
  useUserStore: () => ({ hasPermission: () => true }),
}));

const LayoutStub = defineComponent({ template: "<div><slot /></div>" });
const ButtonStub = defineComponent({
  inheritAttrs: false,
  props: { disabled: Boolean },
  emits: ["click"],
  template: "<button v-bind=\"$attrs\" :disabled=\"disabled\" @click=\"$emit('click')\"><slot /></button>",
});
const ErrorStateStub = defineComponent({
  props: ["title", "message"],
  template: "<div role=\"alert\">{{ title }}: {{ message }}</div>",
});
const EmptyStateStub = defineComponent({
  props: ["title", "message"],
  template: "<div>{{ title }}: {{ message }}</div>",
});

function makeReturn(overrides: Partial<ReturnDetail> = {}): ReturnDetail {
  return {
    returnId: "RMA-1001",
    fromPartyId: "CUST-1",
    orderId: "11492",
    orderName: "#11492",
    statusId: "RETURN_REQUESTED",
    entryDate: "2026-07-20T10:00:00.000Z",
    origin: "pwa",
    sync: { shopify: "not_synced" },
    shopifySync: null,
    items: [{
      orderItemSeqId: "00001",
      productId: "SKU-RED",
      productName: "Red shirt",
      sku: "RED-SHIRT-M",
      returnQuantity: 2,
      returnReasonId: "RTN_DEFECTIVE",
      returnReasonDesc: "Damaged on arrival",
    }],
    statuses: [{ statusId: "RETURN_REQUESTED", statusDate: "2026-07-20T10:00:00.000Z" }],
    externalIds: { shopify: null },
    type: "standard",
    ...overrides,
  };
}

function mountView() {
  return mount(ReturnDetailView, {
    props: { returnId: "RMA-1001" },
    global: {
      stubs: {
        IonBackButton: true,
        IonButton: ButtonStub,
        IonButtons: LayoutStub,
        IonCard: LayoutStub,
        IonCardContent: LayoutStub,
        IonCardHeader: LayoutStub,
        IonCardSubtitle: LayoutStub,
        IonCardTitle: LayoutStub,
        IonContent: LayoutStub,
        IonHeader: LayoutStub,
        IonIcon: true,
        IonItem: LayoutStub,
        IonLabel: LayoutStub,
        IonList: LayoutStub,
        IonListHeader: LayoutStub,
        IonMenuButton: true,
        IonPage: LayoutStub,
        IonProgressBar: true,
        IonTitle: LayoutStub,
        IonToolbar: LayoutStub,
        EmptyState: EmptyStateStub,
        ErrorState: ErrorStateStub,
      },
    },
  });
}

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  returnsService.approveReturn.mockResolvedValue(undefined);
  returnsService.pushToShopify.mockResolvedValue("pushed");
});

describe("ReturnDetail P1", () => {
  it("loads rich return detail and renders the source order, returned items, status, audit, and Shopify ID", async () => {
    returnsService.getReturn.mockResolvedValue(makeReturn({
      statusId: "RETURN_ACCEPTED",
      sync: { shopify: "synced" },
      externalIds: { shopify: "gid://shopify/Return/123" },
      shopifySync: {
        synced: true,
        shopifyReturnId: "gid://shopify/Return/123",
        lastSyncedDate: "2026-07-20T10:05:00.000Z",
      },
    }));

    const wrapper = mountView();
    await flushPromises();

    expect(returnsService.getReturn).toHaveBeenCalledWith("RMA-1001");
    expect(wrapper.text()).toContain("RMA-1001");
    expect(wrapper.text()).toContain("#11492");
    expect(wrapper.text()).toContain("Red shirt");
    expect(wrapper.text()).toContain("Quantity: 2");
    expect(wrapper.text()).toContain("Reason: Damaged on arrival");
    expect(wrapper.text()).toContain("Accepted");
    expect(wrapper.text()).toContain("Audit trail");
    expect(wrapper.text()).toContain("Confirmed in Shopify");
    expect(wrapper.text()).toContain("gid://shopify/Return/123");
  });

  it("labels a return without a source order as a blind return", async () => {
    returnsService.getReturn.mockResolvedValue(makeReturn({ orderId: "", orderName: "" }));

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("Blind return");
  });

  it("locks duplicate approval clicks and trusts only the fresh detail read for Shopify confirmation", async () => {
    let resolveApproval!: () => void;
    returnsService.approveReturn.mockReturnValue(new Promise<void>((resolve) => {
      resolveApproval = resolve;
    }));
    returnsService.getReturn
      .mockResolvedValueOnce(makeReturn())
      .mockResolvedValueOnce(makeReturn({
        statusId: "RETURN_ACCEPTED",
        sync: { shopify: "synced" },
        externalIds: { shopify: "gid://shopify/Return/456" },
        shopifySync: { synced: true, shopifyReturnId: "gid://shopify/Return/456" },
      }));

    const wrapper = mountView();
    await flushPromises();
    const approve = wrapper.get("[data-testid=\"approve-return\"]");

    await approve.trigger("click");
    await approve.trigger("click");
    expect(returnsService.approveReturn).toHaveBeenCalledTimes(1);
    expect(approve.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("Approving…");

    resolveApproval();
    await flushPromises();

    expect(returnsService.getReturn).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("Confirmed in Shopify");
    expect(wrapper.text()).toContain("gid://shopify/Return/456");
    expect(wrapper.find("[data-testid=\"approve-return\"]").exists()).toBe(false);
  });

  it("offers manual retry only for a fresh failed accepted PWA return and confirms via a fresh read", async () => {
    returnsService.getReturn
      .mockResolvedValueOnce(makeReturn({
        statusId: "RETURN_ACCEPTED",
        sync: { shopify: "failed" },
        shopifySync: { synced: false, pushStatusId: "PUSH_FAILED", pushErrorMessage: "Temporary Shopify failure" },
      }))
      .mockResolvedValueOnce(makeReturn({
        statusId: "RETURN_ACCEPTED",
        sync: { shopify: "synced" },
        externalIds: { shopify: "gid://shopify/Return/789" },
        shopifySync: { synced: true, shopifyReturnId: "gid://shopify/Return/789" },
      }));

    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain("Sync failed");
    expect(wrapper.text()).toContain("Temporary Shopify failure");

    await wrapper.get("[data-testid=\"retry-shopify-push\"]").trigger("click");
    await flushPromises();

    expect(returnsService.pushToShopify).toHaveBeenCalledWith("RMA-1001");
    expect(returnsService.getReturn).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("Confirmed in Shopify");
    expect(wrapper.text()).toContain("gid://shopify/Return/789");
  });

  it("does not expose manual push while requested, pending, synced, Shopify-originated, or exchange", async () => {
    const blockedStates = [
      makeReturn(),
      makeReturn({ statusId: "RETURN_ACCEPTED", sync: { shopify: "pending" } }),
      makeReturn({ statusId: "RETURN_ACCEPTED", sync: { shopify: "synced" } }),
      makeReturn({ statusId: "RETURN_ACCEPTED", origin: "shopify", sync: { shopify: "failed" } }),
      makeReturn({ statusId: "RETURN_ACCEPTED", isExchange: true, sync: { shopify: "failed" } }),
    ];

    for(const detail of blockedStates) {
      returnsService.getReturn.mockResolvedValueOnce(detail);
      const wrapper = mountView();
      await flushPromises();
      expect(wrapper.find("[data-testid=\"retry-shopify-push\"]").exists()).toBe(false);
      wrapper.unmount();
    }
  });

  it("gates return mutations with ORDER_RETURN_PERMISSION", () => {
    const source = readFileSync(resolve(process.cwd(), "src/views/ReturnDetail.vue"), "utf8");

    expect(source).toContain("userStore.hasPermission(ORDER_RETURN_PERMISSION)");
    expect(source).toContain("hasReturnPermission.value && returnRecord.value?.statusId");
    expect(source).toContain("!hasReturnPermission.value || !record");
  });

  it("surfaces action errors without discarding loaded return and audit data", async () => {
    returnsService.getReturn.mockResolvedValue(makeReturn());
    returnsService.approveReturn.mockRejectedValue(new Error("Approval unavailable"));

    const wrapper = mountView();
    await flushPromises();
    await wrapper.get("[data-testid=\"approve-return\"]").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Approval unavailable");
    expect(wrapper.text()).toContain("RMA-1001");
    expect(wrapper.text()).toContain("Audit trail");
    expect(wrapper.text()).toContain("Red shirt");
  });

  it("renders an initial load error", async () => {
    returnsService.getReturn.mockRejectedValue(new Error("Return API unavailable"));

    const wrapper = mountView();
    await flushPromises();
    await nextTick();

    expect(wrapper.text()).toContain("Return failed to load");
    expect(wrapper.text()).toContain("Return API unavailable");
  });
});
