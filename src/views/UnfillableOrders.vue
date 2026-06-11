<template>
  <OrderQueueList
    :facility-ids="['UNFILLABLE_PARKING']"
    title="Unfillable"
    search-placeholder="Order, external ID, customer, email"
    empty-title="No unfillable orders"
    empty-message="Orders that could not be brokered to any facility will appear here."
  />
</template>

<script setup lang="ts">
import OrderQueueList from '@/components/OrderQueueList.vue';
</script>
