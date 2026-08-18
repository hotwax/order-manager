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
    :date-thru="dateThru"
    count-key="unfillable"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import router from '@/router';
import OrderQueueList from '@/components/OrderQueueList.vue';

// The funnel's Unfillable card deep-links into a single order date, so both
// bounds come from the route and seed the queue's own date filters.
function queryDate(name: string) {
  return computed(() => {
    const value = router.currentRoute.value.query[name];
    if (Array.isArray(value)) return value[0] || '';
    return value ? String(value) : '';
  });
}

const dateFrom = queryDate('dateFrom');
const dateThru = queryDate('dateThru');
</script>
