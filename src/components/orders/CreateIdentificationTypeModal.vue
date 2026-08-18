<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="modalController.dismiss()" :aria-label="translate('Close')">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Create identification type') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list>
      <ion-item>
        <ion-input
          v-model="formData.enumName"
          :disabled="saving"
          @ionBlur="formData.enumId ? null : setEnumId(formData.enumName)"
        >
          <div slot="label">{{ translate('Name') }} <ion-text color="danger">*</ion-text></div>
        </ion-input>
      </ion-item>
      <ion-item lines="none">
        <ion-input
          v-model="formData.enumId"
          :label="translate('Type ID')"
          :disabled="saving"
          @ionChange="validateEnumId"
          @ionBlur="markEnumIdTouched"
          :errorText="translate('ID cannot be more than 20 characters.')"
        />
      </ion-item>
      <ion-item>
        <ion-input v-model="formData.description" :label="translate('Description')" :disabled="saving" />
      </ion-item>
    </ion-list>

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="saving" @click="createType()" :aria-label="translate('Create')">
        <ion-spinner v-if="saving" name="crescent" />
        <ion-icon v-else :icon="checkmarkDoneOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonInput, IonItem, IonList, IonSpinner, IonText, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { checkmarkDoneOutline, closeOutline } from 'ionicons/icons';
import { ref } from 'vue';
import { commonUtil, translate } from '@common';
import { useSeedStore } from '@/store/seed';
import { showToast } from '@/utils';

const seedStore = useSeedStore();
const saving = ref(false);

const formData = ref({ enumId: '', enumName: '', description: '' });

function setEnumId(enumName: string) {
  formData.value.enumId = commonUtil.generateInternalId(enumName);
}

function validateEnumId(event: any) {
  const input = event.target;
  input.classList.remove('ion-valid');
  input.classList.remove('ion-invalid');
  if (!formData.value.enumId) return;
  formData.value.enumId.length <= 20 ? input.classList.add('ion-valid') : input.classList.add('ion-invalid');
}

function markEnumIdTouched(event: any) {
  event.target.classList.add('ion-touched');
}

async function createType() {
  if (!formData.value.enumName.trim()) {
    await showToast(translate('Identification type name is required.'));
    return;
  }
  if (!formData.value.enumId) {
    formData.value.enumId = commonUtil.generateInternalId(formData.value.enumName);
  }
  if (formData.value.enumId.length > 20) {
    await showToast(translate('ID cannot be more than 20 characters.'));
    return;
  }

  saving.value = true;
  try {
    await seedStore.createOrderIdentificationType({
      enumId: formData.value.enumId,
      description: formData.value.description.trim() || formData.value.enumName.trim()
    });
    await showToast(translate('Identification type created successfully.'));
    modalController.dismiss({ enumId: formData.value.enumId }, 'confirm');
  } catch {
    await showToast(translate('Failed to create identification type. Please try again.'));
  } finally {
    saving.value = false;
  }
}
</script>
