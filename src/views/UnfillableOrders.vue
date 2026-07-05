<template>
  <OrderQueueList
    :facility-ids="['UNFILLABLE_PARKING']"
    title="Unfillable"
    search-placeholder="Order, external ID, customer, email"
    empty-title="No unfillable orders"
    empty-message="Orders that could not be brokered to any facility will appear here."
    :global-actions="['brokerSelected']"
    :status="['ORDER_CREATED', 'ORDER_APPROVED', 'ORDER_HOLD']"
    :date-from="dateFrom"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import router from '@/router';
import OrderQueueList from '@/components/OrderQueueList.vue';

const dateFrom = computed(() => {
  const routeDateFrom = router.currentRoute.value.query.dateFrom;
  if (Array.isArray(routeDateFrom)) return routeDateFrom[0] || '';

  return routeDateFrom ? String(routeDateFrom) : '';
});
</script>
