<template>
  <DxpModal :state="typeModal" :title="translate('Create identification type')">
    <ion-list>
      <ion-item>
        <ion-input
          v-model="formData.enumName"
          :label="requiredLabel('Name')"
          label-placement="stacked"
          required
          :disabled="typeModal.saving"
          @ionBlur="formData.enumId ? null : setEnumId(formData.enumName)"
        />
      </ion-item>
      <ion-item lines="none">
        <ion-input
          v-model="formData.enumId"
          :label="translate('Type ID')"
          label-placement="stacked"
          :disabled="typeModal.saving"
          @ionChange="validateEnumId"
          @ionBlur="markEnumIdTouched"
          :errorText="translate('ID cannot be more than 20 characters.')"
        />
      </ion-item>
      <ion-item>
        <ion-input v-model="formData.description" :label="translate('Description')" label-placement="stacked" :disabled="typeModal.saving" />
      </ion-item>
    </ion-list>
  </DxpModal>
</template>

<script setup lang="ts">
import { IonInput, IonItem, IonList } from '@ionic/vue';
import { ref } from 'vue';
import { commonUtil, DxpModal, translate, useDxpModal } from '@common';
import { useSeedStore } from '@/store/seed';
import { showToast, requiredLabel } from '@/utils';

const seedStore = useSeedStore();
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

// Save creates the type here and hands back its id; a thrown message is the toast, and the modal stays open.
const typeModal = useDxpModal({
  dirty: () => !!(formData.value.enumName.trim() || formData.value.enumId || formData.value.description.trim()),
  async confirm() {
    if (!formData.value.enumName.trim()) throw new Error(translate('Identification type name is required.'));
    if (!formData.value.enumId) {
      formData.value.enumId = commonUtil.generateInternalId(formData.value.enumName);
    }
    if (formData.value.enumId.length > 20) throw new Error(translate('ID cannot be more than 20 characters.'));

    try {
      await seedStore.createOrderIdentificationType({
        enumId: formData.value.enumId,
        description: formData.value.description.trim() || formData.value.enumName.trim()
      });
    } catch {
      throw new Error(translate('Failed to create identification type. Please try again.'));
    }
    await showToast(translate('Identification type created successfully.'));
    return { enumId: formData.value.enumId };
  },
});
</script>
