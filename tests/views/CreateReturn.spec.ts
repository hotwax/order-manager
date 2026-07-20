import { readFileSync } from "fs";
import { resolve } from "path";
import { type VueWrapper, flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateReturn from "@/views/CreateReturn.vue";

const serviceMocks = vi.hoisted(() => ({
  getOrderForReturn: vi.fn(),
  listReturnReasons: vi.fn(),
  createReturn: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock("@/services/returns", () => ({
  getOrderForReturn: serviceMocks.getOrderForReturn,
  listReturnReasons: serviceMocks.listReturnReasons,
  createReturn: serviceMocks.createReturn,
}));

vi.mock("@/router", () => ({
  default: { push: serviceMocks.routerPush },
}));

vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { orderId: "100" } }),
}));

vi.mock("@common", () => ({
  translate: (value: string) => value,
}));

vi.mock("@ionic/vue", async () => {
  const { defineComponent, h } = await import("vue");
  const stub = (name: string, tag = "div") => defineComponent({
    name,
    inheritAttrs: false,
    props: {
      checked: Boolean,
      disabled: Boolean,
      label: { type: String, default: undefined },
      value: { type: [String, Number], default: undefined },
    },
    emits: ["ionChange"],
    setup(props, { attrs, slots }) {
      return () => h(tag, {
        ...attrs,
        disabled: props.disabled || undefined,
      }, slots.default?.());
    },
  });

  return {
    IonBackButton: stub("IonBackButton"),
    IonButton: stub("IonButton", "button"),
    IonButtons: stub("IonButtons"),
    IonCard: stub("IonCard"),
    IonCardContent: stub("IonCardContent"),
    IonCardHeader: stub("IonCardHeader"),
    IonCardTitle: stub("IonCardTitle"),
    IonCheckbox: stub("IonCheckbox", "input"),
    IonContent: stub("IonContent"),
    IonFooter: stub("IonFooter"),
    IonHeader: stub("IonHeader"),
    IonItem: stub("IonItem"),
    IonLabel: stub("IonLabel"),
    IonList: stub("IonList"),
    IonPage: stub("IonPage"),
    IonSelect: stub("IonSelect"),
    IonSelectOption: stub("IonSelectOption"),
    IonSpinner: stub("IonSpinner"),
    IonText: stub("IonText"),
    IonTitle: stub("IonTitle"),
    IonToolbar: stub("IonToolbar"),
  };
});

const order = {
  orderId: "100",
  orderName: "#1001",
  currencyUomId: "CAD",
  items: [
    {
      orderItemSeqId: "00001",
      productId: "PRODUCT_1",
      productName: "Canvas sneaker",
      sku: "SKU-RED-8",
      orderedQty: 3,
      alreadyReturnedQty: 1,
      returnableQty: 2,
      unitPrice: 20,
    },
    {
      orderItemSeqId: "00002",
      productId: "PRODUCT_2",
      productName: "Fully returned product",
      orderedQty: 1,
      alreadyReturnedQty: 1,
      returnableQty: 0,
      unitPrice: 15,
    },
  ],
};

const reasons = [
  { returnReasonId: "RTN_DAMAGED", description: "Damaged" },
  { returnReasonId: "RTN_UNWANTED", description: "No longer wanted" },
];

async function mountLoaded(): Promise<VueWrapper> {
  const wrapper = mount(CreateReturn);
  await flushPromises();

  return wrapper;
}

function createButton(wrapper: VueWrapper) {
  const button = wrapper.findAllComponents({ name: "IonButton" })
    .find((candidate) => candidate.text().includes("CREATE RETURN"));
  if(!button) {throw new Error("Create return button was not rendered");}

  return button;
}

async function selectFirstLine(wrapper: VueWrapper, reasonId = "RTN_DAMAGED") {
  await wrapper.findComponent({ name: "IonCheckbox" }).vm.$emit("ionChange", {
    detail: { checked: true },
  });
  await wrapper.vm.$nextTick();

  const reasonSelect = wrapper.findAllComponents({ name: "IonSelect" })
    .find((select) => select.props("label") === "Return reason");
  if(!reasonSelect) {throw new Error("Return reason select was not rendered");}
  await reasonSelect.vm.$emit("ionChange", { detail: { value: reasonId } });
  await wrapper.vm.$nextTick();
}

describe("CreateReturn View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.getOrderForReturn.mockResolvedValue(order);
    serviceMocks.listReturnReasons.mockResolvedValue(reasons);
    serviceMocks.createReturn.mockResolvedValue({ returnId: "R100" });
    serviceMocks.routerPush.mockResolvedValue(undefined);
  });

  it("uses the P1 return APIs and omits store, appeasement, and default reasons", () => {
    const source = readFileSync(resolve(process.cwd(), "src/views/CreateReturn.vue"), "utf8");

    expect(source).toContain("getOrderForReturn(orderId.value)");
    expect(source).toContain("listReturnReasons()");
    expect(source).toContain("createReturn({ orderId: order.value.orderId, items })");
    expect(source).toContain("ref<OrderForReturn | null>(null)");
    expect(source).not.toContain("useOrderDetailStore");
    expect(source).not.toContain("includeAppeasement");
    expect(source).not.toContain("RTN_NOT_WANTED");
    expect(source).not.toContain("Appeasement");
  });

  it("renders only returnable lines with quantities, SKU, product, and currency", async () => {
    const wrapper = await mountLoaded();
    const expectedPrice = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "CAD",
    }).format(20);

    expect(serviceMocks.getOrderForReturn).toHaveBeenCalledWith("100");
    expect(wrapper.text()).toContain("Canvas sneaker");
    expect(wrapper.text()).toContain("SKU-RED-8");
    expect(wrapper.text()).toContain("PRODUCT_1");
    expect(wrapper.text()).toContain("Ordered: 3");
    expect(wrapper.text()).toContain("Already returned: 1");
    expect(wrapper.text()).toContain("Remaining: 2");
    expect(wrapper.text()).toContain(expectedPrice);
    expect(wrapper.text()).not.toContain("Fully returned product");
  });

  it("renders a loading state while the order lookup is pending", () => {
    serviceMocks.getOrderForReturn.mockReturnValue(new Promise(() => undefined));
    const wrapper = mount(CreateReturn);

    expect(wrapper.text()).toContain("Loading order details...");
    expect(wrapper.findComponent({ name: "IonSpinner" }).exists()).toBe(true);
  });

  it("requires a selected line, an in-range quantity, and an API reason", async () => {
    const wrapper = await mountLoaded();
    expect(createButton(wrapper).props("disabled")).toBe(true);

    await wrapper.findComponent({ name: "IonCheckbox" }).vm.$emit("ionChange", {
      detail: { checked: true },
    });
    await wrapper.vm.$nextTick();
    expect(createButton(wrapper).props("disabled")).toBe(true);

    const selects = wrapper.findAllComponents({ name: "IonSelect" });
    const quantitySelect = selects.find((select) => select.props("label") === "Quantity");
    const reasonSelect = selects.find((select) => select.props("label") === "Return reason");
    expect(quantitySelect).toBeDefined();
    expect(reasonSelect).toBeDefined();

    await reasonSelect!.vm.$emit("ionChange", { detail: { value: "NOT_FROM_API" } });
    await wrapper.vm.$nextTick();
    expect(createButton(wrapper).props("disabled")).toBe(true);

    await reasonSelect!.vm.$emit("ionChange", { detail: { value: "RTN_DAMAGED" } });
    await quantitySelect!.vm.$emit("ionChange", { detail: { value: 3 } });
    await wrapper.vm.$nextTick();
    expect(createButton(wrapper).props("disabled")).toBe(true);

    await quantitySelect!.vm.$emit("ionChange", { detail: { value: 2 } });
    await wrapper.vm.$nextTick();
    expect(createButton(wrapper).props("disabled")).toBe(false);
  });

  it("does not invent a reason when the API returns none", async () => {
    serviceMocks.listReturnReasons.mockResolvedValue([]);
    const wrapper = await mountLoaded();

    expect(wrapper.text()).toContain("Return reasons are unavailable");
    expect(wrapper.findAllComponents({ name: "IonSelectOption" })).toHaveLength(0);
    await wrapper.findComponent({ name: "IonCheckbox" }).vm.$emit("ionChange", {
      detail: { checked: true },
    });
    await wrapper.vm.$nextTick();
    expect(createButton(wrapper).props("disabled")).toBe(true);
  });

  it("locks duplicate submits and navigates to the created return", async () => {
    let resolveCreate!: (value: { returnId: string }) => void;
    serviceMocks.createReturn.mockReturnValue(new Promise((resolvePromise) => {
      resolveCreate = resolvePromise;
    }));
    const wrapper = await mountLoaded();
    await selectFirstLine(wrapper);

    const button = createButton(wrapper);
    await button.trigger("click");
    await button.trigger("click");
    expect(serviceMocks.createReturn).toHaveBeenCalledTimes(1);
    expect(serviceMocks.createReturn).toHaveBeenCalledWith({
      orderId: "100",
      items: [{
        orderItemSeqId: "00001",
        returnQuantity: 1,
        returnReasonId: "RTN_DAMAGED",
      }],
    });
    expect(button.props("disabled")).toBe(true);

    resolveCreate({ returnId: "R500" });
    await flushPromises();
    expect(serviceMocks.routerPush).toHaveBeenCalledWith("/returns/R500");
  });

  it("shows submit errors and preserves the operator's selection", async () => {
    serviceMocks.createReturn.mockRejectedValueOnce(new Error("Backend refused return"));
    const wrapper = await mountLoaded();
    await selectFirstLine(wrapper, "RTN_UNWANTED");

    await createButton(wrapper).trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Backend refused return");
    expect(wrapper.findComponent({ name: "IonCheckbox" }).props("checked")).toBe(true);
    expect(wrapper.findAllComponents({ name: "IonSelect" })).toHaveLength(2);
    expect(createButton(wrapper).props("disabled")).toBe(false);
    expect(serviceMocks.routerPush).not.toHaveBeenCalled();
  });

  it("renders load errors and the no-returnable state", async () => {
    serviceMocks.getOrderForReturn.mockRejectedValueOnce(new Error("Order lookup failed"));
    const errorWrapper = await mountLoaded();
    expect(errorWrapper.text()).toContain("Order lookup failed");
    expect(errorWrapper.text()).toContain("Try again");

    serviceMocks.getOrderForReturn.mockResolvedValueOnce({ ...order, items: [order.items[1]] });
    const emptyWrapper = await mountLoaded();
    expect(emptyWrapper.text()).toContain("No items remain available to return");
    expect(emptyWrapper.findAllComponents({ name: "IonCheckbox" })).toHaveLength(0);
  });
});
