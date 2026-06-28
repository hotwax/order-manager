<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="close()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ title }}</ion-title>
    </ion-toolbar>
    <ion-toolbar>
      <ion-searchbar v-model="query" :placeholder="searchPlaceholder || translate('Search')" @ionFocus="selectText" />
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list>
      <ion-item v-if="!filtered.length" lines="none">
        <ion-label>{{ translate('No records found.') }}</ion-label>
      </ion-item>
      <ion-item
        v-for="item in filtered"
        :key="item.geoId"
        button
        :detail="false"
        @click="select(item.geoId)"
      >
        <ion-label>{{ item.geoName }}</ion-label>
        <ion-icon v-if="item.geoId === selectedGeoId" slot="end" color="primary" :icon="checkmarkOutline" />
      </ion-item>
    </ion-list>
  </ion-content>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonSearchbar, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { checkmarkOutline, closeOutline } from 'ionicons/icons';
import { translate } from '@common';

// Searchable single-select picker. Options live only inside this modal (mounted
// on demand), so consumers with many options — e.g. 256 countries — don't render
// thousands of <ion-select-option> nodes up front.
const props = defineProps<{
  title: string;
  items: { geoId: string; geoName: string }[];
  selectedGeoId?: string;
  searchPlaceholder?: string;
}>();

const query = ref('');

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.items;
  return props.items.filter((item) => item.geoName?.toLowerCase().includes(q));
});

function select(geoId: string) {
  modalController.dismiss(geoId, 'selected');
}

function close() {
  modalController.dismiss(undefined, 'cancel');
}

async function selectText(event: any) {
  const element = await event.target.getInputElement();
  element.select();
}
</script>
