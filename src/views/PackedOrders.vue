<template>
  <WorkflowOrderList
    bucket="packed"
    title="Packed orders"
    search-placeholder="Order, external ID, customer"
    empty-title="No packed orders"
    empty-message="Orders that are packed and awaiting pickup by carrier will appear here."
  />
</template>

<script setup lang="ts">
import WorkflowOrderList from '@/components/WorkflowOrderList.vue';
</script>
