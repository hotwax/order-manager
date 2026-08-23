<template>
  <div class="list-item order-item-list-row" :class="{ 'order-item-expands': expands }">
    <ion-item class="order-item-list-key" lines="none" :detail="false">
      <!-- The checkbox is the only way to select: it sits in the start slot and swallows its
           own tap, so a row used as an `ion-accordion` header still toggles the group from
           anywhere else but never selects, and selecting never toggles the group. -->
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
  /** Whether clicking the row does anything — only an accordion header expands. */
  expands?: boolean;
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
  expands: false,
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
.order-item-list-row {
  --columns-desktop: 6;
  --columns-tablet: 5;
  min-height: 6rem;
  border-block-start: var(--border-medium);
  padding-inline-end: var(--spacer-xs);
}

.order-item-list-key {
  width: 100%;
}

/*
 * Ionic flags an item that wraps a control as `ion-activatable`, gives it a ripple and a
 * pointer cursor, and treats the whole item as that control's hit area. It does not actually
 * forward the click here, so the row rippled like a checkbox press that never happened.
 * Selection comes from the checkbox alone, so the item must stop advertising itself as one.
 */
.order-item-list-key {
  --ripple-color: transparent;
  --background-activated: transparent;
}

.order-item-list-key::part(native) {
  cursor: default;
}

/*
 * Product identity carries the most text in the row — name, features and secondary id — so it
 * takes two of the flexible tracks. Mobile shows only this column and the action column, with
 * no track to spare, so the span waits for the same breakpoint theme.css uses for `.tablet`.
 */
@media (min-width: 700px) {
  .order-item-list-key {
    grid-column: span 2;
  }
}

/*
 * theme.css highlights and points at every .list-item on hover. Only a row that expands does
 * anything when clicked, so the rest must not advertise a click. The hover background reaches
 * the inner ion-item through --list-item-bg-hover, so clearing the variable covers both.
 */
.order-item-list-row:not(.order-item-expands):hover {
  --list-item-bg-hover: transparent;
  background: transparent;
  cursor: default;
}

.order-item-details {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-xs);
  justify-content: center;
}

.order-item-status {
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
