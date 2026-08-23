<template>
  <ion-list lines="none" class="hold-tasks-list">
    <ion-item
      v-for="holdTask in sortedHoldTaskCounts"
      :key="holdTask.workEffortPurposeTypeId"
      button
      :detail="true"
      :href="routeHref(holdTaskRoute(holdTask.workEffortPurposeTypeId))"
      @click="navigateRoute($event, holdTaskRoute(holdTask.workEffortPurposeTypeId))"
    >
      <ion-label>{{ holdTaskLabel(holdTask) }}</ion-label>
      <p slot="end">{{ holdTask.taskCount }} {{ translate("tasks") }}</p>
    </ion-item>
  </ion-list>
</template>

<script setup lang="ts">
import { IonItem, IonLabel, IonList } from '@ionic/vue';
import { computed } from 'vue';
import { translate } from '@common';
import type { HoldTaskCount } from '@/types/customerService';
import { nativeRouteHref, navigateNativeRoute } from '@/utils/nativeRouterLink';
import router from '@/router';
import type { RouteLocationRaw } from 'vue-router';

const props = defineProps<{
  holdTaskCounts: HoldTaskCount[];
}>();

const knownPurposeLabels: Record<string, string> = {
  NEG_RES_REVIEW: 'Substitute',
  INVALID_ADDRESS: 'Bad Address',
  REVIEW_RISK_ORDER: 'Fraud Risk'
};

function holdTaskLabel(holdTask: HoldTaskCount) {
  const knownLabel = knownPurposeLabels[holdTask.workEffortPurposeTypeId];
  return knownLabel ? translate(knownLabel) : holdTask.description || holdTask.workEffortPurposeTypeId;
}

// Sorted on the resolved label, since that is the order the reader actually sees.
const sortedHoldTaskCounts = computed(() => [...props.holdTaskCounts].sort((left, right) => holdTaskLabel(left).localeCompare(holdTaskLabel(right))));

function holdTaskRoute(workEffortPurposeTypeId: string) {
  if (workEffortPurposeTypeId === 'NEG_RES_REVIEW') return '/swap';
  if (workEffortPurposeTypeId === 'INVALID_ADDRESS') return '/bad-address';
  if (workEffortPurposeTypeId === 'REVIEW_RISK_ORDER') return '/fraud';

  return {
    path: '/hold',
    query: { purpose: workEffortPurposeTypeId }
  };
}

function routeHref(destination: RouteLocationRaw) {
  return nativeRouteHref(router, destination);
}

function navigateRoute(event: MouseEvent, destination: RouteLocationRaw) {
  return navigateNativeRoute(event, router, destination);
}
</script>
