<template>
  <ion-item>
    <ion-label>
      <div class="identification-kv">
        <span class="identification-kv__type">
          {{ label }}
          <ion-icon
            v-if="!isUpdatable"
            :icon="lockClosedOutline"
            class="identification-kv__badge"
            :title="translate('Imported from Shopify')"
          />
        </span>
        <span v-if="!hideValue" class="identification-kv__value">
          {{ hasValue ? value : translate('Value not available') }}
        </span>
      </div>
    </ion-label>
    <slot name="end" />
  </ion-item>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon, IonItem, IonLabel } from '@ionic/vue';
import { lockClosedOutline } from 'ionicons/icons';
import { translate } from '@common';

const props = withDefaults(defineProps<{
  label: string;
  value?: string | null;
  hideValue?: boolean;
  isUpdatable?: boolean;
}>(), {
  value: '',
  hideValue: false,
  isUpdatable: true,
});

const hasValue = computed(() => {
  const value = props.value;
  return value !== null && value !== undefined && String(value).trim() !== '';
});
</script>

<style scoped>
.identification-kv {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 16px;
}

.identification-kv__type {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 1 1 10rem;
  color: var(--ion-color-medium);
}

.identification-kv__value {
  flex: 1 1 10rem;
  word-break: break-word;
}

.identification-kv__badge {
  font-size: 0.9rem;
  opacity: 0.6;
}
</style>
