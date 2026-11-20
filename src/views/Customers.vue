<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate("Find customers") }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-searchbar
        class="customer-searchbar"
        :value="searchQuery"
        :debounce="0"
        :placeholder="translate('Name, party ID, email, or phone')"
        @ionInput="searchQuery = $event.detail.value || ''"
      />

      <ion-progress-bar v-if="loading" type="indeterminate" />

      <ErrorState
        v-if="error"
        :title="translate('Could not load customers')"
        :message="error"
        retryable
        @retry="runSearch()"
      />

      <ion-list v-else>
        <!-- Hidden at zero, where the empty state says it better than "0 of 0". -->
        <FindResultsHeader
          v-if="customers.length"
          :count-label="translate('{shown} of {count} customers', { shown: customers.length, count: total })"
          :select-all-label="translate('Select all loaded customers')"
          :select-mode="selectMode"
          :all-selected="allSelected"
          :some-selected="someSelected"
          @select-all="selectAll"
          @toggle-select-mode="toggleSelectMode"
        >
          <OrderSortPopover
            v-model="searchSort"
            :options="sortOptions"
            trigger-id="find-customer-sort-trigger"
          />
        </FindResultsHeader>
        <div
          v-for="customer in customers"
          :key="customer.partyId"
          class="list-item customer-result-row"
          :role="selectMode ? undefined : 'link'"
          :tabindex="selectMode ? undefined : 0"
          @click="activateResult(customer)"
          @keydown.enter.self.prevent="activateResult(customer)"
          @keydown.space.self.prevent="activateResult(customer)"
        >
          <ion-item lines="none">
            <ion-checkbox
              v-if="selectMode"
              slot="start"
              :checked="selected.has(customer.partyId)"
              :aria-label="translate('Select customer {id}', { id: customer.partyId })"
              @click.stop
              @ionChange="setSelected(customer.partyId, $event.detail.checked)"
            />
            <ion-label>
              <p class="overline">{{ customer.partyId }}</p>
              {{ customer.fullName || customer.partyId }}
            </ion-label>
          </ion-item>
          <ion-label class="tablet ion-text-start">
            {{ customer.emailAddress || translate('No email') }}
            <p>{{ translate('Email') }}</p>
          </ion-label>
          <ion-label class="tablet ion-text-end">
            {{ customer.phoneNumber || translate('No phone') }}
            <p>{{ translate('Phone') }}</p>
          </ion-label>
        </div>
      </ion-list>

      <ion-infinite-scroll :disabled="!hasMore" @ionInfinite="loadMore">
        <ion-infinite-scroll-content loading-spinner="crescent" :loading-text="translate('Loading more customers')" />
      </ion-infinite-scroll>

      <EmptyState
        v-if="!loading && !error && !customers.length"
        :title="translate('No matching customers')"
        :message="translate('Adjust the search text or filters to broaden the customer list.')"
      />
    </ion-content>

    <BulkSelectionFooter
      v-if="selectMode"
      :count="selectedIds.length"
      :disabled="loading || Boolean(error)"
      :build-csv="buildCsv"
      filename="selected-customers.csv"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { translate } from '@common';
import { IonButtons, IonCheckbox, IonContent, IonHeader, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonMenuButton, IonPage, IonProgressBar, IonSearchbar, IonTitle, IonToolbar, useIonRouter } from '@ionic/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useCustomerStore } from '@/store/customer';
import type { CustomerSearchRow } from '@/utils/customer';
import EmptyState from '@/components/common/EmptyState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import OrderSortPopover, { type OrderSortOption } from '@/components/orders/OrderSortPopover.vue';

import BulkSelectionFooter from '@/components/common/BulkSelectionFooter.vue';
import FindResultsHeader from '@/components/common/FindResultsHeader.vue';
import { useFindSelection } from '@/composables/useFindSelection';
import { buildSelectedCustomersCsv } from '@/utils/findExport';

const customerStore = useCustomerStore();

const ionRouter = useIonRouter();

// Solr sort clauses for the CUSTOMER doc. Only `fullName` is a sortable single-valued field
// on that document (the indexer writes no date and no `sort_*` copy, and `sort_lastName`
// is rejected by the collection), so name order is the only meaningful sort available.
// The default stays empty so a keyword search keeps its edismax relevance ranking.
const sortOptions: OrderSortOption[] = [
  { label: 'Best match', value: '' },
  { label: 'Name A-Z', value: 'fullName asc' },
  { label: 'Name Z-A', value: 'fullName desc' },
];

const searchQuery = ref('');
const searchSort = ref('');
const customers = ref<CustomerSearchRow[]>([]);
const total = ref(0);
const pageIndex = ref(0);
const loading = ref(false);
const error = ref('');
const debounceTimer = ref<ReturnType<typeof setTimeout>>();

const {
  selectMode, selectedIds, selected, allSelected, someSelected, setSelected,
  toggleSelected, selectAll, toggleSelectMode
} = useFindSelection(computed(() => customers.value.map((customer) => customer.partyId)));

function buildCsv() {
  return buildSelectedCustomersCsv(customers.value, selectedIds.value);
}

const hasMore = computed(() => customers.value.length < total.value);

onMounted(runSearch);

watch(searchQuery, () => scheduleSearch());
watch(searchSort, () => runSearch());

function scheduleSearch() {
  if (debounceTimer.value) clearTimeout(debounceTimer.value);
  debounceTimer.value = setTimeout(runSearch, 300);
}

async function runSearch() {
  pageIndex.value = 0;
  loading.value = true;
  error.value = '';
  try {
    const result = await customerStore.searchCustomers({
      queryString: searchQuery.value,
      partyTypeId: 'All',
      pageSize: 50,
      pageIndex: 0,
      sort: searchSort.value
    });
    customers.value = result.customers;
    total.value = result.total;
  } catch (searchError: any) {
    error.value = searchError?.message || translate('Failed to search customers');
    customers.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

async function loadMore(event: CustomEvent) {
  pageIndex.value++;
  try {
    const result = await customerStore.searchCustomers({
      queryString: searchQuery.value,
      partyTypeId: 'All',
      pageSize: 50,
      pageIndex: pageIndex.value,
      sort: searchSort.value
    });
    customers.value = [...customers.value, ...result.customers];
    total.value = result.total;
  } catch {
    pageIndex.value--;
  } finally {
    (event.target as HTMLIonInfiniteScrollElement).complete();
  }
}

function activateResult(customer: CustomerSearchRow) {
  if (selectMode.value) {
    toggleSelected(customer.partyId);
    return;
  }

  ionRouter.push(`/customers/${customer.partyId}`);
}
</script>

<style scoped>
.customer-result-row {
  --columns-desktop: 3;
  --columns-tablet: 3;
  min-height: 4rem;
  border-block-start: var(--border-medium);
  padding-inline: var(--spacer-sm);
}

.customer-result-row > ion-label {
  width: 100%;
}
</style>
