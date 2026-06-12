<template>
  <WorkflowOrderList
    bucket="open"
    title="Open orders"
    search-placeholder="Order name, order ID, external ID"
    empty-title="No open orders"
    empty-message="Approved or newly created orders awaiting routing will appear here."
    show-facility
  />
</template>

<script setup lang="ts">
import WorkflowOrderList from '@/components/orders/WorkflowOrderList.vue';
</script>
