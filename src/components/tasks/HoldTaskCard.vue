<template>
  <TaskCardShell class="rich-hold-card"
    :title="taskOrderTitle(task)"
    :subtitle="taskOrderSubtitle(task.orderDate, translate('Ordered'))"
    :amount="formatTaskAmount(task.grandTotal, task.currencyUom)"
    :task-created-date="task.workEffortCreatedDate"
    :contact-name="getCustomerName(task.customer)"
    :contact-phone="getPhoneNumber(task)"
    :contact-phone-href="getPhoneHref(task)"
    :contact-email="getEmailAddress(task)"
    :contact-email-href="getEmailHref(task)"
    content-layout="grid"
    :selectable="selectable"
    :selected="selected"
    :actions="cardActions"
    :view-order-link="showViewOrderAction && !localUiMock && task.orderId ? `/orders/${task.orderId}` : ''"
    @update:selected="emit('update:selected', $event)"
    @action="handleAction"
  >
    <ion-list lines="full">
      <ion-item>
        <ion-label class="ion-text-wrap">
          {{ task.workEffortName }}
          <p>{{ task.purposeDescription }}</p>
          <p class="ion-text-wrap" v-if="task.description">{{ task.description }}</p>
          <ion-chip v-if="task.priority" :color="task.priority === 'Urgent' ? 'danger' : task.priority === 'High' ? 'warning' : 'medium'">{{ translate(task.priority) }}</ion-chip>
        </ion-label>

      </ion-item>
      <ion-item v-if="task.estimatedCompletionDate"><ion-label><p class="overline">{{ translate('Follow up by') }}</p>{{ formatDateTime(task.estimatedCompletionDate) }}</ion-label></ion-item>
      <ion-item v-if="task.scopeLabel || task.blockingEffect"><ion-label class="ion-text-wrap"><p class="overline">{{ translate('Hold scope') }}</p>{{ task.scopeLabel }}<p>{{ task.blockingEffect }}</p></ion-label></ion-item>
      <ion-item v-if="task.notes">
        <ion-label>
          <p class="overline">{{ translate('Notes') }}</p>
          {{ task.notes }}
        </ion-label>
      </ion-item>
    </ion-list>

    <ion-list lines="full">
      <ion-item>
        <ion-label>
          <p class="overline">{{ translate('Assigned to') }}</p>
          {{ assignedPartyName(task, 'TASK_ASSIGNEE') }}
          <p v-if="assignedPartyDate(task, 'TASK_ASSIGNEE')">{{ assignedPartyDate(task, 'TASK_ASSIGNEE') }}</p>
        </ion-label>
      </ion-item>
      <ion-item>
        <ion-label>
          <p class="overline">{{ translate('Reporter') }}</p>
          {{ assignedPartyName(task, 'TASK_REPORTER') }}
        </ion-label>
      </ion-item>
    </ion-list>

    <ion-list lines="full">
      <ion-item>
        <ion-textarea
          :label="translate('Resolution comment')"
          label-placement="stacked"
          :placeholder="translate('Response')"
          v-model="resolutionComment"
        />
      </ion-item>
    </ion-list>

    <ion-list class="hold-activity" v-if="task.history?.length" lines="none" data-testid="hold-history">
     <ion-item><ion-label><h3>{{ translate('Activity') }}</h3></ion-label></ion-item>
     <ion-item v-for="event in task.history" :key="event.id"><ion-label class="ion-text-wrap">{{ event.message }}<p>{{ event.actor }} · {{ formatDateTime(event.at) }}</p></ion-label></ion-item>
    </ion-list>
  </TaskCardShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { formatDateTime } from '@/utils/format';
import {
  IonChip,
  modalController,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTextarea,
  alertController,
} from '@ionic/vue';
import { commonUtil, translate } from '@common';
import TaskCardShell from '@/components/tasks/TaskCardShell.vue';
import { useOrderTaskStore } from '@/store/orderTask';
import { formatTaskAmount, taskOrderSubtitle, taskOrderTitle } from '@/utils/taskCardDisplay';
import type { TaskCardAction } from '@/types/taskCard';

const props = withDefaults(defineProps<{ task: any; selectable?: boolean; selected?: boolean; showViewOrderAction?: boolean }>(), {
  selectable: false,
  selected: false,
  showViewOrderAction: false,
});

const emit = defineEmits<{
  (e: 'update:selected', value: boolean): void;
  (e: 'completed'): void;
}>();

import EditHoldDetailsModal from './EditHoldDetailsModal.vue';
import { useHoldDetailsStore } from '@/store/holdDetails';
const localUiMock = import.meta.env.DEV && import.meta.env.MODE === 'mock';
const details = localUiMock ? useHoldDetailsStore() : { byId: {} as Record<string,any>, people: [] as {id:string;name:string}[] };
const task = computed(() => ({ ...props.task, ...(localUiMock ? details.byId[props.task.workEffortId] : {}) }));
const orderTaskStore = useOrderTaskStore();

const cardActions = computed<TaskCardAction[]>(() => [
  ...(localUiMock ? [{id:'edit',label:translate('Edit hold'),kind:'neutral' as const}] : []),
  { id: 'resolve', label: translate('Resolve task'), kind: 'primary' },
]);

const resolutionComment = ref('');

watch(() => props.task, (task) => {
  resolutionComment.value = task?.resolutionComment ?? '';
}, { immediate: true });

async function resolveTask() {
  const alert = await alertController.create({
    header: translate('Resolve task'),
    message: translate('Are you sure you want to mark this task as resolved?'),
    buttons: [
      { text: translate('Cancel'), role: 'cancel' },
      {
        text: translate('Resolve task'),
        role: 'confirm',
        handler: async () => {
          await orderTaskStore.changeTaskStatus(props.task.workEffortId, 'TASK_COMPLETED', resolutionCommunication());
          emit('completed');
        }
      }
    ]
  });
  await alert.present();
}

async function submitResolve() {
  await orderTaskStore.changeTaskStatus(props.task.workEffortId, 'TASK_COMPLETED', resolutionCommunication());
}

async function handleAction(actionId: string) {
  if (actionId === 'edit') { const modal = await modalController.create({ component: EditHoldDetailsModal, componentProps: { task: task.value, people: details.people } }); await modal.present(); return; }
  if (actionId === 'resolve') return resolveTask();
}

function resolutionCommunication() {
  const content = resolutionComment.value.trim();
  return content ? { content } : undefined;
}

function getCustomerName(customer: any): string {
  return [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || translate('Unknown');
}

function getPhoneNumber(task: any): string {
  return task.customerPhone || commonUtil.formatPhoneNumber(task.billingPhone?.countryCode, task.billingPhone?.areaCode, task.billingPhone?.contactNumber);
}

function getPhoneHref(task: any): string {
  const phone = getPhoneNumber(task);
  return phone ? `tel:${phone}` : '';
}

function getEmailAddress(task: any): string {
  return task.customerEmail || task.billingEmail || task.shippingEmail || '';
}

function getEmailHref(task: any): string {
  const email = getEmailAddress(task);
  return email ? `mailto:${email}` : '';
}

function assignedParty(task: any, roleTypeId: string): any {
  return task.assignedParties?.find((party: any) => party.roleTypeId === roleTypeId);
}

function assignedPartyName(task: any, roleTypeId: string): string {
  const party = assignedParty(task, roleTypeId);
  if (!party) return roleTypeId === 'TASK_ASSIGNEE' ? translate('Unassigned') : translate('System');
  return party.groupName || [party.firstName, party.lastName].filter(Boolean).join(' ') || party.partyId;
}

function assignedPartyDate(task: any, roleTypeId: string): string {
  const fromDate = assignedParty(task, roleTypeId)?.fromDate;
  if (!fromDate) return '';

  return formatDateTime(fromDate) || String(fromDate);
}

defineExpose({
  task: props.task,
  submitResolve,
});
</script>

<style scoped>
.rich-hold-card { container-type: inline-size; }
.rich-hold-card :deep(.ship-group-detail-columns) { display:grid;grid-template-columns:2fr 1fr 1.2fr; }
.rich-hold-card :deep(.ship-group-detail-columns > ion-list) { min-width:0; }
.hold-activity { grid-column:1/-1;border-top:1px solid var(--ion-color-light-shade);border-inline-end:0 !important; }
@container (max-width:700px) { .rich-hold-card :deep(.ship-group-detail-columns) {grid-template-columns:1fr;} .rich-hold-card :deep(.ship-group-detail-columns > ion-list) {border-inline-end:0;} }
</style>
