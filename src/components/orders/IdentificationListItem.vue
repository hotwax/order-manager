<template>
  <ion-item>
    <ion-label>
      <p>{{ label }}</p>
      <template v-if="!hideValue">{{ hasValue ? value : translate('Value not available') }}</template>
    </ion-label>
    <slot name="end" />
  </ion-item>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonItem, IonLabel } from '@ionic/vue';
import { translate } from '@common';

const props = withDefaults(defineProps<{
  label: string;
  value?: string | null;
  hideValue?: boolean;
}>(), {
  value: '',
  hideValue: false,
});

const hasValue = computed(() => {
  const value = props.value;
  return value !== null && value !== undefined && String(value).trim() !== '';
});
</script>
