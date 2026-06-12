<template>
  <ion-item lines="none" class="select-all-item">
    <ion-checkbox
      slot="start"
      :checked="modelValue"
      @ionChange="emit('update:modelValue', $event.detail.checked)"
    />
    <ion-label>{{ label || translate('Select all results') }}</ion-label>
    <ion-note slot="end">{{ count }}</ion-note>
  </ion-item>
</template>

<script setup lang="ts">
import { IonCheckbox, IonItem, IonLabel, IonNote } from '@ionic/vue';
import { translate } from '@common';

defineProps<{
  modelValue: boolean;
  count: number;
  label?: string;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
}>();
</script>
