<template>
  <WorkflowOrderList
    bucket="inflight"
    title="Inflight orders"
    search-placeholder="Order name, order ID, external ID"
    empty-title="No inflight orders"
    empty-message="Orders that have arrived at a warehouse but aren't on a picklist yet will appear here."
    show-facility
  />
</template>

<script setup lang="ts">
import WorkflowOrderList from '@/components/orders/WorkflowOrderList.vue';
</script>
