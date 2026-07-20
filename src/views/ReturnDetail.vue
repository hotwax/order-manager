<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/returns" />
          <ion-menu-button />
        </ion-buttons>
        <ion-title>Return detail</ion-title>
      </ion-toolbar>
      <ion-progress-bar v-if="loading" type="indeterminate" />
    </ion-header>

    <ion-content v-if="returnRecord">
      <section class="return-detail ion-padding">
        <ion-card>
          <ion-card-header>
            <ion-card-subtitle>RMA</ion-card-subtitle>
            <ion-card-title>{{ rmaLabel }}</ion-card-title>
          </ion-card-header>
          <ion-list lines="full">
            <ion-item>
              <ion-label class="ion-text-wrap">
                <p class="overline">
                  Source order
                </p>
                <ion-button
                  v-if="returnRecord.orderId"
                  class="order-link"
                  fill="clear"
                  size="small"
                  :router-link="`/orders/${returnRecord.orderId}`"
                >
                  {{ sourceOrderLabel }}
                  <ion-icon slot="end" :icon="openOutline" />
                </ion-button>
                <p v-else>
                  Blind return
                </p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <p class="overline">
                  Requested
                </p>
                {{ formatLongDate(returnRecord.entryDate) }}
              </ion-label>
              <ion-label slot="end" class="ion-text-end">
                <p class="overline">
                  OMS status
                </p>
                {{ describe(returnRecord.statusId) }}
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card>

        <ion-card class="shopify-card">
          <ion-card-header>
            <ion-card-subtitle>Shopify confirmation</ion-card-subtitle>
            <ion-card-title>{{ syncLabel }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <dl class="detail-grid">
              <div>
                <dt>Shopify return ID</dt>
                <dd>{{ shopifyReturnId || 'Not assigned' }}</dd>
              </div>
              <div>
                <dt>Last attempt</dt>
                <dd>{{ formatOptionalDate(returnRecord.shopifySync?.lastAttemptDate) }}</dd>
              </div>
              <div>
                <dt>Last synced</dt>
                <dd>{{ formatOptionalDate(returnRecord.shopifySync?.lastSyncedDate) }}</dd>
              </div>
            </dl>
            <p v-if="returnRecord.shopifySync?.pushErrorMessage" class="sync-error" role="alert">
              {{ returnRecord.shopifySync.pushErrorMessage }}
            </p>
          </ion-card-content>
        </ion-card>

        <ion-list lines="full">
          <ion-list-header>
            <ion-label>Returned items</ion-label>
          </ion-list-header>
          <ion-item v-for="item in returnRecord.items" :key="item.orderItemSeqId">
            <ion-label class="ion-text-wrap">
              <h2>{{ item.productName || item.sku || item.productId || 'Return item' }}</h2>
              <p v-if="item.sku || item.productId">
                {{ item.sku || item.productId }}
              </p>
              <p>Quantity: {{ item.returnQuantity }}</p>
              <p>Reason: {{ item.returnReasonDesc || describe(item.returnReasonId) }}</p>
            </ion-label>
          </ion-item>
          <ion-item v-if="!returnRecord.items.length" lines="none">
            <ion-label>No returned items were provided.</ion-label>
          </ion-item>
        </ion-list>

        <ion-card v-if="returnRecord.statuses.length" class="audit-card">
          <ion-card-header>
            <ion-card-subtitle>Audit trail</ion-card-subtitle>
          </ion-card-header>
          <ion-list lines="full">
            <ion-item v-for="(status, index) in returnRecord.statuses" :key="`${status.statusId}-${status.statusDate}-${index}`">
              <ion-label>
                <h2>{{ describe(status.statusId) }}</h2>
                <p>{{ formatLongDate(status.statusDate) }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card>

        <p v-if="actionError" class="action-error" role="alert">
          {{ actionError }}
        </p>

        <div class="return-actions">
          <ion-button v-if="canApprove" data-testid="approve-return" :disabled="actionPending" @click="approve">
            {{ actionName === 'approve' ? 'Approving…' : 'Approve' }}
          </ion-button>
          <ion-button v-if="canRetryPush" data-testid="retry-shopify-push" fill="outline" :disabled="actionPending" @click="retryShopifyPush">
            {{ actionName === 'push' ? 'Sending…' : 'Retry Shopify push' }}
          </ion-button>
        </div>
      </section>
    </ion-content>

    <ion-content v-else-if="loading">
      <ion-list>
        <ion-item lines="none">
          <ion-label>Loading return...</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>

    <ion-content v-else-if="error">
      <ErrorState title="Return failed to load" :message="error" />
    </ion-content>

    <ion-content v-else>
      <EmptyState title="Return not found" message="The selected return is not available in this workspace." />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenuButton,
  IonPage,
  IonProgressBar,
  IonTitle,
  IonToolbar
} from "@ionic/vue";
import { openOutline } from "ionicons/icons";
import { DateTime } from "luxon";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import EmptyState from "@/components/common/EmptyState.vue";
import ErrorState from "@/components/common/ErrorState.vue";
import { ORDER_RETURN_PERMISSION } from "@/authorization/permissions";
import { approveReturn, getReturn, pushToShopify } from "@/services/returns";
import { useSeedStore } from "@/store/seed";
import { useUserStore } from "@/store/user";
import type { ReturnDetail } from "@/types/returns";

const props = defineProps<{
  returnId: string;
}>();

const seed = useSeedStore();
const userStore = useUserStore();
const returnRecord = ref<ReturnDetail>();
const loading = ref(false);
const error = ref("");
const actionError = ref("");
const actionName = ref<"" | "approve" | "push">("");
const actionPending = computed(() => actionName.value !== "");
const pollDelays = [500, 1000, 1500, 2000];
let requestVersion = 0;
let disposed = false;

const rmaLabel = computed(() => returnRecord.value?.returnId || props.returnId);
const sourceOrderLabel = computed(() => returnRecord.value?.orderName || `Order ${returnRecord.value?.orderId}`);
const shopifyReturnId = computed(() => returnRecord.value?.externalIds.shopify || returnRecord.value?.shopifySync?.shopifyReturnId || "");
const syncState = computed(() => returnRecord.value?.sync.shopify || "not_synced");
const syncLabel = computed(() => ({
  not_synced: "Not synced",
  pending: "Sync pending",
  synced: "Confirmed in Shopify",
  failed: "Sync failed"
}[syncState.value]));
const hasReturnPermission = computed(() => userStore.hasPermission(ORDER_RETURN_PERMISSION));
const canApprove = computed(() => hasReturnPermission.value && returnRecord.value?.statusId === "RETURN_REQUESTED");
const canRetryPush = computed(() => {
  const record = returnRecord.value;
  if(!hasReturnPermission.value || !record || record.type !== "standard" || record.origin !== "pwa" || record.isExchange) {return false;}
  const pushAllowedStatus = record.statusId === "RETURN_ACCEPTED" || record.statusId === "RETURN_APPROVED";

  return pushAllowedStatus && (record.sync.shopify === "not_synced" || record.sync.shopify === "failed");
});

onMounted(loadReturn);
watch(() => props.returnId, loadReturn);
onBeforeUnmount(() => {
  disposed = true;
  requestVersion += 1;
});

async function loadReturn() {
  const version = ++requestVersion;
  loading.value = true;
  error.value = "";
  actionError.value = "";
  actionName.value = "";
  try {
    const detail = await getReturn(props.returnId);
    if(!disposed && version === requestVersion) {returnRecord.value = detail;}
  } catch (returnError: any) {
    if(!disposed && version === requestVersion) {
      error.value = errorMessage(returnError, "Failed to load return");
      returnRecord.value = undefined;
    }
  } finally {
    if(!disposed && version === requestVersion) {loading.value = false;}
  }
}

async function approve() {
  if(!canApprove.value || actionPending.value) {return;}
  await runAction("approve", () => approveReturn(props.returnId));
}

async function retryShopifyPush() {
  if(!canRetryPush.value || actionPending.value) {return;}
  await runAction("push", () => pushToShopify(props.returnId));
}

async function runAction(name: "approve" | "push", mutation: () => Promise<unknown>) {
  actionName.value = name;
  actionError.value = "";
  const version = ++requestVersion;
  try {
    await mutation();
    await refreshAndPoll(version);
  } catch (returnError: any) {
    if(!disposed && version === requestVersion) {
      actionError.value = errorMessage(
        returnError,
        name === "approve" ? "Failed to approve return" : "Failed to send return to Shopify"
      );
    }
  } finally {
    if(!disposed && version === requestVersion) {actionName.value = "";}
  }
}

async function refreshAndPoll(version: number) {
  let detail = await getReturn(props.returnId);
  if(disposed || version !== requestVersion) {return;}
  returnRecord.value = detail;

  for(const delay of pollDelays) {
    if(detail.sync.shopify === "synced" || detail.sync.shopify === "failed") {return;}
    await wait(delay);
    if(disposed || version !== requestVersion) {return;}
    detail = await getReturn(props.returnId);
    if(disposed || version !== requestVersion) {return;}
    returnRecord.value = detail;
  }
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(value: any, fallback: string) {
  return value?.response?.data?.errors || value?.response?.data?.error || value?.message || fallback;
}

function describe(value?: string) {
  return value ? seed.describe(value) || value : "Not specified";
}

function parseDate(value?: string | number | null) {
  if(!value) {return undefined;}
  const stringValue = String(value);
  const numeric = Number(value);
  if(/^\d+$/.test(stringValue)) {
    return DateTime.fromMillis(stringValue.length <= 10 ? numeric * 1000 : numeric);
  }
  const isoDate = DateTime.fromISO(stringValue);

  return isoDate.isValid ? isoDate : DateTime.fromSQL(stringValue);
}

function formatLongDate(value?: string | number | null) {
  const date = parseDate(value);

  return date?.isValid ? date.toLocaleString(DateTime.DATE_MED) : String(value ?? "Not specified");
}

function formatOptionalDate(value?: string | number | null) {
  return value ? formatLongDate(value) : "Not available";
}
</script>

<style scoped>
.return-detail {
  display: grid;
  gap: 16px;
  max-width: 960px;
  margin: 0 auto;
}

.return-detail ion-card,
.return-detail ion-list {
  margin: 0;
}

.order-link {
  margin-left: -12px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin: 0;
}

.detail-grid dt {
  color: var(--ion-color-medium);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: .06em;
}

.detail-grid dd {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
}

.sync-error,
.action-error {
  color: var(--ion-color-danger);
}

.return-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
