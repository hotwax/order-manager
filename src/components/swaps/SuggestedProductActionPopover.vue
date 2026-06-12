<template>
  <ion-content>
    <ion-list>
      <ion-list-header>
        <ion-label>{{ popoverTitle }}</ion-label>
      </ion-list-header>
      <ion-item button detail="false" @click="cancelItem()">
        <ion-label>{{ translate("Cancel item") }}</ion-label>
      </ion-item>
      <ion-item button detail="false" @click="customSwap()">
        <ion-label>{{ translate("Custom swap") }}</ion-label>
      </ion-item>
      <ion-item button detail="false" @click="viewInventory()">
        <ion-label>{{ translate("View inventory") }}</ion-label>
      </ion-item>
    </ion-list>
  </ion-content>
</template>
  
<script setup lang="ts">
import { computed } from "vue";
import { IonContent, IonItem, IonLabel, IonList, IonListHeader, modalController, popoverController } from "@ionic/vue";
import { commonUtil, translate } from "@common";
import ProductInventoryModal from "@/components/inventory/ProductInventoryModal.vue";
import CustomSwapModal from "@/components/swaps/CustomSwapModal.vue";
import { useProductCacheStore } from "@/store/productCache";
import { useProductStore } from "@/store/productStore";

const props = defineProps(["item", "task"]);

const productIdentificationPref = computed(() => useProductStore().getProductIdentificationPref);

const popoverTitle = computed(() => {
  const product = props.item?.productId
    ? useProductCacheStore().getProduct(props.item.productId)
    : undefined;

  return commonUtil.getProductIdentificationValue(productIdentificationPref.value.primaryId, product)
    || props.item?.productId
    || props.item?.sku
    || props.item?.internalName
    || props.item?.productName
    || translate("Item");
});

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

const customSwap = async () => {
  closePopover();
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

  originalItem._customSubstitute = selectedProduct;
  originalItem._cancel = false;
};
</script>
