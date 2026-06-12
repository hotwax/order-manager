<template>
  <WorkflowOrderList
    bucket="packed"
    title="Packed orders"
    search-placeholder="Order name, order ID, external ID"
    empty-title="No packed orders"
    empty-message="Orders that are packed and awaiting pickup by carrier will appear here."
    show-facility
  />
</template>

<script setup lang="ts">
import WorkflowOrderList from '@/components/orders/WorkflowOrderList.vue';
</script>
