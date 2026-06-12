<template>
  <OrderQueueList
    :facility-ids="['_NA_', 'REJECTED_PARKING']"
    title="Brokering queue"
    search-placeholder="Order, external ID, customer, email"
    empty-title="No orders awaiting brokering"
    empty-message="Approved orders awaiting brokering and items rejected by a facility will appear here."
  />
</template>

<script setup lang="ts">
import OrderQueueList from '@/components/OrderQueueList.vue';
</script>
