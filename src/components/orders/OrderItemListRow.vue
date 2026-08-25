<template>
  <div class="list-item order-item-list-row">
    <ion-item
      class="order-item-list-key"
      lines="none"
      :button="rowSelects"
      :detail="false"
      @click="rowSelects && emit('update:selected', !selected)"
    >
      <ion-checkbox
        v-if="selectable"
        slot="start"
        :checked="selected"
        :aria-label="translate('Select item')"
        @click.stop
        @keydown.stop
        @ionChange="emit('update:selected', $event.detail.checked)"
      />
      <ion-thumbnail
        v-if="imageUrl"
        slot="start"
        v-image-preview="previewProduct"
        :key="imageUrl"
        @click.stop
      >
        <DxpShopifyImg :src="imageUrl" :key="imageUrl" size="small" />
      </ion-thumbnail>
      <ion-label>
        <div>
          {{ primary }}
          <ion-badge v-if="badgeLabel" color="dark">{{ badgeLabel }}</ion-badge>
        </div>
        <p v-if="features" class="order-item-features" :title="features">{{ features }}</p>
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
      <div v-if="statuses.length" class="order-item-status-badges">
        <ion-badge v-for="status in statuses" :key="status.label" :color="status.color || 'medium'">
          {{ statusBadgeLabel(status) }}
        </ion-badge>
      </div>
      <p v-if="statusDetail">{{ statusDetail }}</p>
    </ion-label>

    <ion-label class="ion-text-end order-item-amount">
      {{ amount }}
      <ion-note class="ion-display-block" v-for="adjustment in adjustments" :key="adjustment.label">
        {{ adjustment.label }}: {{ adjustment.amount }}
      </ion-note>
    </ion-label>

    <div>
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonBadge, IonCheckbox, IonChip, IonIcon, IonItem, IonLabel, IonThumbnail } from '@ionic/vue';
import { businessOutline, listOutline } from 'ionicons/icons';
import { DxpShopifyImg, translate } from '@common';
import type { ItemStatusBadge } from '@/utils/itemStatusBadges';

const props = withDefaults(defineProps<{
  primary: string;
  secondary?: string;
  badgeLabel?: string;
  /** The variant's selectable features as one line, e.g. "Green M". */
  features?: string;
  imageUrl?: string;
  previewProduct?: any;
  selectable?: boolean;
  selected?: boolean;
  selectOnRowClick?: boolean;
  quantity: string | number;
  quantityLabel: string;
  showQuantity?: boolean;
  facilityLabel?: string;
  facilityDisabled?: boolean;
  attributesLabel?: string;
  attributesDisabled?: boolean;
  statuses?: ItemStatusBadge[];
  statusDetail?: string;
  amount: string;
  adjustments?: Array<{ label: string; amount: string }>;
}>(), {
  secondary: '',
  badgeLabel: '',
  features: '',
  imageUrl: '',
  previewProduct: undefined,
  selectable: true,
  selected: false,
  selectOnRowClick: true,
  showQuantity: true,
  facilityLabel: '',
  facilityDisabled: false,
  attributesLabel: '',
  attributesDisabled: false,
  statuses: () => [],
  statusDetail: '',
  adjustments: () => [],
});

/**
 * Ionic does not forward an `ion-item` tap to a control in its `slot="start"`,
 * so the row drives selection from its own click and the checkbox is only the
 * indicator. Rows whose click already belongs to something else — an
 * `ion-accordion` header toggles the group — opt out with `selectOnRowClick`.
 */
const rowSelects = computed(() => props.selectable && props.selectOnRowClick);

function statusBadgeLabel(status: ItemStatusBadge): string {
  return status.count == undefined ? status.label : `${status.count} ${status.label}`;
}

const emit = defineEmits<{
  (event: 'update:selected', value: boolean): void;
  (event: 'facility-click'): void;
  (event: 'attributes-click'): void;
}>();
</script>

<style scoped>
.order-item-list-row {
  --columns-desktop: 6;
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

/* Badges stack inside the column so the grid cell keeps the display the row layout gives it. */
.order-item-status-badges {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacer-2xs);
}

.order-item-amount {
  min-width: 7rem;
}

/* A variant can carry many feature values — an e-gift card lists every denomination — and the
   identity column is narrow. Keep features to one line and put the full value on hover. */
.order-item-features {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

</style>
