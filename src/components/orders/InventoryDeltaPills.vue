<template>
  <!-- Stock after a movement, as Order Routing's inventory history shows it: the balance, then the
       signed change in parentheses, coloured by direction. A missing balance shows the change alone. -->
  <div class="header-deltas">
    <span v-for="figure in figures" :key="figure.label" class="delta-pill">
      <small>{{ translate(figure.label) }}</small>
      <span class="delta-value">
        <span v-if="figure.balance != null" class="movement-balance">{{ figure.balance }}</span>
        <span v-if="figure.change != null" :class="changeClass(figure.change)">
          {{ figure.balance != null ? `(${signedChange(figure.change)})` : signedChange(figure.change) }}
        </span>
      </span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { translate } from "@common";
import { computed } from "vue";
import { changeClass, signedChange } from "@/utils/inventoryMovement";

type Figure = { balance?: number | null; change?: number | null };

const props = defineProps<{
  atp: Figure;
  qoh: Figure;
}>();

const figures = computed(() => [
  { label: "ATP", ...props.atp },
  { label: "QOH", ...props.qoh },
]);
</script>

<style scoped>
.header-deltas {
  display: flex;
  flex: 0 0 auto;
  gap: var(--spacer-sm, 12px);
  align-items: center;
}

.delta-pill {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.1;
}

.delta-pill small {
  color: var(--ion-color-medium);
}

.delta-value {
  display: flex;
  align-items: baseline;
  gap: var(--spacer-2xs, 4px);
}

.movement-balance {
  font-variant-numeric: tabular-nums;
}

.diff-positive {
  color: var(--ion-color-success, #2dd36f);
}

.diff-negative {
  color: var(--ion-color-danger, #eb445a);
}
</style>
