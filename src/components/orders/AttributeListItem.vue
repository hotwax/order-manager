<template>
  <div class="attribute-kv">
    <dl class="attribute-kv__terms">
      <dt>{{ name }}</dt>
      <dd class="attribute-kv__value">
        {{ hasValue ? value : translate('Value not available') }}
      </dd>
      <dd v-if="description" class="attribute-kv__description">{{ description }}</dd>
    </dl>
    <slot name="end" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { translate } from '@common';

const props = withDefaults(defineProps<{
  name: string;
  value?: string | null;
  description?: string;
}>(), {
  value: '',
  description: '',
});

const hasValue = computed(() => {
  const value = props.value;
  return value !== null && value !== undefined && String(value).trim() !== '';
});
</script>

<style scoped>
.attribute-kv {
  display: flex;
  align-items: center;
  gap: var(--spacer-sm);
  min-height: 48px;
  padding: var(--spacer-xs) var(--spacer-sm);
}

.attribute-kv__terms {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 2px var(--spacer-sm);
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
}

.attribute-kv__value {
  margin: 0;
  word-break: break-word;
}

.attribute-kv__description {
  flex: 1 0 100%;
  margin: var(--spacer-2xs) 0 0;
}

.attribute-kv > :slotted(*) {
  flex: 0 0 auto;
}
</style>
