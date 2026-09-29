<template>
  <DxpModal :title="product?.internalName || productId">
    <div class="empty-state" v-if="isLoading">
      <ion-item lines="none">
        <ion-spinner color="secondary" name="crescent" slot="start" />
        {{ translate('Fetching inventory') }}
      </ion-item>
    </div>
    <div class="empty-state" v-else-if="!facilityStock.length">
      <p>{{ translate('No inventory data found') }}</p>
    </div>
    <ion-list v-else>
      <ion-list-header>
        <ion-label>{{ translate('Facility') }}</ion-label>
      </ion-list-header>
      <ion-item v-for="entry in facilityStock" :key="entry.facilityId">
        <ion-label>
          {{ seedStore.facilityName(entry.facilityId) }}
          <p>{{ entry.facilityId }}</p>
        </ion-label>
        <ion-label slot="end" class="stock-col">{{ entry.lastInventoryCount ?? 0 }}</ion-label>
      </ion-item>
    </ion-list>
  </DxpModal>
</template>

<script setup lang="ts">
import { IonItem, IonLabel, IonList, IonListHeader, IonSpinner } from '@ionic/vue';
import { ref, onMounted } from 'vue';
import { api, DxpModal, logger, translate } from '@common';
import { useSeedStore } from '@/store/seed';
import { useProductCacheStore } from '@/store/productCache';

const props = defineProps<{ productId: string }>();

const seedStore = useSeedStore();
const product = useProductCacheStore().getProduct(props.productId);

const isLoading = ref(false);
const facilityStock = ref<any[]>([]);

async function fetchProductFacilities() {
  isLoading.value = true;
  try {
    const resp = await api({
      url: 'oms/productFacilities',
      method: 'GET',
      params: { productId: props.productId }
    });
    facilityStock.value = Array.isArray(resp.data) ? resp.data : resp.data?.list ?? [];
  } catch (error) {
    logger.error('Failed to fetch product facilities', error);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchProductFacilities();
});
</script>

<style scoped>
.stock-col {
  min-width: 48px;
  text-align: end;
}
</style>
