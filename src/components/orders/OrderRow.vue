<template>
  <div
    class="list-item"
    :class="rowClass"
    :role="selectMode ? 'button' : 'link'"
    tabindex="0"
    @click="emit('activate')"
    @keydown.enter.prevent="emit('activate')"
    @keydown.space.prevent="emit('activate')"
  >
    <ion-item lines="none">
      <ion-checkbox
        v-if="selectMode"
        slot="start"
        :checked="selected"
        @click.stop
        @keydown.stop
        @ion-change="emit('selectionChange', $event.detail.checked)"
      />
      <ion-label>
        {{ model.customerName }}
        <p>{{ identityLabel }}</p>
      </ion-label>
    </ion-item>

    <ion-label class="tablet">
      <OrderAllocationSummary :summary="model.allocationSummary" />
    </ion-label>

    <ion-label class="tablet">
      {{ model.fulfillmentContext }}
      <p v-if="model.channelName">{{ model.channelName }}</p>
    </ion-label>

    <ion-label class="tablet">
      {{ model.orderedDateTime }}
      <p v-if="model.orderedRelativeAge">Ordered {{ model.orderedRelativeAge }}</p>
    </ion-label>

    <ion-label :class="deadlineClass">
      <template v-if="model.estimatedDeliveryDateTime">
        {{ model.estimatedDeliveryDateTime }}
        <p v-if="model.estimatedDeliveryRelativeLabel">{{ model.estimatedDeliveryRelativeLabel }}</p>
      </template>
      <template v-else>
        <ion-note>No estimated delivery date</ion-note>
      </template>
    </ion-label>
  </div>
</template>

<script setup lang="ts">
import { IonCheckbox, IonItem, IonLabel, IonNote } from '@ionic/vue';
import { computed } from 'vue';
import OrderAllocationSummary from '@/components/orders/OrderAllocationSummary.vue';
import type { OrderRowViewModel } from '@/types/orderRow';

const props = defineProps<{
  model: OrderRowViewModel;
  rowClass: string;
  deadlineClass: string;
  selectMode?: boolean;
  selected?: boolean;
}>();
const emit = defineEmits<{
  (event: 'activate'): void;
  (event: 'selectionChange', selected: boolean): void;
}>();

const identityLabel = computed(() => [...new Set([props.model.orderName, props.model.orderId, props.model.status]
  .filter(Boolean))]
  .join(' - '));
</script>
