<template>
  <ion-list v-if="loadedCount || totalCount" lines="none">
    <ion-list-header>
      <ion-checkbox
        v-if="selectMode"
        :checked="allLoadedSelected"
        :indeterminate="someLoadedSelected && !allLoadedSelected"
        :aria-label="translate('Select all loaded tasks')"
        @ionChange="emit('toggle-loaded-selection', $event.detail.checked)"
      />
      <ion-label>{{ resultsSummary }}</ion-label>
      <OrderSortPopover
        :model-value="sort"
        :options="sortOptions"
        :trigger-id="triggerId"
        @update:modelValue="updateSort"
      />
      <ion-button fill="clear" size="small" @click="emit('toggle-select-mode')">
        {{ selectMode ? translate('Done') : translate('Select') }}
      </ion-button>
    </ion-list-header>
  </ion-list>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonButton, IonCheckbox, IonLabel, IonList, IonListHeader } from '@ionic/vue';
import { translate } from '@common';
import OrderSortPopover from '@/components/orders/OrderSortPopover.vue';
import type { TaskSort, TaskSortOption } from '@/types/orderTaskFilters';

const props = defineProps<{
  loadedCount: number;
  totalCount: number;
  singularLabel: string;
  pluralLabel: string;
  sort: TaskSort;
  sortOptions: TaskSortOption[];
  triggerId: string;
  selectMode: boolean;
  allLoadedSelected: boolean;
  someLoadedSelected: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:sort', value: TaskSort): void;
  (event: 'toggle-select-mode'): void;
  (event: 'toggle-loaded-selection', checked: boolean): void;
}>();

const resultsSummary = computed(() => {
  const effectiveTotal = Math.max(props.totalCount, props.loadedCount);
  const label = effectiveTotal === 1 ? props.singularLabel : props.pluralLabel;
  return `${props.loadedCount} ${translate('of')} ${effectiveTotal} ${translate(label)}`;
});

function updateSort(value: string) {
  emit('update:sort', value as TaskSort);
}
</script>
