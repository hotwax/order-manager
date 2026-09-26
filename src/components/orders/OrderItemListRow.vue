<template>
  <div class="list-item order-item-list-row">
    <ion-item class="order-item-list-key" lines="none">
      <!-- The checkbox is the only selection target. Its click and keys stay with it, since a
           group header row sits in an accordion header that toggles on click. -->
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
      <ion-label v-if="showQuantity" slot="end" class="order-item-quantity">
        {{ quantity }}
        <p>{{ quantityLabel }}</p>
      </ion-label>
    </ion-item>

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
      <ion-note
        v-for="adjustment in adjustments"
        :key="adjustment.label"
        class="order-item-adjustment"
        :title="`${adjustment.label}: ${adjustment.amount}`"
      >
        <span class="order-item-adjustment-label">{{ adjustment.label }}:</span>
        <span class="order-item-adjustment-amount">{{ adjustment.amount }}</span>
      </ion-note>
    </ion-label>
  </div>
</template>

<script setup lang="ts">
import { IonBadge, IonCheckbox, IonChip, IonIcon, IonItem, IonLabel, IonNote, IonThumbnail } from '@ionic/vue';
import { businessOutline, listOutline } from 'ionicons/icons';
import { DxpShopifyImg, translate } from '@common';
import type { ItemStatusBadge } from '@/utils/itemStatusBadges';

withDefaults(defineProps<{
  primary: string;
  secondary?: string;
  badgeLabel?: string;
  /** The variant's selectable features as one line, e.g. "Green M". */
  features?: string;
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
  showQuantity: true,
  facilityLabel: '',
  facilityDisabled: false,
  attributesLabel: '',
  attributesDisabled: false,
  statuses: () => [],
  statusDetail: '',
  adjustments: () => [],
});

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
/* Every row has the same four columns: product (with the quantity in its end slot), details,
   status and amount. Item actions live in the page footer and act on the selected rows.
   The shared list-item grid sizes its last column to fit a row's call to action; these rows end
   with the amount, whose adjustment lines would stretch that column, so the columns share the width. */
.order-item-list-row {
  --columns-desktop: 4;
  --columns-tablet: 4;
  grid-template-columns: repeat(var(--col-calc), minmax(0, 1fr));
  min-height: 6rem;
  border-block-start: var(--border-medium);
  padding-inline-end: var(--spacer-xs);
}

/* From tablet up the four columns are weighted by what they hold: the product takes the room the
   narrow status badge leaves. The weights never depend on a row's content, so every row gets the
   same columns and they line up. */
@media (min-width: 700px) {
  .order-item-list-row {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr) minmax(0, 1fr) minmax(0, 2fr);
  }
}

/* Only a group header expands when clicked, so every other row opts out of the shared list-item
   hover: unsetting the hover variable keeps its resting background, and it gets no pointer. */
.order-item-list-row:not([slot="header"]):hover {
  --list-item-bg-hover: initial;
  cursor: auto;
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
  /* One-line adjustments would otherwise widen the cell past its column. */
  max-width: 100%;
}

/* Tax and discount names run long, so each line keeps to one line: the name is cut with an
   ellipsis and the amount always shows. The full line is on hover. */
.order-item-adjustment {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacer-2xs);
}

.order-item-adjustment-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-item-adjustment-amount {
  flex: none;
}

/* A variant can carry many feature values — an e-gift card lists every denomination — and the
   identity column is narrow. Keep features to one line and put the full value on hover. */
.order-item-features {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

</style>
