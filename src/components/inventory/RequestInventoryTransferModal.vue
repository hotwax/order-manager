<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button :aria-label="translate('Close')" @click="modalController.dismiss()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Request transfer') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content class="ion-padding">
    <ion-list lines="full">
      <ion-item>
        <ion-label>
          <p>{{ translate('Destination') }}</p>
          {{ destinationFacilityName }}
          <p>{{ destinationFacilityId }}</p>
        </ion-label>
      </ion-item>
      <ion-item button detail="true" @click="selectSourceFacility">
        <ion-label>
          <p>{{ translate('Source') }}</p>
          {{ sourceFacilityName || translate('Select source facility') }}
          <p v-if="sourceFacilityId">
            {{ sourceFacilityId }}
          </p>
        </ion-label>
      </ion-item>
    </ion-list>

    <ion-list lines="full">
      <ion-list-header>{{ translate('Items') }}</ion-list-header>
      <ion-item v-for="item in requestedItems" :key="item.orderItemSeqId">
        <ion-label>
          {{ item.name }}
          <p>{{ item.sku || item.productId }} · {{ translate('Open quantity') }}: {{ item.openQuantity }}</p>
        </ion-label>
        <ion-input
          v-model.number="item.requestedQuantity"
          class="requested-quantity"
          type="number"
          inputmode="decimal"
          label-placement="stacked"
          :label="translate('Requested quantity')"
          :min="0"
          :max="item.openQuantity"
        />
      </ion-item>
      <ion-item>
        <ion-textarea
          v-model="comments"
          :label="translate('Comments')"
          label-placement="stacked"
          :placeholder="translate('Optional comments')"
          :rows="3"
        />
      </ion-item>
    </ion-list>

    <ion-note v-if="validationMessage" color="danger">
      {{ validationMessage }}
    </ion-note>

    <ion-fab slot="fixed" vertical="bottom" horizontal="end">
      <ion-fab-button :disabled="submitting || !canSubmit" :aria-label="translate('Request transfer')" @click="submit">
        <ion-icon :icon="sendOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import { translate } from "@common";
import {
  IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonInput,
  IonItem, IonLabel, IonList, IonListHeader, IonNote, IonTextarea, IonTitle, IonToolbar,
  modalController,
} from "@ionic/vue";
import { closeOutline, sendOutline } from "ionicons/icons";
import { computed, reactive, ref } from "vue";
import FacilityInventoryModal from "@/components/fulfillment/FacilityInventoryModal.vue";
import {
  inventoryTransferOpenQuantity,
  requestInventoryTransfers,
} from "@/services/inventoryTransfers";
import { useSeedStore } from "@/store/seed";

export type InventoryTransferModalItem = {
  orderItemSeqId: string;
  productId: string;
  name: string;
  sku?: string;
  imageUrl?: string;
  quantity: number;
  cancelledQuantity?: number;
  fulfilledQuantity?: number;
};

const props = defineProps<{
  orderId: string;
  productStoreId?: string;
  destinationFacilityId: string;
  items: InventoryTransferModalItem[];
}>();

const seedStore = useSeedStore();
const sourceFacilityId = ref("");
const comments = ref("");
const submitting = ref(false);
const submitError = ref("");
const requestedItems = reactive(props.items.map((item) => {
  const openQuantity = inventoryTransferOpenQuantity(item);

  return { ...item, openQuantity, requestedQuantity: openQuantity };
}));

const destinationFacilityName = computed(() => seedStore.facilityName(props.destinationFacilityId));
const sourceFacilityName = computed(() => sourceFacilityId.value ? seedStore.facilityName(sourceFacilityId.value) : "");
const invalidQuantity = computed(() => requestedItems.some((item) =>
  item.requestedQuantity < 0 || item.requestedQuantity > item.openQuantity));
const selectedItems = computed(() => requestedItems.filter((item) => item.requestedQuantity > 0));
const canSubmit = computed(() => Boolean(sourceFacilityId.value && selectedItems.value.length && !invalidQuantity.value));
const validationMessage = computed(() => {
  if(submitError.value) {return submitError.value;}
  if(invalidQuantity.value) {return translate("Requested quantity cannot exceed open quantity.");}

  return "";
});

async function selectSourceFacility() {
  const modal = await modalController.create({
    component: FacilityInventoryModal,
    componentProps: {
      items: requestedItems.map((item) => ({
        orderItemSeqId: item.orderItemSeqId,
        productId: item.productId,
        name: item.name,
        imageUrl: item.imageUrl,
        quantity: item.requestedQuantity,
      })),
      productStoreId: props.productStoreId,
      title: translate("Select source facility"),
      excludedFacilityIds: [props.destinationFacilityId],
    },
    cssClass: "facility-inventory-modal",
  });
  await modal.present();
  const { data } = await modal.onWillDismiss();
  if(data) {sourceFacilityId.value = data;}
}

async function submit() {
  if(!canSubmit.value) {return;}
  submitting.value = true;
  submitError.value = "";
  try {
    const requestReferencePrefix = `ORDER_MANAGER-${props.orderId}-${Date.now()}`;
    const inventoryTransferIds = await requestInventoryTransfers({
      requestReferencePrefix,
      transfers: selectedItems.value.map((item) => ({
        productId: item.productId,
        quantity: Number(item.requestedQuantity),
        facilityId: sourceFacilityId.value,
        facilityIdTo: props.destinationFacilityId,
        orderId: props.orderId,
        orderItemSeqId: item.orderItemSeqId,
        comments: comments.value || undefined,
      })),
    });
    await modalController.dismiss({ inventoryTransferIds }, "confirm");
  } catch {
    submitError.value = translate("Failed to request inventory transfer. Please try again.");
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
ion-content { --padding-bottom: 80px; }
.requested-quantity { max-width: 9rem; }
</style>
