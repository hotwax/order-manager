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
        :title="translate('Customer search failed')"
        :message="error"
      />

      <ion-list v-else>
        <ion-list-header>
          <ion-label>{{ translate("{loaded} of {total} customers", { loaded: customers.length, total }) }}</ion-label>
        </ion-list-header>
        <div
          v-for="customer in customers"
          :key="customer.partyId"
          class="list-item customer-result-row"
          role="link"
          tabindex="0"
          @click="goToCustomer(customer)"
          @keydown.enter.prevent="goToCustomer(customer)"
          @keydown.space.prevent="goToCustomer(customer)"
        >
          <ion-item lines="none">
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
  </ion-page>
</template>

<script setup lang="ts">
import { IonButtons, IonContent, IonHeader, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonListHeader, IonMenuButton, IonPage, IonProgressBar, IonSearchbar, IonTitle, IonToolbar, useIonRouter } from '@ionic/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { searchCustomers } from '@/services/customer';
import type { Customer } from '@/types/order';
import EmptyState from '@/components/common/EmptyState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import { translate } from '@common'

const ionRouter = useIonRouter();

const searchQuery = ref('');
const customers = ref<Customer[]>([]);
const total = ref(0);
const pageIndex = ref(0);
const loading = ref(false);
const error = ref('');
const debounceTimer = ref<ReturnType<typeof setTimeout>>();

const hasMore = computed(() => customers.value.length < total.value);

onMounted(runSearch);

watch(searchQuery, () => scheduleSearch());

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
      partyTypeId: 'All',
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
      partyTypeId: 'All',
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

function goToCustomer(customer: Customer) {
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
