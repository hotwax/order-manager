<template>
  <DxpModal :state="routingGroupModal" :title="translate('Select routing group')">
    <ion-radio-group v-model="selectedRoutingGroupId">
      <ion-list>
        <div class="empty-state" v-if="isLoading">
          <ion-item lines="none">
            <ion-spinner color="secondary" name="crescent" slot="start" />
            {{ translate('Fetching routing groups') }}
          </ion-item>
        </div>
        <div class="empty-state" v-else-if="!routingGroups.length">
          <p>{{ translate('No routing groups found') }}</p>
        </div>
        <div v-else>
          <ion-item v-for="group in routingGroups" :key="group.routingGroupId">
            <ion-radio label-placement="end" justify="start" :value="group.routingGroupId">
              <ion-label>
                {{ group.groupName }}
                <p>{{ group.routingGroupId }}</p>
              </ion-label>
            </ion-radio>
          </ion-item>
        </div>
      </ion-list>
    </ion-radio-group>
  </DxpModal>
</template>

<script setup lang="ts">
import { IonItem, IonLabel, IonList, IonRadio, IonRadioGroup, IonSpinner } from '@ionic/vue';
import { onMounted, ref } from 'vue';
import { api, DxpModal, logger, translate, useDxpModal } from '@common';

const props = defineProps<{
  productStoreId: string;
}>();

type RoutingGroup = {
  routingGroupId: string;
  routingGroupName: string;
};

const routingGroups = ref<RoutingGroup[]>([]);
const isLoading = ref(false);
const selectedRoutingGroupId = ref('');

// Save hands back the chosen routing group; the screen that opened the picker brokers with it.
const routingGroupModal = useDxpModal({
  canConfirm: () => !!selectedRoutingGroupId.value,
  confirm: () => selectedRoutingGroupId.value,
});

async function fetchRoutingGroups() {
  isLoading.value = true;
  try {
    const resp = await api({
      url: 'order-routing/groups',
      method: 'GET',
      params: { productStoreId: props.productStoreId },
    });
    routingGroups.value = resp.data || [];
  } catch (error) {
    logger.error('Failed to fetch routing groups', error);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchRoutingGroups();
});
</script>

