<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate('Find returns') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <SearchFilterCard
        v-model="filters.query"
        :placeholder="translate('RMA number, return ID, order ID')"
        :show-clear="false"
        @clear="clearFilters"
      >
        <UniformFilterLayout @clear="clearFilters">
          <ion-select
            v-model="filters.statusId"
            :label="translate('Status')"
            label-placement="stacked"
            fill="outline"
            interface="popover"
          >
            <ion-select-option value="All">
              {{ translate('All statuses') }}
            </ion-select-option>
            <ion-select-option value="RETURN_REQUESTED">
              {{ translate('Requested') }}
            </ion-select-option>
            <ion-select-option value="RETURN_ACCEPTED">
              {{ translate('Accepted') }}
            </ion-select-option>
            <ion-select-option value="RETURN_COMPLETED">
              {{ translate('Completed') }}
            </ion-select-option>
            <ion-select-option value="RETURN_CANCELLED">
              {{ translate('Cancelled') }}
            </ion-select-option>
          </ion-select>

          <DateFilterSelect v-model="filters.dateFrom" :label="translate('Return date from')" />
          <DateFilterSelect v-model="filters.dateThru" :label="translate('Return date through')" />
        </UniformFilterLayout>
      </SearchFilterCard>

      <section class="return-summary" :aria-label="translate('Returns overview')">
        <ion-card class="summary-card" :aria-busy="openReturnsLoading">
          <ion-card-content>
            <div class="summary-heading">
              <ion-icon :icon="refreshCircleOutline" color="warning" />
              <p class="overline">
                {{ translate('Open returns') }}
              </p>
            </div>
            <ion-skeleton-text v-if="openReturnsLoading" animated class="summary-skeleton" />
            <template v-else-if="openReturnsError">
              <p class="summary-error">
                {{ openReturnsError }}
              </p>
              <ion-button fill="clear" size="small" @click="loadOpenReturnsCount">
                {{ translate('Retry') }}
              </ion-button>
            </template>
            <template v-else>
              <strong class="summary-value">{{ openReturnsCount }}</strong>
              <p class="summary-caption">
                {{ translate('Requested and accepted returns') }}
              </p>
            </template>
          </ion-card-content>
        </ion-card>

        <ion-card class="summary-card" :aria-busy="pendingRefundsLoading">
          <ion-card-content>
            <div class="summary-heading">
              <ion-icon :icon="cashOutline" color="success" />
              <p class="overline">
                {{ translate('Pending refunds') }}
              </p>
            </div>
            <ion-skeleton-text v-if="pendingRefundsLoading" animated class="summary-skeleton" />
            <template v-else-if="pendingRefundsError">
              <p class="summary-error">
                {{ pendingRefundsError }}
              </p>
              <ion-button fill="clear" size="small" @click="loadPendingRefundTotals">
                {{ translate('Retry') }}
              </ion-button>
            </template>
            <template v-else>
              <strong class="summary-value summary-value-currency">{{ pendingRefundsLabel }}</strong>
              <p class="summary-caption">
                {{ translate('Across open returns') }}
              </p>
            </template>
          </ion-card-content>
        </ion-card>
      </section>

      <ion-progress-bar v-if="loading" type="indeterminate" />

      <ErrorState
        v-if="error"
        :title="translate('Returns failed to load')"
        :message="error"
      />

      <ion-list v-else>
        <ion-list-header class="return-results-header">
          <ion-label>
            {{ translate('{loaded} of {total} matching returns', { loaded: returns.length, total: totalReturns }) }}
          </ion-label>
          <ion-button id="sort-returns-popover-trigger" fill="clear" color="dark" size="small">
            {{ filters.sort === 'entryDate desc' ? translate('Newest first') : translate('Oldest first') }}
            <ion-icon slot="end" :icon="chevronDownOutline" />
          </ion-button>
        </ion-list-header>

        <ReturnListRow
          v-for="returnRecord in returns"
          :key="returnRecord.returnId"
          :rma-label="`RMA ${returnRecord.returnId}`"
          :primary-label="primaryLabel(returnRecord)"
          :secondary-label="secondaryLabel(returnRecord)"
          :date-label="formatDate(returnRecord.entryDate)"
          :relative-date-label="formatRelativeDate(returnRecord.entryDate)"
          :channel-label="channelLabel(returnRecord.returnChannelEnumId)"
          :amount-label="formatCurrency(returnRecord.returnTotal || 0, returnRecord.currencyUomId)"
          :status-label="getStatusLabel(returnRecord.statusId)"
          :status-color="getStatusColor(returnRecord.statusId)"
          :type-label="getTypeLabel(returnRecord)"
          :type-color="getTypeColor(returnRecord)"
          @activate="viewReturnDetail(returnRecord.returnId)"
        />
      </ion-list>

      <ion-popover trigger="sort-returns-popover-trigger" dismiss-on-select>
        <ion-content>
          <ion-radio-group v-model="filters.sort">
            <ion-item lines="none">
              <ion-radio value="entryDate desc">
                {{ translate('Newest first') }}
              </ion-radio>
            </ion-item>
            <ion-item lines="none">
              <ion-radio value="entryDate asc">
                {{ translate('Oldest first') }}
              </ion-radio>
            </ion-item>
          </ion-radio-group>
        </ion-content>
      </ion-popover>

      <EmptyState
        v-if="!loading && !error && !returns.length"
        :title="translate('No matching returns')"
        :message="translate('Adjust the search text or filters to broaden the return list.')"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { commonUtil, translate } from "@common";
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenuButton,
  IonPage,
  IonPopover,
  IonProgressBar,
  IonRadio,
  IonRadioGroup,
  IonSelect,
  IonSelectOption,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
} from "@ionic/vue";
import { cashOutline, chevronDownOutline, refreshCircleOutline } from "ionicons/icons";
import { DateTime } from "luxon";
import { computed, onMounted, ref, watch } from "vue";
import DateFilterSelect from "@/components/common/DateFilterSelect.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import ErrorState from "@/components/common/ErrorState.vue";
import SearchFilterCard from "@/components/common/SearchFilterCard.vue";
import UniformFilterLayout from "@/components/common/UniformFilterLayout.vue";
import ReturnListRow from "@/components/returns/ReturnListRow.vue";
import { type ReturnFilters, useReturnSearchRouteState } from "@/composables/useReturnSearchRouteState";
import router from "@/router";
import {
  type ReturnAmountTotal,
  getOpenReturnsCount,
  getPendingRefundTotals,
  getReturnCustomerNames,
  listReturns,
} from "@/services/returns";
import type { ReturnSummary } from "@/types/returns";

const filters = ref<ReturnFilters>({
  query: "",
  statusId: "All",
  dateFrom: "",
  dateThru: "",
  sort: "entryDate desc",
});

useReturnSearchRouteState(filters);

const returns = ref<ReturnSummary[]>([]);
const customerNamesByPartyId = ref<Record<string, string>>({});
const totalReturns = ref(0);
const loading = ref(false);
const error = ref("");
const openReturnsCount = ref(0);
const openReturnsLoading = ref(false);
const openReturnsError = ref("");
const pendingRefundTotals = ref<ReturnAmountTotal[]>([]);
const pendingRefundsLoading = ref(false);
const pendingRefundsError = ref("");

const pendingRefundsLabel = computed(() => {
  if(!pendingRefundTotals.value.length) {return formatCurrency(0, "USD");}

  return pendingRefundTotals.value
    .map((total) => formatCurrency(total.amount, total.currencyUomId))
    .join(" · ");
});

onMounted(() => {
  loadOpenReturnsCount();
  loadPendingRefundTotals();
});

watch(filters, fetchReturns, { deep: true, immediate: true });

async function fetchReturns() {
  loading.value = true;
  error.value = "";
  try {
    const statusId = filters.value.statusId !== "All" ? filters.value.statusId : undefined;
    const result = await listReturns({
      statusId,
      query: filters.value.query,
      dateFrom: filters.value.dateFrom,
      dateThru: filters.value.dateThru,
      sort: filters.value.sort,
      pageSize: 200,
    });
    let items = result.items;

    if(filters.value.query.trim()) {
      const query = filters.value.query.trim().toLowerCase();
      items = items.filter((returnRecord) =>
        returnRecord.returnId.toLowerCase().includes(query) ||
        returnRecord.orderName?.toLowerCase().includes(query) ||
        returnRecord.orderId?.toLowerCase().includes(query) ||
        returnRecord.orderExternalId?.toLowerCase().includes(query));
    }

    if(filters.value.dateFrom) {
      const fromDate = DateTime.fromISO(filters.value.dateFrom).startOf("day");
      if(fromDate.isValid) {items = items.filter((returnRecord) => returnTimestamp(returnRecord.entryDate) >= fromDate.toMillis());}
    }
    if(filters.value.dateThru) {
      const throughDate = DateTime.fromISO(filters.value.dateThru).endOf("day");
      if(throughDate.isValid) {items = items.filter((returnRecord) => returnTimestamp(returnRecord.entryDate) <= throughDate.toMillis());}
    }

    items.sort((left, right) => {
      const difference = (dateFromValue(left.entryDate)?.toMillis() || 0) - (dateFromValue(right.entryDate)?.toMillis() || 0);

      return filters.value.sort === "entryDate asc" ? difference : -difference;
    });

    returns.value = items;
    totalReturns.value = filters.value.query.trim() ? items.length : result.total;
    void loadReturnCustomerNames(items);
  } catch (returnError: any) {
    error.value = returnError?.message || translate("Failed to load returns");
    returns.value = [];
    totalReturns.value = 0;
  } finally {
    loading.value = false;
  }
}

async function loadOpenReturnsCount() {
  openReturnsLoading.value = true;
  openReturnsError.value = "";
  try {
    openReturnsCount.value = await getOpenReturnsCount();
  } catch (metricError: any) {
    openReturnsError.value = metricError?.message || translate("Metric unavailable");
  } finally {
    openReturnsLoading.value = false;
  }
}

async function loadPendingRefundTotals() {
  pendingRefundsLoading.value = true;
  pendingRefundsError.value = "";
  try {
    pendingRefundTotals.value = await getPendingRefundTotals();
  } catch (metricError: any) {
    pendingRefundsError.value = metricError?.message || translate("Metric unavailable");
  } finally {
    pendingRefundsLoading.value = false;
  }
}

function clearFilters() {
  filters.value = {
    query: "",
    statusId: "All",
    dateFrom: "",
    dateThru: "",
    sort: "entryDate desc",
  };
  if(Object.keys(router.currentRoute.value.query).length > 0) {router.replace("/returns");}
}

function viewReturnDetail(returnId: string) {
  router.push(`/returns/${returnId}`);
}

async function loadReturnCustomerNames(items: ReturnSummary[]) {
  const unresolvedPartyIds = [...new Set(items
    .map((returnRecord) => returnRecord.fromPartyId || "")
    .filter((partyId) => partyId && !customerNamesByPartyId.value[partyId]))];
  if(!unresolvedPartyIds.length) {return;}

  try {
    customerNamesByPartyId.value = {
      ...customerNamesByPartyId.value,
      ...await getReturnCustomerNames(unresolvedPartyIds),
    };
  } catch {
    // Customer enrichment is non-blocking; keep the order identity visible when Solr is unavailable.
  }
}

function customerName(returnRecord: ReturnSummary) {
  return returnRecord.fromPartyId ? customerNamesByPartyId.value[returnRecord.fromPartyId] || "" : "";
}

function fallbackOrderLabel(returnRecord: ReturnSummary) {
  if(returnRecord.orderName) {return `${translate("Order")} ${returnRecord.orderName}`;}
  if(returnRecord.orderId) {return `${translate("Order")} ${returnRecord.orderId}`;}

  return translate("Blind return");
}

function primaryLabel(returnRecord: ReturnSummary) {
  return customerName(returnRecord) || fallbackOrderLabel(returnRecord);
}

function secondaryLabel(returnRecord: ReturnSummary) {
  if(customerName(returnRecord)) {
    if(returnRecord.orderId) {return `${translate("Order")} ${returnRecord.orderId}`;}
    if(returnRecord.orderName) {return `${translate("Order")} ${returnRecord.orderName}`;}

    return translate("Blind return");
  }
  if(!returnRecord.orderName || !returnRecord.orderId) {return "";}

  return `${translate("OMS order")} ${returnRecord.orderId}`;
}

function getTypeLabel(returnRecord: ReturnSummary) {
  if(returnRecord.isExchange) {return translate("Exchange");}
  if(returnRecord.type === "appeasement") {return translate("Appeasement");}

  return "";
}

function getTypeColor(returnRecord: ReturnSummary) {
  return returnRecord.isExchange ? "tertiary" : "primary";
}

function getStatusLabel(statusId?: string) {
  if(!statusId) {return translate("Requested");}
  switch (statusId) {
    case "RETURN_REQUESTED": return translate("Requested");
    case "RETURN_ACCEPTED": return translate("Accepted");
    case "RETURN_COMPLETED": return translate("Completed");
    case "RETURN_CANCELLED": return translate("Cancelled");
    default: return statusId;
  }
}

function getStatusColor(statusId?: string) {
  switch (statusId) {
    case "RETURN_REQUESTED": return "warning";
    case "RETURN_ACCEPTED": return "secondary";
    case "RETURN_COMPLETED": return "success";
    case "RETURN_CANCELLED": return "medium";
    default: return "primary";
  }
}

function channelLabel(channelId?: string) {
  if(!channelId) {return "";}

  return channelId
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatCurrency(amount: number, currency = "USD") {
  return commonUtil.formatCurrency(amount, currency || "USD");
}

function formatDate(value?: string) {
  const date = dateFromValue(value);

  return date?.isValid ? date.toLocaleString(DateTime.DATE_MED) : translate("Date unavailable");
}

function formatRelativeDate(value?: string) {
  return dateFromValue(value)?.toRelative() || "";
}

function returnTimestamp(value?: string) {
  return dateFromValue(value)?.toMillis() || 0;
}

function dateFromValue(value?: string) {
  if(!value) {return undefined;}
  const numericValue = Number(value);
  if(Number.isFinite(numericValue) && numericValue > 0) {
    const numericDate = DateTime.fromMillis(value.length <= 10 ? numericValue * 1000 : numericValue);
    if(numericDate.isValid) {return numericDate;}
  }
  const sqlDate = DateTime.fromSQL(value);
  if(sqlDate.isValid) {return sqlDate;}
  const isoDate = DateTime.fromISO(value);

  return isoDate.isValid ? isoDate : undefined;
}
</script>

<style scoped>
.return-summary {
  display: grid;
  gap: var(--spacer-sm);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding-inline: var(--spacer-sm);
}

.summary-card ion-card-content {
  min-height: 8.5rem;
}

.summary-heading {
  align-items: center;
  display: flex;
  gap: var(--spacer-xs);
}

.summary-heading ion-icon {
  font-size: 1.25rem;
}

.summary-heading .overline,
.summary-caption,
.summary-error {
  margin: 0;
}

.summary-value {
  display: block;
  font-size: 2rem;
  line-height: 1.2;
  margin-block-start: var(--spacer-xs);
}

.summary-value-currency {
  font-size: 1.5rem;
}

.summary-caption,
.summary-error {
  color: var(--ion-color-medium);
  margin-block-start: var(--spacer-xs);
}

.summary-skeleton {
  height: 2rem;
  margin-block-start: var(--spacer-sm);
  width: 40%;
}

.return-results-header {
  align-items: center;
  display: flex;
  gap: var(--spacer-xs);
}

@media (max-width: 640px) {
  .return-summary {
    grid-template-columns: 1fr;
  }
}
</style>
