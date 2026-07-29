<template>
  <ion-list lines="none" class="hold-tasks-list">
    <ion-item
      v-for="holdTask in holdTaskCounts"
      :key="holdTask.workEffortPurposeTypeId"
      button
      :detail="true"
      :router-link="holdTaskRoute(holdTask.workEffortPurposeTypeId)"
    >
      <ion-label>{{ holdTaskLabel(holdTask) }}</ion-label>
      <p slot="end">{{ holdTask.taskCount }} {{ translate("tasks") }}</p>
    </ion-item>
  </ion-list>
</template>

<script setup lang="ts">
import { IonItem, IonLabel, IonList } from '@ionic/vue';
import { translate } from '@common';
import { useRouter } from 'vue-router';
import type { HoldTaskCount } from '@/types/customerService';
import { resolveHoldTaskRouterLink } from '@/utils/funnelRoutes';

defineProps<{
  holdTaskCounts: HoldTaskCount[];
}>();

const router = useRouter();

const knownPurposeLabels: Record<string, string> = {
  NEG_RES_REVIEW: 'Substitute',
  INVALID_ADDRESS: 'Bad Address',
  REVIEW_RISK_ORDER: 'Fraud Risk'
};

function holdTaskLabel(holdTask: HoldTaskCount) {
  const knownLabel = knownPurposeLabels[holdTask.workEffortPurposeTypeId];
  return knownLabel ? translate(knownLabel) : holdTask.description || holdTask.workEffortPurposeTypeId;
}

function holdTaskRoute(workEffortPurposeTypeId: string) {
  return resolveHoldTaskRouterLink(router, workEffortPurposeTypeId);
}
</script>
