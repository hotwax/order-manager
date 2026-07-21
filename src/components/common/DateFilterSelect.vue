<template>
  <div
    class="date-filter-select"
    :id="outlined ? triggerId : undefined"
    :role="outlined ? 'button' : undefined"
    :tabindex="outlined ? 0 : undefined"
    :aria-label="outlined ? `${label}: ${selectedDateLabel}` : undefined"
    @keydown.enter="activateOutlinedTrigger"
    @keydown.space.prevent="activateOutlinedTrigger"
  >
    <ion-input
      v-if="outlined"
      :value="selectedDateLabel"
      :label="label"
      label-placement="stacked"
      fill="outline"
      readonly
    />
    <ion-item v-else :id="triggerId" button detail="false" lines="none">
      <ion-label>
        <p>{{ label }}</p>
        {{ selectedDateLabel }}
      </ion-label>
    </ion-item>

    <ion-popover :trigger="triggerId" trigger-action="click" :show-backdrop="false">
      <ion-datetime
        presentation="date"
        :show-default-buttons="true"
        :value="modelValue || undefined"
        @ionChange="emit('update:modelValue', normalizeDate($event.detail.value))"
      />
    </ion-popover>
  </div>
</template>

<script lang="ts">
let dateFilterSelectCounter = 0;
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { IonDatetime, IonInput, IonItem, IonLabel, IonPopover } from '@ionic/vue';
import { DateTime } from 'luxon';
import { translate } from '@common';

const props = withDefaults(defineProps<{
  modelValue: string;
  label: string;
  outlined?: boolean;
}>(), {
  modelValue: '',
  outlined: false,
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
}>();

const triggerId = `date-filter-select-${(dateFilterSelectCounter += 1)}`;

const selectedDateLabel = computed(() => {
  if (!props.modelValue) return translate('Select date');

  const parsedDate = DateTime.fromISO(props.modelValue);
  return parsedDate.isValid ? parsedDate.toLocaleString(DateTime.DATE_MED) : props.modelValue;
});

function normalizeDate(value: string | string[] | null | undefined): string {
  if (!value) return '';
  const selectedValue = Array.isArray(value) ? value[0] : value;
  return selectedValue ? String(selectedValue).slice(0, 10) : '';
}

function activateOutlinedTrigger(event: KeyboardEvent) {
  if (!props.outlined) return;
  (event.currentTarget as HTMLElement)?.click();
}
</script>

<style scoped>
.date-filter-select {
  flex: 0 0 11rem;
  max-width: 11rem;
  min-width: 11rem;
}

.date-filter-select ion-item {
  width: 100%;
}

@media (max-width: 640px) {
  .date-filter-select {
    flex: 1 1 auto;
    max-width: none;
    min-width: 0;
    width: 100%;
  }
}
</style>
