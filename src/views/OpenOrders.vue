<template>
  <WorkflowOrderList
    bucket="open"
    title="Open orders"
    search-placeholder="Order, external ID, customer"
    empty-title="No open orders"
    empty-message="Approved or newly created orders awaiting routing will appear here."
  />
</template>

<script setup lang="ts">
import WorkflowOrderList from '@/components/WorkflowOrderList.vue';
</script>
