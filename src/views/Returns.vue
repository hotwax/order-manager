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
        v-model="query.searchTerm"
        :placeholder="searchPlaceholder"
        :show-clear="false"
        @search="runSearch"
        @clear="clearFilters"
      >
        <UniformFilterLayout @clear="clearFilters">
          <ion-select
            v-model="query.searchField"
            :label="translate('Search by')"
            label-placement="stacked"
            fill="outline"
            interface="popover"
            @ion-change="applyFilters"
          >
            <ion-select-option value="RETURN_ID">
              {{ translate('Return ID') }}
            </ion-select-option>
            <ion-select-option value="ORDER_ID">
              {{ translate('Exact order ID') }}
            </ion-select-option>
            <ion-select-option value="CUSTOMER_ID">
              {{ translate('Exact customer party ID') }}
            </ion-select-option>
          </ion-select>

          <ion-select
            v-model="query.statusId"
            :label="translate('Status')"
            label-placement="stacked"
            fill="outline"
            interface="popover"
            @ion-change="applyFilters"
          >
            <ion-select-option value="">
              {{ translate('All statuses') }}
            </ion-select-option>
            <ion-select-option v-for="status in returnStatuses" :key="status.statusId" :value="status.statusId">
              {{ status.description || status.statusId }}
            </ion-select-option>
          </ion-select>

          <ion-select
            v-model="query.returnHeaderTypeId"
            :label="translate('Return type')"
            label-placement="stacked"
            fill="outline"
            interface="popover"
            @ion-change="applyFilters"
          >
            <ion-select-option value="">
              {{ translate('All return types') }}
            </ion-select-option>
            <ion-select-option value="CUSTOMER_RETURN">
              {{ translate('Customer return') }}
            </ion-select-option>
            <ion-select-option value="APPEASEMENT">
              {{ translate('Appeasement') }}
            </ion-select-option>
          </ion-select>

          <ion-select
            v-model="query.returnChannelEnumId"
            :label="translate('Return channel')"
            label-placement="stacked"
            fill="outline"
            interface="popover"
            @ion-change="applyFilters"
          >
            <ion-select-option value="">
              {{ translate('All channels') }}
            </ion-select-option>
            <ion-select-option v-for="channel in returnChannels" :key="channel.enumId" :value="channel.enumId">
              {{ channel.description || channel.enumName || channel.enumId }}
            </ion-select-option>
          </ion-select>
        </UniformFilterLayout>
      </SearchFilterCard>

      <ion-note class="search-contract-note">
        {{ searchContractNote }}
      </ion-note>

      <ion-progress-bar v-if="loading" type="indeterminate" />

      <ErrorState
        v-if="error"
        :title="translate('Return search failed')"
        :message="error"
        retryable
        @retry="runSearch"
      />

      <ion-list v-else-if="returns.length">
        <ion-list-header>
          <ion-label>{{ returns.length }} {{ translate('of') }} {{ total }} {{ translate('returns') }}</ion-label>
        </ion-list-header>
        <div
          v-for="returnRecord in returns"
          :key="returnRecord.returnId"
          :data-testid="`return-row-${returnRecord.returnId}`"
          class="list-item return-result-row"
          role="link"
          tabindex="0"
          @click="openReturn(returnRecord.returnId)"
          @keydown.enter.prevent="openReturn(returnRecord.returnId)"
          @keydown.space.prevent="openReturn(returnRecord.returnId)"
        >
          <ion-item lines="none">
            <ion-label class="ion-text-wrap">
              <h2>{{ returnRecord.returnId }}</h2>
              <p>{{ formatDate(returnRecord.entryDate) }}</p>
            </ion-label>
          </ion-item>

          <ion-label class="tablet ion-text-start">
            {{ returnRecord.orderName || returnRecord.orderId || translate('Not linked') }}
            <p>{{ translate('Order') }}</p>
          </ion-label>

          <ion-label class="tablet ion-text-start">
            {{ returnTypeLabel(returnRecord.returnHeaderTypeId) }}
            <p v-if="returnRecord.isExchange">
              {{ translate('Exchange') }}
            </p>
            <p v-else-if="returnRecord.fromPartyId">
              {{ returnRecord.customerName || `${translate('Customer')} ${returnRecord.fromPartyId}` }}
            </p>
          </ion-label>

          <ion-label class="tablet ion-text-start">
            {{ channelLabel(returnRecord.returnChannelEnumId) }}
            <p>{{ facilityLabel(returnRecord.destinationFacilityId) }}</p>
          </ion-label>

          <ion-label class="ion-text-end">
            {{ statusLabel(returnRecord.statusId) }}
            <p>{{ translate('Status') }}</p>
          </ion-label>
        </div>
      </ion-list>

      <EmptyState
        v-else-if="!loading"
        :title="translate('No matching returns')"
        :message="translate('Adjust the exact identifier or filters to broaden the return list.')"
      />

      <ion-infinite-scroll :disabled="!hasMore" @ion-infinite="loadMore">
        <ion-infinite-scroll-content loading-spinner="crescent" :loading-text="translate('Loading more returns')" />
      </ion-infinite-scroll>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { translate } from "@common";
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenuButton,
  IonNote,
  IonPage,
  IonProgressBar,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  onIonViewWillEnter
} from "@ionic/vue";
import { DateTime } from "luxon";
import { storeToRefs } from "pinia";
import { computed, nextTick } from "vue";
import EmptyState from "@/components/common/EmptyState.vue";
import ErrorState from "@/components/common/ErrorState.vue";
import SearchFilterCard from "@/components/common/SearchFilterCard.vue";
import UniformFilterLayout from "@/components/common/UniformFilterLayout.vue";
import router from "@/router";
import { useReturnsStore } from "@/store/returns";
import { useSeedStore } from "@/store/seed";

const returnsStore = useReturnsStore();
const seed = useSeedStore();
const { returns, total, query, loading, error, hasMore } = storeToRefs(returnsStore);

const returnStatuses = computed(() => seed.getStatusItemsByType("ORDER_RETURN_STTS"));
const returnChannels = computed(() => seed.getEnumsByType("RETURN_CHANNEL"));
const searchPlaceholder = computed(() => ({
  RETURN_ID: translate("Exact return ID"),
  ORDER_ID: translate("Exact internal order ID"),
  CUSTOMER_ID: translate("Exact customer party ID")
}[query.value.searchField]));
const searchContractNote = computed(() => ({
  RETURN_ID: translate("Return ID lookup opens the existing return detail contract; partial matches are not supported."),
  ORDER_ID: translate("Order lookup uses the existing exact order ID filter."),
  CUSTOMER_ID: translate("Customer lookup uses the existing exact customer party ID filter.")
}[query.value.searchField]));

onIonViewWillEnter(() => returnsStore.search());

function runSearch() {
  return returnsStore.search();
}

async function applyFilters() {
  await nextTick();
  await runSearch();
}

function clearFilters() {
  return returnsStore.clearFilters();
}

async function loadMore(event: CustomEvent) {
  await returnsStore.loadMore();
  await (event.target as { complete: () => Promise<void> }).complete();
}

function openReturn(returnId: string) {
  router.push(`/returns/${encodeURIComponent(returnId)}`);
}

function statusLabel(statusId: string) {
  return seed.statusDescription(statusId) || statusId || translate("Not specified");
}

function returnTypeLabel(returnHeaderTypeId?: string) {
  if(returnHeaderTypeId === "CUSTOMER_RETURN") {return translate("Customer return");}
  if(returnHeaderTypeId === "APPEASEMENT") {return translate("Appeasement");}

  return returnHeaderTypeId ? seed.describe(returnHeaderTypeId) || returnHeaderTypeId : translate("Return");
}

function channelLabel(returnChannelEnumId?: string) {
  return returnChannelEnumId ? seed.enumDescription(returnChannelEnumId) || returnChannelEnumId : translate("No channel");
}

function facilityLabel(destinationFacilityId?: string) {
  return destinationFacilityId ? seed.facilityName(destinationFacilityId) || destinationFacilityId : translate("No destination facility");
}

function formatDate(value?: string | number) {
  if(!value) {return translate("Date not available");}
  const stringValue = String(value);
  const numericValue = Number(value);
  const date = /^\d+$/.test(stringValue)
    ? DateTime.fromMillis(stringValue.length <= 10 ? numericValue * 1000 : numericValue)
    : DateTime.fromISO(stringValue).isValid ? DateTime.fromISO(stringValue) : DateTime.fromSQL(stringValue);

  return date.isValid ? date.toLocaleString(DateTime.DATE_MED) : stringValue;
}
</script>

<style scoped>
.search-contract-note {
  display: block;
  margin: calc(-1 * var(--spacer-xs)) var(--spacer-md) var(--spacer-sm);
}

.return-result-row {
  --columns-desktop: 5;
  --columns-tablet: 4;
  min-height: 4.75rem;
  border-block-start: var(--border-medium);
  cursor: pointer;
  padding-inline: var(--spacer-sm);
}

.return-result-row > ion-label {
  width: 100%;
}
</style>
