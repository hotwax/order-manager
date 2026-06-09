<template>
    <ion-content>
      <ion-list>
        <ion-list-header>{{ shipmentMethod.description ? shipmentMethod.description : shipmentMethod.shipmentMethodTypeId}}</ion-list-header>
        <ion-item button @click="cancelItem()">
          {{ translate("Cancel item") }}
        </ion-item>
          <ion-item button @click="customerSwap()">
            {{ translate("Custom swap") }}
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
  import CustomSwapModal from "@/components/CustomSwapModal.vue";

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

  const customerSwap = async () => {
    closePopover();
    // Find the original order item to get its substituteProducts list
    const originalItem = (props.task.items ?? []).find((i: any) => i.orderItemSeqId === props.item._sourceOrderItemSeqId);
    const modal = await modalController.create({
      component: CustomSwapModal,
      componentProps: {
        substituteProducts: originalItem?.substituteProducts ?? [],
        facilityId: props.task.facilityId,
      },
    });
    await modal.present();
    const { data: selectedProduct } = await modal.onWillDismiss();
    if (!selectedProduct || !originalItem) return;
    // Apply selected product as custom substitute on the original item
    originalItem._customSubstitute = selectedProduct;
    originalItem._cancel = false;
  };
  </script>
