<template>
  <div class="list-item order-item-list-row">
    <ion-item class="order-item-list-key" lines="none">
      <ion-checkbox
        v-if="selectable"
        slot="start"
        :checked="selected"
        @click.stop
        @keydown.stop
        @ionChange="emit('update:selected', $event.detail.checked)"
      />
      <ion-thumbnail v-if="imageUrl" slot="start" v-image-preview="previewProduct" :key="imageUrl">
        <DxpShopifyImg :src="imageUrl" :key="imageUrl" size="small" />
      </ion-thumbnail>
      <ion-label>
        <div>
          {{ primary }}
          <ion-badge v-if="badgeLabel" color="dark">{{ badgeLabel }}</ion-badge>
        </div>
        <p v-if="secondary">{{ secondary }}</p>
      </ion-label>
    </ion-item>

    <ion-label class="tablet order-item-quantity">
      <template v-if="showQuantity">
        {{ quantity }}
        <p>{{ quantityLabel }}</p>
      </template>
    </ion-label>

    <div class="tablet order-item-details">
      <ion-chip
        v-if="facilityLabel"
        outline
        :disabled="facilityDisabled"
        @click.stop="emit('facility-click')"
      >
        <ion-icon :icon="businessOutline" />
        <ion-label>{{ facilityLabel }}</ion-label>
      </ion-chip>
      <ion-chip
        v-if="attributesLabel"
        outline
        :disabled="attributesDisabled"
        @click.stop="emit('attributes-click')"
      >
        <ion-icon :icon="listOutline" />
        <ion-label>{{ attributesLabel }}</ion-label>
      </ion-chip>
    </div>

    <ion-label class="tablet order-item-status">
      <ion-badge v-if="statusLabel" :color="statusColor">{{ statusLabel }}</ion-badge>
      <p v-if="statusDetail">{{ statusDetail }}</p>
    </ion-label>

    <ion-label class="ion-text-end order-item-amount">
      {{ amount }}
      <p v-for="adjustment in adjustments" :key="adjustment.label">
        {{ adjustment.label }}: {{ adjustment.amount }}
      </p>
      <slot name="actions" />
    </ion-label>
  </div>
</template>

<script setup lang="ts">
import { IonBadge, IonCheckbox, IonChip, IonIcon, IonItem, IonLabel, IonThumbnail } from '@ionic/vue';
import { businessOutline, listOutline } from 'ionicons/icons';
import { DxpShopifyImg } from '@common';

withDefaults(defineProps<{
  primary: string;
  secondary?: string;
  badgeLabel?: string;
  imageUrl?: string;
  previewProduct?: any;
  selectable?: boolean;
  selected?: boolean;
  quantity: string | number;
  quantityLabel: string;
  showQuantity?: boolean;
  facilityLabel?: string;
  facilityDisabled?: boolean;
  attributesLabel?: string;
  attributesDisabled?: boolean;
  statusLabel?: string;
  statusColor?: string;
  statusDetail?: string;
  amount: string;
  adjustments?: Array<{ label: string; amount: string }>;
}>(), {
  secondary: '',
  badgeLabel: '',
  imageUrl: '',
  previewProduct: undefined,
  selectable: true,
  selected: false,
  showQuantity: true,
  facilityLabel: '',
  facilityDisabled: false,
  attributesLabel: '',
  attributesDisabled: false,
  statusLabel: '',
  statusColor: 'medium',
  statusDetail: '',
  adjustments: () => [],
});

const emit = defineEmits<{
  (event: 'update:selected', value: boolean): void;
  (event: 'facility-click'): void;
  (event: 'attributes-click'): void;
}>();
</script>

<style scoped>
.order-item-list-row {
  --columns-desktop: 5;
  --columns-tablet: 5;
  min-height: 6rem;
  border-block-start: var(--border-medium);
  padding-inline-end: var(--spacer-xs);
}

.order-item-list-row.order-item-rollup-entry {
  --columns-desktop: 4;
  --columns-tablet: 4;
}

.order-item-list-row.order-item-detail-entry {
  --columns-desktop: 5;
  --columns-tablet: 5;
}

.order-item-list-key {
  width: 100%;
}

.order-item-details {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-xs);
  justify-content: center;
}

.order-item-status,
.order-item-quantity {
  text-align: center;
}

.order-item-amount {
  min-width: 7rem;
}
</style>
