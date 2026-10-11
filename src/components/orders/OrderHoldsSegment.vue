<template>
  <div>
    <template v-if="hasTasks">
      <BadAddressTaskCard v-for="task in addressValidationTasks" :key="task.workEffortId" :task="task"
        :countries="seed.getCountries" @completed="emit('completed')" />
      <SwapTaskCard v-for="task in swapTasks" :key="task.workEffortId" :task="task" @completed="emit('completed')" />
      <FraudTaskCard v-for="task in fraudTasks" :key="task.workEffortId" :task="task" @completed="emit('completed')" />
      <HoldTaskCard v-for="task in holdTasks" :key="task.workEffortId" :task="task" @completed="emit('completed')" />
    </template>
    <template v-else>
      <EmptyState :title="translate('No holds')" :message="translate('No holds on this order')" />
      <div class="ion-text-center ion-padding">
        <ion-button fill="outline" @click="emit('create-hold-task')">{{ translate('Create hold task') }}</ion-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonButton } from '@ionic/vue';
import { translate } from '@common';
import BadAddressTaskCard from '@/components/tasks/BadAddressTaskCard.vue';
import SwapTaskCard from '@/components/tasks/SwapTaskCard.vue';
import FraudTaskCard from '@/components/tasks/FraudTaskCard.vue';
import HoldTaskCard from '@/components/tasks/HoldTaskCard.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { useSeedStore } from '@/store/seed';

const props = defineProps<{
  addressValidationTasks: any[];
  swapTasks: any[];
  fraudTasks: any[];
  holdTasks: any[];
}>();

const emit = defineEmits<{
  completed: [];
  'create-hold-task': [];
}>();

const seed = useSeedStore();
const hasTasks = computed(() =>
  [props.addressValidationTasks, props.swapTasks, props.fraudTasks, props.holdTasks].some((tasks) => tasks.length));
</script>
