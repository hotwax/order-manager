<template>
    <ion-content>
      <ion-list>
        <ion-list-header>{{ shipmentMethod.description ? shipmentMethod.description : shipmentMethod.shipmentMethodTypeId}}</ion-list-header>
        <ion-item button @click="cancelItem()">
          {{ translate("Cancel item") }}
        </ion-item>
          <ion-item button @click="customerSwap()">
            {{ translate("Customer swap") }}
          </ion-item>
          <ion-item button @click="viewInventory()">
            {{ translate("View inventory") }}
          </ion-item>
      </ion-list>
    </ion-content>
  </template>
  
  <script setup lang="ts">
  import { IonContent, IonItem, IonList, IonListHeader, modalController, popoverController } from "@ionic/vue";
  import { translate } from "@common";
  import ProductInventoryModal from "@/components/ProductInventoryModal.vue";

  const props = defineProps(["item", "task"]);

  const closePopover = () => popoverController.dismiss();

  const viewInventory = async () => {
    closePopover();
    const modal = await modalController.create({
      component: ProductInventoryModal,
      componentProps: { productId: props.item.productId }
    });
    await modal.present();
  };

  const cancelItem = () => {
    const original = (props.task.items ?? []).find((i: any) => i.orderItemSeqId === props.item._sourceOrderItemSeqId);
    if (original) original._cancel = true;
    closePopover();
  };

  const customerSwap = () => {
    // TODO: implement customer swap
    closePopover();
  };
  </script>
