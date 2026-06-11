<template>
  <ion-card>
    <ion-card-content>
      <ion-searchbar
        :value="modelValue"
        :placeholder="placeholder"
        @ionInput="updateSearch"
        @ionChange="$emit('search')"
      />

      <div class="search-filter-grid">
        <slot />
        <ion-button v-if="showClear" fill="clear" @click="$emit('clear')">{{ translate('Clear') }}</ion-button>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { IonButton, IonCard, IonCardContent, IonSearchbar } from '@ionic/vue';
import { translate } from '@common';

withDefaults(defineProps<{
  modelValue: string;
  placeholder: string;
  showClear?: boolean;
}>(), {
  showClear: true,
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
  (event: 'clear'): void;
  (event: 'search'): void;
}>();

function updateSearch(event: CustomEvent) {
  emit('update:modelValue', event.detail.value || '');
}
</script>

<style scoped>
.search-filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--spacer-base);
  align-items: end;
}

@media (max-width: 640px) {
  .search-filter-grid {
    grid-template-columns: 1fr;
  }
}
</style>
