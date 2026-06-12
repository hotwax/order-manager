<template>
  <ion-item lines="full">
    <ion-toggle
      :checked="modelValue"
      justify="space-between"
      @ionChange="emit('update:modelValue', $event.detail.checked)"
    >
      {{ label }}
    </ion-toggle>
  </ion-item>
</template>

<script setup lang="ts">
import { IonItem, IonToggle } from '@ionic/vue';

defineProps<{
  modelValue: boolean;
  label: string;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
}>();
</script>
