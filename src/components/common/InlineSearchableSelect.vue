<template>
  <div class="inline-searchable-select">
    <ion-item
      :id="triggerId"
      class="inline-searchable-select-trigger"
      button
      detail="false"
      lines="none"
      :disabled="disabled"
    >
      <ion-label>
        <p>{{ label }}</p>
        <span :class="{ 'inline-searchable-select-placeholder': !selectedOption }">{{ displayText }}</span>
      </ion-label>
      <ion-icon slot="end" :icon="chevronDownOutline" />
    </ion-item>

    <ion-popover
      v-if="!disabled"
      ref="popoverRef"
      :trigger="triggerId"
      trigger-action="click"
      size="cover"
      :show-backdrop="false"
      @didPresent="focusSearch"
      @didDismiss="query = ''"
    >
      <ion-content>
        <ion-searchbar
          ref="searchbarRef"
          v-model="query"
          :debounce="0"
          :placeholder="searchPlaceholder || translate('Search')"
        />
        <ion-list class="inline-searchable-select-options">
          <ion-item
            v-for="option in filteredOptions"
            :key="option.value"
            button
            detail="false"
            @click="selectOption(option)"
          >
            <ion-label>
              {{ option.label }}
              <p v-if="option.description">{{ option.description }}</p>
            </ion-label>
            <ion-icon v-if="option.value === modelValue" slot="end" color="primary" :icon="checkmarkOutline" />
          </ion-item>
          <ion-item v-if="!filteredOptions.length" lines="none">
            <ion-label color="medium">{{ emptyText || translate('No results found') }}</ion-label>
          </ion-item>
        </ion-list>
      </ion-content>
    </ion-popover>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonIcon, IonItem, IonLabel, IonList, IonPopover, IonSearchbar } from '@ionic/vue';
import { checkmarkOutline, chevronDownOutline } from 'ionicons/icons';
import { translate } from '@common';

interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

const props = withDefaults(defineProps<{
  modelValue: string;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  disabledText?: string;
  options: SelectOption[];
  searchPlaceholder?: string;
  emptyText?: string;
}>(), {
  placeholder: '',
  disabled: false,
  disabledText: '',
  searchPlaceholder: '',
  emptyText: '',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

// Unique id so multiple instances on a page anchor their own popover.
const triggerId = `inline-searchable-select-${instanceCounter++}`;

const popoverRef = ref();
const searchbarRef = ref();
const query = ref('');

const selectedOption = computed(() => props.options.find((option) => option.value === props.modelValue));

const displayText = computed(() => {
  if (props.disabled && props.disabledText) return props.disabledText;
  return selectedOption.value?.label || props.placeholder || translate('Select');
});

const filteredOptions = computed(() => {
  const term = query.value.trim().toLowerCase();
  if (!term) return props.options;
  return props.options.filter((option) =>
    option.label.toLowerCase().includes(term)
    || (option.description?.toLowerCase().includes(term) ?? false)
  );
});

function selectOption(option: SelectOption) {
  emit('update:modelValue', option.value);
  popoverRef.value?.$el?.dismiss();
}

async function focusSearch() {
  await searchbarRef.value?.$el?.setFocus?.();
}
</script>

<script lang="ts">
// Module-scoped counter shared across instances to generate unique trigger ids.
let instanceCounter = 0;
</script>

<style scoped>
.inline-searchable-select-placeholder {
  color: var(--ion-color-medium);
}

.inline-searchable-select-options {
  max-height: 40vh;
  overflow-y: auto;
}
</style>
