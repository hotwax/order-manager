<template>
  <div class="order-holds-segment">
    <template v-if="hasOrderHoldTasks">
      <BadAddressTaskCard
        v-for="task in orderAddressValidationTasks"
        :key="task.workEffortId"
        :task="task"
        :countries="countries"
        @completed="$emit('completed')"
      />
      <SwapTaskCard
        v-for="task in orderSwapTasks"
        :key="task.workEffortId"
        :task="task"
        @completed="$emit('completed')"
      />
      <FraudTaskCard
        v-for="task in orderFraudTasks"
        :key="task.workEffortId"
        :task="task"
        @completed="$emit('completed')"
      />
      <HoldTaskCard
        v-for="task in orderHoldTasks"
        :key="task.workEffortId"
        :task="task"
        @completed="$emit('completed')"
      />
    </template>
    <template v-else>
      <EmptyState :title="translate('No holds')" :message="translate('No holds on this order')" />
      <div class="ion-text-center ion-padding">
        <ion-button fill="outline" @click="$emit('create-hold-task')">
          {{ translate('Create hold task') }}
        </ion-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { IonButton } from '@ionic/vue';
import BadAddressTaskCard from '@/components/tasks/BadAddressTaskCard.vue';
import SwapTaskCard from '@/components/tasks/SwapTaskCard.vue';
import FraudTaskCard from '@/components/tasks/FraudTaskCard.vue';
import HoldTaskCard from '@/components/tasks/HoldTaskCard.vue';
import EmptyState from '@/components/common/EmptyState.vue';

defineProps<{
  hasOrderHoldTasks: boolean;
  orderAddressValidationTasks: any[];
  orderSwapTasks: any[];
  orderFraudTasks: any[];
  orderHoldTasks: any[];
  countries: any[];
  translate: (key: string) => string;
}>();

defineEmits<{
  (e: 'completed'): void;
  (e: 'create-hold-task'): void;
}>();
</script>
