<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="dismiss()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Add Task') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list>
      <ion-item>
        <ion-input
          :label="translate('Task Name')"
          label-placement="stacked"
          :placeholder="translate('Enter task name')"
          v-model="form.workEffortName"
        />
      </ion-item>
      <ion-item>
        <ion-select
          :label="translate('Task Type')"
          label-placement="stacked"
          interface="popover"
          :placeholder="translate('Select Task Type')"
          v-model="form.workEffortTypeId"
        >
          <ion-select-option v-for="option in taskTypes" :key="option.enumId" :value="option.enumId">
            {{ option.description || option.enumName || option.enumId }}
          </ion-select-option>
        </ion-select>
      </ion-item>
      <ion-item>
        <ion-select
          :label="translate('Task Purpose')"
          label-placement="stacked"
          interface="popover"
          :placeholder="translate('Select Task Purpose')"
          v-model="form.workEffortPurposeTypeId"
        >
          <ion-select-option v-for="option in taskPurposes" :key="option.enumId" :value="option.enumId">
            {{ option.description || option.enumName || option.enumId }}
          </ion-select-option>
        </ion-select>
      </ion-item>
      <ion-item>
        <ion-textarea
          :label="translate('Description')"
          label-placement="stacked"
          :placeholder="translate('Enter description')"
          :rows="3"
          v-model="form.description"
        />
      </ion-item>
    </ion-list>

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!isValid" @click="confirm()">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar,
  modalController,
} from '@ionic/vue';
import { closeOutline, saveOutline } from 'ionicons/icons';
import { computed, onMounted, reactive } from 'vue';
import { translate } from '@common';
import { useSeedStore } from '@/store/seed';

const seedStore = useSeedStore();

const form = reactive({
  workEffortName: '',
  workEffortTypeId: '',
  workEffortPurposeTypeId: '',
  description: '',
});

const taskTypes = computed(() => seedStore.getEnumsByType('WorkEffortType'));
const taskPurposes = computed(() => seedStore.getEnumsByParentType('WorkEffortPurposeType'));

const isValid = computed(() =>
  form.workEffortName.trim() &&
  form.workEffortTypeId &&
  form.workEffortPurposeTypeId &&
  form.description.trim()
);

onMounted(() => {
  seedStore.loadEnumType('WorkEffortType');
  seedStore.loadEnumsByParentType('WorkEffortPurposeType');
});

function dismiss() {
  modalController.dismiss(null, 'cancel');
}

function confirm() {
  modalController.dismiss({ ...form }, 'confirm');
}
</script>
