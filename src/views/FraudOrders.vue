<template>
  <WorkflowOrderList
    bucket="fraud"
    title="Fraud review"
    search-placeholder="Order, external ID, customer"
    empty-title="No fraud reviews"
    empty-message="Orders held for suspicious payment or details awaiting human audit will appear here."
  />
</template>

<script setup lang="ts">
import WorkflowOrderList from '@/components/WorkflowOrderList.vue';
</script>
