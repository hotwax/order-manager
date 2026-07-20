<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/orders" />
        </ion-buttons>
        <ion-title>{{ translate("Create return") }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div v-if="loading" class="state-container ion-text-center ion-padding">
        <ion-spinner />
        <p>{{ translate("Loading order details...") }}</p>
      </div>

      <div v-else-if="loadError" class="state-container ion-text-center ion-padding">
        <ion-text color="danger">
          <p role="alert">
            {{ loadError }}
          </p>
        </ion-text>
        <ion-button fill="outline" @click="loadPage">
          {{ translate("Try again") }}
        </ion-button>
      </div>

      <div v-else-if="order" class="create-return-container">
        <ion-card class="order-header-card">
          <ion-card-content>
            <p class="overline">
              {{ translate("Order") }}
            </p>
            <h2>{{ order.orderName || order.orderId }}</h2>
            <p v-if="order.orderName && order.orderName !== order.orderId">
              {{ translate("Order ID") }}: {{ order.orderId }}
            </p>
          </ion-card-content>
        </ion-card>

        <ion-card class="items-card">
          <ion-card-header>
            <ion-card-title>{{ translate("Select items to return") }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list v-if="eligibleItems.length">
              <ion-item
                v-for="item in eligibleItems"
                :key="item.orderItemSeqId"
                class="returnable-item"
                lines="full"
              >
                <ion-checkbox
                  slot="start"
                  :checked="getItemSelection(item.orderItemSeqId).selected"
                  :aria-label="`${translate('Select')} ${item.productName || item.sku || item.productId}`"
                  @ion-change="toggleItemSelection(item.orderItemSeqId, $event.detail.checked)"
                />

                <ion-label class="ion-text-wrap">
                  <h2>{{ item.productName || item.sku || item.productId }}</h2>
                  <p>{{ translate("SKU") }}: {{ item.sku || item.productId }}</p>
                  <p v-if="item.sku && item.productId && item.sku !== item.productId">
                    {{ translate("Product ID") }}: {{ item.productId }}
                  </p>
                  <div class="quantity-summary">
                    <span>{{ translate("Ordered") }}: {{ item.orderedQty }}</span>
                    <span>{{ translate("Already returned") }}: {{ item.alreadyReturnedQty }}</span>
                    <span>{{ translate("Remaining") }}: {{ item.returnableQty }}</span>
                  </div>
                  <p class="price">
                    {{ formatCurrency(item.unitPrice) }}
                  </p>

                  <div
                    v-if="getItemSelection(item.orderItemSeqId).selected"
                    class="item-controls"
                  >
                    <ion-select
                      :label="translate('Quantity')"
                      label-placement="stacked"
                      fill="outline"
                      :value="getItemSelection(item.orderItemSeqId).returnQuantity"
                      @ion-change="updateQuantity(item.orderItemSeqId, Number($event.detail.value))"
                    >
                      <ion-select-option
                        v-for="quantity in getQuantityOptions(item.returnableQty)"
                        :key="quantity"
                        :value="quantity"
                      >
                        {{ quantity }}
                      </ion-select-option>
                    </ion-select>

                    <ion-select
                      :label="translate('Return reason')"
                      label-placement="stacked"
                      fill="outline"
                      :value="getItemSelection(item.orderItemSeqId).returnReasonId"
                      :disabled="!returnReasons.length"
                      @ion-change="updateReason(item.orderItemSeqId, $event.detail.value)"
                    >
                      <ion-select-option
                        v-for="reason in returnReasons"
                        :key="reason.returnReasonId"
                        :value="reason.returnReasonId"
                      >
                        {{ reason.description }}
                      </ion-select-option>
                    </ion-select>
                  </div>
                </ion-label>
              </ion-item>
            </ion-list>

            <div v-else class="state-container ion-text-center ion-padding">
              <p>{{ translate("No items remain available to return for this order.") }}</p>
            </div>

            <ion-text v-if="eligibleItems.length && !returnReasons.length" color="danger">
              <p role="alert" class="inline-error">
                {{ translate("Return reasons are unavailable. Try again before creating a return.") }}
              </p>
            </ion-text>
          </ion-card-content>
        </ion-card>

        <ion-card v-if="eligibleItems.length" class="summary-card">
          <ion-card-header>
            <ion-card-title>{{ translate("Return summary") }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div class="summary-row">
              <span>{{ translate("Selected items") }}:</span>
              <strong>{{ selectedItemCount }}</strong>
            </div>
            <div class="summary-row total">
              <span>{{ translate("Estimated refund") }}:</span>
              <strong>{{ formatCurrency(estimatedRefundSubtotal) }}</strong>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-text v-if="submitError" color="danger">
          <p role="alert" class="submit-error ion-padding-horizontal">
            {{ submitError }}
          </p>
        </ion-text>
      </div>

      <div v-else class="state-container ion-text-center ion-padding">
        <p>{{ translate("Order not found.") }}</p>
      </div>
    </ion-content>

    <ion-footer v-if="order && eligibleItems.length">
      <ion-toolbar>
        <ion-buttons slot="end">
          <ion-button
            fill="solid"
            color="primary"
            :disabled="!canSubmit"
            @click="submitReturn"
          >
            <ion-spinner v-if="submitting" name="crescent" />
            <span v-else>{{ translate("CREATE RETURN") }}</span>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { translate } from "@common";
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonContent,
  IonFooter,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/vue";
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import router from "@/router";
import { createReturn, getOrderForReturn, listReturnReasons } from "@/services/returns";
import type { OrderForReturn, ReturnItemInput, ReturnReason } from "@/types/returns";

interface ItemState {
  selected: boolean;
  returnQuantity: number;
  returnReasonId: string;
}

const route = useRoute();
const orderId = computed(() => String(route.params.orderId || ""));

const loading = ref(true);
const submitting = ref(false);
const loadError = ref("");
const submitError = ref("");
const order = ref<OrderForReturn | null>(null);
const returnReasons = ref<ReturnReason[]>([]);
const itemSelections = ref<Record<string, ItemState>>({});

const eligibleItems = computed(() =>
  (order.value?.items || []).filter((item) => item.returnableQty > 0),);

function getItemSelection(orderItemSeqId: string): ItemState {
  if(!itemSelections.value[orderItemSeqId]) {
    itemSelections.value[orderItemSeqId] = {
      selected: false,
      returnQuantity: 1,
      returnReasonId: "",
    };
  }

  return itemSelections.value[orderItemSeqId];
}

function toggleItemSelection(orderItemSeqId: string, checked: boolean) {
  getItemSelection(orderItemSeqId).selected = checked;
  submitError.value = "";
}

function updateQuantity(orderItemSeqId: string, quantity: number) {
  getItemSelection(orderItemSeqId).returnQuantity = quantity;
  submitError.value = "";
}

function updateReason(orderItemSeqId: string, reasonId: string) {
  getItemSelection(orderItemSeqId).returnReasonId = reasonId || "";
  submitError.value = "";
}

function getQuantityOptions(returnableQty: number): number[] {
  const maximum = Math.max(0, Math.floor(returnableQty));

  return Array.from({ length: maximum }, (_, index) => index + 1);
}

const selectedItems = computed(() => eligibleItems.value.filter((item) =>
  itemSelections.value[item.orderItemSeqId]?.selected,));

const selectedItemCount = computed(() => selectedItems.value.length);

const validReasonIds = computed(() => new Set(returnReasons.value.map((reason) => reason.returnReasonId),));

const selectionsAreValid = computed(() => selectedItems.value.every((item) => {
  const selection = itemSelections.value[item.orderItemSeqId];

  return Number.isInteger(selection.returnQuantity) &&
    selection.returnQuantity >= 1 &&
    selection.returnQuantity <= item.returnableQty &&
    validReasonIds.value.has(selection.returnReasonId);
}));

const canSubmit = computed(() =>
  !submitting.value &&
  selectedItems.value.length > 0 &&
  returnReasons.value.length > 0 &&
  selectionsAreValid.value,);

const estimatedRefundSubtotal = computed(() => selectedItems.value.reduce((sum, item) => {
  const selection = itemSelections.value[item.orderItemSeqId];

  return sum + item.unitPrice * selection.returnQuantity;
}, 0));

function formatCurrency(amount: number): string {
  const currency = order.value?.currencyUomId || "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(Number(amount) || 0);
  } catch {
    return `${currency} ${(Number(amount) || 0).toFixed(2)}`;
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function loadPage() {
  loading.value = true;
  loadError.value = "";
  submitError.value = "";
  order.value = null;
  returnReasons.value = [];
  itemSelections.value = {};

  try {
    if(!orderId.value) {throw new Error(translate("Order not found."));}
    const [loadedOrder, reasons] = await Promise.all([
      getOrderForReturn(orderId.value),
      listReturnReasons(),
    ]);
    order.value = loadedOrder;
    returnReasons.value = reasons.filter((reason) =>
      Boolean(reason.returnReasonId && reason.description),);
  } catch (error) {
    loadError.value = errorMessage(error, translate("Unable to load return details. Try again."));
  } finally {
    loading.value = false;
  }
}

async function submitReturn() {
  if(!canSubmit.value || !order.value) {return;}

  const items: ReturnItemInput[] = selectedItems.value.map((item) => {
    const selection = itemSelections.value[item.orderItemSeqId];

    return {
      orderItemSeqId: item.orderItemSeqId,
      returnQuantity: selection.returnQuantity,
      returnReasonId: selection.returnReasonId,
    };
  });

  submitting.value = true;
  submitError.value = "";
  try {
    const result = await createReturn({ orderId: order.value.orderId, items });
    if(!result.returnId) {throw new Error(translate("The return was created without a return ID."));}
    await router.push(`/returns/${result.returnId}`);
  } catch (error) {
    submitError.value = errorMessage(error, translate("Unable to create the return. Try again."));
  } finally {
    submitting.value = false;
  }
}

onMounted(loadPage);
</script>

<style scoped>
.create-return-container {
  padding: 16px;
}

.order-header-card,
.items-card,
.summary-card {
  margin-bottom: 16px;
}

.state-container {
  margin: 32px auto;
  max-width: 560px;
}

.returnable-item {
  --padding-top: 12px;
  --padding-bottom: 12px;
}

.quantity-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 8px;
  color: var(--ion-color-medium);
  font-size: 0.875rem;
}

.price {
  margin-top: 8px;
  font-weight: 600;
}

.item-controls {
  display: grid;
  grid-template-columns: minmax(120px, 0.35fr) minmax(220px, 1fr);
  gap: 12px;
  margin-top: 16px;
  width: 100%;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
}

.summary-row.total {
  border-top: 1px solid var(--ion-color-light-shade);
  margin-top: 8px;
  padding-top: 12px;
  font-size: 1.1em;
}

.inline-error,
.submit-error {
  margin-bottom: 16px;
}

@media (max-width: 767px) {
  .item-controls {
    grid-template-columns: 1fr;
  }
}
</style>
