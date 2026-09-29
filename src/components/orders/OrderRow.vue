<template>
  <div
    class="list-item order-row"
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
        :aria-label="translate('Select order')"
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
      <p v-if="model.orderedRelativeAge">{{ translate('Ordered {age}', { age: model.orderedRelativeAge }) }}</p>
    </ion-label>

    <ion-label class="order-row-end ion-text-end">
      <template v-if="model.estimatedDeliveryDateTime">
        {{ model.estimatedDeliveryDateTime }}
        <p v-if="model.estimatedDeliveryRelativeLabel">{{ model.estimatedDeliveryRelativeLabel }}</p>
      </template>
      <template v-else>
        <ion-note>{{ translate('No estimated delivery date') }}</ion-note>
      </template>
    </ion-label>
  </div>
</template>

<script setup lang="ts">
import { translate } from '@common';
import { IonCheckbox, IonItem, IonLabel, IonNote } from '@ionic/vue';
import { computed } from 'vue';
import OrderAllocationSummary from '@/components/orders/OrderAllocationSummary.vue';
import type { OrderRowViewModel } from '@/types/orderRow';

const props = defineProps<{
  model: OrderRowViewModel;
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

<style scoped>
/* One row for every order list: Open, In flight, Packed, Find orders and the queues. The end
   column holds the delivery date, so it keeps one width and the other columns line up. */
.order-row {
  --columns-desktop: 5;
  --columns-tablet: 5;
  min-height: 5rem;
  border-block-start: var(--border-medium);
  padding-inline-end: var(--spacer-sm);
}

.order-row > ion-label {
  width: 100%;
}

.order-row > ion-label.order-row-end {
  display: block;
  justify-self: end;
  max-width: 10rem;
  min-width: 10rem;
  width: 10rem;
}
</style>
