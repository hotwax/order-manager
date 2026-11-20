<template>
  <ion-list-header class="find-results-header">
    <ion-checkbox
      v-if="selectMode"
      :checked="allSelected"
      :indeterminate="someSelected && !allSelected"
      :aria-label="selectAllLabel"
      @ionChange="emit('select-all', $event.detail.checked)"
    />
    <ion-label>{{ countLabel }}</ion-label>
    <slot />
    <ion-button fill="clear" size="small" @click="emit('toggle-select-mode')">
      {{ translate(selectMode ? 'Done' : 'Select') }}
    </ion-button>
  </ion-list-header>
</template>

<script setup lang="ts">
import { translate } from '@common';
import { IonButton, IonCheckbox, IonLabel, IonListHeader } from '@ionic/vue';

defineProps<{
  countLabel: string;
  selectAllLabel: string;
  selectMode: boolean;
  allSelected: boolean;
  someSelected: boolean;
}>();

const emit = defineEmits<{
  'select-all': [checked: boolean];
  'toggle-select-mode': [];
}>();
</script>

<style scoped>
.find-results-header {
  align-items: center;
  display: flex;
  gap: var(--spacer-xs);
}
</style>
