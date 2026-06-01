<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>Find customers</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <SearchFilterCard
        v-model="searchQuery"
        placeholder="Name, party ID, email, or phone"
        @clear="clearFilters"
      >
        <ion-select v-model="partyTypeId" label="Type" label-placement="stacked" interface="popover">
          <ion-select-option value="All">All types</ion-select-option>
          <ion-select-option value="PERSON">Person</ion-select-option>
          <ion-select-option value="PARTY_GROUP">Company</ion-select-option>
        </ion-select>
      </SearchFilterCard>

      <ion-progress-bar v-if="loading" type="indeterminate" />

      <ErrorState
        v-if="error"
        title="Customer search failed"
        :message="error"
      />

      <ion-list v-else>
        <ion-list-header>
          <ion-label>{{ total }} customers</ion-label>
        </ion-list-header>
        <ion-item
          v-for="customer in customers"
          :key="customer.id"
          :router-link="`/customers/${customer.id}`"
        >
          <ion-label>
            <h2>{{ customer.name || customer.id }}</h2>
            <p>{{ customer.id }} · {{ customer.email || customer.phone || 'No contact on file' }}</p>
          </ion-label>
          <ion-note slot="end">{{ customer.partyTypeId === 'PARTY_GROUP' ? 'Company' : 'Person' }}</ion-note>
        </ion-item>
      </ion-list>

      <EmptyState
        v-if="!loading && !error && !customers.length"
        title="No matching customers"
        message="Adjust the search text or filters to broaden the customer list."
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonButtons,
  IonContent,
  IonHeader,
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
  IonToolbar
} from '@ionic/vue';
import { onMounted, ref, watch } from 'vue';
import { searchCustomers } from '@/services/customer';
import type { Customer } from '@/types/order';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import SearchFilterCard from '@/components/SearchFilterCard.vue';

const searchQuery = ref('');
const partyTypeId = ref('All');
const customers = ref<Customer[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref('');
const debounceTimer = ref<ReturnType<typeof setTimeout>>();

onMounted(runSearch);

watch(searchQuery, () => scheduleSearch());
watch(partyTypeId, () => runSearch());

function scheduleSearch() {
  if (debounceTimer.value) clearTimeout(debounceTimer.value);
  debounceTimer.value = setTimeout(runSearch, 300);
}

async function runSearch() {
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

function clearFilters() {
  searchQuery.value = '';
  partyTypeId.value = 'All';
  runSearch();
}
</script>
