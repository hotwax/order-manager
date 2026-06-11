<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="modalController.dismiss()">
          <ion-icon :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Item Attributes') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list>
      <ion-list-header>
        <ion-label>{{ translate('Add Attribute') }}</ion-label>
      </ion-list-header>
      <ion-item>
        <ion-input
          v-model="form.attrName"
          :label="translate('Name')"
          label-placement="stacked"
          :placeholder="translate('Attribute name')"
          :disabled="saving"
        />
      </ion-item>
      <ion-item>
        <ion-input
          v-model="form.attrValue"
          :label="translate('Value')"
          label-placement="stacked"
          :placeholder="translate('Attribute value')"
          :disabled="saving"
        />
      </ion-item>
      <ion-item>
        <ion-input
          v-model="form.attrDescription"
          :label="translate('Description')"
          label-placement="stacked"
          :placeholder="translate('Attribute description')"
          :disabled="saving"
        />
      </ion-item>
      <div class="ion-padding">
        <ion-button expand="block" :disabled="!form.attrName.trim() || saving" @click="addAttribute">
          <ion-spinner v-if="saving" name="crescent" slot="start" />
          {{ translate('Add') }}
        </ion-button>
      </div>
    </ion-list>

    <ion-list v-if="localAttributes.length">
      <ion-list-header>
        <ion-label>{{ translate('Attributes') }}</ion-label>
      </ion-list-header>
      <ion-item v-for="attr in localAttributes" :key="attr.attrName">
        <ion-label>
          <p>{{ attr.attrName }}</p>
          {{ attr.attrValue || '-' }}
          <p v-if="attr.attrDescription">{{ attr.attrDescription }}</p>
        </ion-label>
        <ion-button slot="end" fill="clear" color="danger" :disabled="deletingAttr === attr.attrName" @click="deleteAttribute(attr)">
          <ion-spinner v-if="deletingAttr === attr.attrName" name="crescent" />
          <ion-icon v-else :icon="trashOutline" />
        </ion-button>
      </ion-item>
    </ion-list>

    <EmptyState
      v-else-if="!localAttributes.length"
      :title="translate('No attributes')"
      :message="translate('This order item has no attributes.')"
    />
  </ion-content>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonSpinner, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { closeOutline, trashOutline } from 'ionicons/icons';
import { reactive, ref } from 'vue';
import { api, translate } from '@common';
import EmptyState from '@/components/EmptyState.vue';
import { showToast } from '@/utils';

type Attribute = { attrName: string; attrValue?: string; attrDescription?: string };

const props = defineProps<{
  orderId: string;
  orderItemSeqId: string;
  attributes: Attribute[];
}>();

const localAttributes = ref<Attribute[]>([...props.attributes]);
const saving = ref(false);
const deletingAttr = ref('');

const form = reactive({ attrName: '', attrValue: '', attrDescription: '' });

async function addAttribute() {
  if (!form.attrName.trim()) return;
  saving.value = true;
  try {
    await api({
      url: `oms/orders/${props.orderId}/items/${props.orderItemSeqId}/attributes`,
      method: 'POST',
      data: {
        attrName: form.attrName.trim(),
        attrValue: form.attrValue.trim() || undefined,
        attrDescription: form.attrDescription.trim() || undefined
      }
    });
    localAttributes.value.push({
      attrName: form.attrName.trim(),
      attrValue: form.attrValue.trim() || undefined,
      attrDescription: form.attrDescription.trim() || undefined
    });
    form.attrName = '';
    form.attrValue = '';
    form.attrDescription = '';
    await showToast(translate('Attribute added successfully.'));
  } catch {
    await showToast(translate('Failed to add attribute. Please try again.'));
  } finally {
    saving.value = false;
  }
}

async function deleteAttribute(attr: Attribute) {
  deletingAttr.value = attr.attrName;
  try {
    await api({
      url: `oms/orders/${props.orderId}/items/${props.orderItemSeqId}/attributes/${encodeURIComponent(attr.attrName)}`,
      method: 'DELETE'
    });
    localAttributes.value = localAttributes.value.filter(a => a.attrName !== attr.attrName);
    await showToast(translate('Attribute deleted.'));
  } catch {
    await showToast(translate('Failed to delete attribute. Please try again.'));
  } finally {
    deletingAttr.value = '';
  }
}
</script>

<style scoped>
ion-content {
  --padding-bottom: 16px;
}
</style>
