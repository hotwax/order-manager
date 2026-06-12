<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate("Add Custom Line") }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list>
      <ion-item>
        <ion-input :label="translate('Product Name')" label-placement="stacked" v-model="form.productName" :placeholder="translate('Enter product name')" />
      </ion-item>
      <ion-item>
        <ion-input :label="translate('Quantity')" label-placement="stacked" type="number" v-model="form.quantity" :placeholder="translate('Enter quantity')" min="1" />
      </ion-item>
      <ion-item>
        <ion-input :label="translate('Price')" label-placement="stacked" type="number" v-model="form.price" :placeholder="translate('Enter price')" min="0" />
      </ion-item>
    </ion-list>

    <ion-fab horizontal="end" vertical="bottom">
      <ion-fab-button :disabled="!isFormValid" @click="save">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonInput, IonItem, IonList, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { closeOutline, saveOutline } from 'ionicons/icons';
import { computed, reactive } from 'vue';
import { translate } from '@common';

const form = reactive({
  productName: '',
  quantity: 1,
  price: 0
});

const isFormValid = computed(() => form.productName.trim() && Number(form.quantity) > 0 && Number(form.price) >= 0);

function closeModal() {
  modalController.dismiss();
}

function save() {
  if (!isFormValid.value) return;
  modalController.dismiss({
    productName: form.productName.trim(),
    quantity: Number(form.quantity),
    price: Number(form.price)
  });
}
</script>
