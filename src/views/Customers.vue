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
      <SearchFilterCard
        v-model="searchQuery"
        :placeholder="translate('Name, party ID, email, or phone')"
        @clear="clearFilters"
      >
        <ion-select v-model="partyTypeId" :label="translate('Type')" label-placement="stacked" interface="popover">
          <ion-select-option value="All">{{ translate("All types") }}</ion-select-option>
          <ion-select-option v-for="(label, id) in partyTypes" :key="id" :value="id">{{ label }}</ion-select-option>
        </ion-select>
      </SearchFilterCard>

      <ion-progress-bar v-if="loading" type="indeterminate" />

      <ErrorState
        v-if="error"
        :title="translate('Customer search failed')"
        :message="error"
      />

      <ion-list v-else>
        <ion-list-header>
          <ion-label>{{ translate("{loaded} of {total} customers", { loaded: customers.length, total }) }}</ion-label>
        </ion-list-header>
        <ion-item
          v-for="customer in customers"
          :key="customer.id"
          :router-link="`/customers/${customer.id}`"
        >
          <ion-label>
            <h2>{{ customer.fullName || customer.id }}</h2>
            <p>{{ customer.partyId }}<template v-if="customer.emailAddress || customer.phoneNumber"> · {{ customer.emailAddress || customer.phoneNumber }}</template></p>
          </ion-label>
          <ion-note slot="end">{{ partyTypes[customer.partyTypeId] ?? customer.partyTypeId }}</ion-note>
        </ion-item>
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
  </ion-page>
</template>

<script setup lang="ts">
import { IonButtons, IonContent, IonHeader, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonListHeader, IonMenuButton, IonNote, IonPage, IonProgressBar, IonSelect, IonSelectOption, IonTitle, IonToolbar } from '@ionic/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { partyTypes, searchCustomers } from '@/services/customer';
import type { Customer } from '@/types/order';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import SearchFilterCard from '@/components/SearchFilterCard.vue';
import { translate } from '@common'

const searchQuery = ref('');
const partyTypeId = ref('All');
const customers = ref<Customer[]>([]);
const total = ref(0);
const pageIndex = ref(0);
const loading = ref(false);
const error = ref('');
const debounceTimer = ref<ReturnType<typeof setTimeout>>();

const hasMore = computed(() => customers.value.length < total.value);

onMounted(runSearch);

watch(searchQuery, () => scheduleSearch());
watch(partyTypeId, () => runSearch());

function scheduleSearch() {
  if (debounceTimer.value) clearTimeout(debounceTimer.value);
  debounceTimer.value = setTimeout(runSearch, 300);
}

async function runSearch() {
  pageIndex.value = 0;
  loading.value = true;
  error.value = '';
  try {
    const result = await searchCustomers({
      queryString: searchQuery.value,
      partyTypeId: partyTypeId.value,
      pageSize: 50,
      pageIndex: 0
    });
    customers.value = result.customers;
    total.value = result.total;
  } catch (searchError: any) {
    error.value = searchError?.message || 'Failed to search customers';
    customers.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

async function loadMore(event: CustomEvent) {
  pageIndex.value++;
  try {
    const result = await searchCustomers({
      queryString: searchQuery.value,
      partyTypeId: partyTypeId.value,
      pageSize: 50,
      pageIndex: pageIndex.value
    });
    customers.value = [...customers.value, ...result.customers];
    total.value = result.total;
  } catch {
    pageIndex.value--;
  } finally {
    (event.target as HTMLIonInfiniteScrollElement).complete();
  }
}

function clearFilters() {
  searchQuery.value = '';
  partyTypeId.value = 'All';
  runSearch();
}
</script>
