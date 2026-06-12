<template>
  <ion-select
    :value="modelValue"
    :label="label"
    label-placement="stacked"
    interface="popover"
    :placeholder="placeholderText"
    :selected-text="restingSelectedText"
    @ionChange="updateValue"
  >
    <slot />
  </ion-select>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonSelect } from '@ionic/vue';
import { translate } from '@common';

const props = withDefaults(defineProps<{
  modelValue: string;
  label: string;
  placeholder?: string;
}>(), {
  modelValue: '',
  placeholder: '',
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
}>();

const placeholderText = computed(() => props.placeholder || translate('Select'));
const restingSelectedText = computed(() => props.modelValue ? undefined : placeholderText.value);

function updateValue(event: CustomEvent) {
  emit('update:modelValue', event.detail.value == null ? '' : String(event.detail.value));
}
</script>
