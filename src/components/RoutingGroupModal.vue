<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Select Routing Group') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
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

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!selectedRoutingGroupId" @click="save">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonRadio, IonRadioGroup, IonSpinner, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { closeOutline, saveOutline } from 'ionicons/icons';
import { onMounted, ref } from 'vue';
import { api, logger, translate } from '@common';

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

function closeModal(routingGroupId?: string) {
  modalController.dismiss(routingGroupId);
}

function save() {
  if (selectedRoutingGroupId.value) {
    closeModal(selectedRoutingGroupId.value);
  }
}

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

<style scoped>
ion-content {
  --padding-bottom: 80px;
}
</style>
