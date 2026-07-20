<template>
  <div
    class="list-item return-result-row"
    role="link"
    tabindex="0"
    @click="emit('activate')"
    @keydown.enter.prevent="emit('activate')"
    @keydown.space.prevent="emit('activate')"
  >
    <ion-item class="return-row-primary" lines="none">
      <ion-label class="ion-text-wrap">
        <p class="overline">
          {{ rmaLabel }}
        </p>
        <span class="return-primary-label">{{ primaryLabel }}</span>
        <ion-badge v-if="typeLabel" class="return-type-badge" :color="typeColor">
          {{ typeLabel }}
        </ion-badge>
        <p v-if="secondaryLabel">
          {{ secondaryLabel }}
        </p>
        <p class="return-mobile-summary">
          {{ dateLabel }} · {{ amountLabel }}
        </p>
      </ion-label>
    </ion-item>

    <ion-label class="tablet ion-text-start">
      <p class="overline">
        {{ translate('Return date') }}
      </p>
      {{ dateLabel }}
      <p v-if="relativeDateLabel">
        {{ relativeDateLabel }}
      </p>
    </ion-label>

    <ion-label class="tablet return-channel">
      <p class="overline">
        {{ translate('Channel') }}
      </p>
      {{ channelLabel || '—' }}
    </ion-label>

    <ion-label class="tablet return-amount">
      <p class="overline">
        {{ translate('Return total') }}
      </p>
      {{ amountLabel }}
    </ion-label>

    <ion-label class="return-status ion-text-end">
      <ion-badge :color="statusColor">
        {{ statusLabel }}
      </ion-badge>
      <p>{{ translate('Status') }}</p>
    </ion-label>
  </div>
</template>

<script setup lang="ts">
import { translate } from "@common";
import { IonBadge, IonItem, IonLabel } from "@ionic/vue";

withDefaults(defineProps<{
  rmaLabel: string;
  primaryLabel: string;
  secondaryLabel?: string;
  dateLabel: string;
  relativeDateLabel?: string;
  channelLabel?: string;
  amountLabel: string;
  statusLabel: string;
  statusColor?: string;
  typeLabel?: string;
  typeColor?: string;
}>(), {
  secondaryLabel: "",
  relativeDateLabel: "",
  channelLabel: "",
  statusColor: "medium",
  typeLabel: "",
  typeColor: "medium",
});

const emit = defineEmits<{
  (event: "activate"): void;
}>();
</script>

<style scoped>
.return-result-row {
  --columns-desktop: 5;
  --columns-tablet: 5;
  min-height: 5rem;
  border-block-start: var(--border-medium);
  padding-inline-end: var(--spacer-sm);
}

.return-row-primary,
.return-result-row > ion-label {
  width: 100%;
}

.return-primary-label {
  vertical-align: middle;
}

.return-type-badge {
  margin-inline-start: var(--spacer-xs);
  vertical-align: middle;
}

.return-amount,
.return-status {
  justify-self: end;
}

.return-channel {
  min-width: 9rem;
}

.return-amount {
  min-width: 8rem;
}

.return-status {
  min-width: 7rem;
}

.return-mobile-summary {
  display: none;
}

@media (max-width: 767px) {
  .return-mobile-summary {
    display: block;
  }
}
</style>
