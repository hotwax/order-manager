<template>
  <TaskCardShell
    :title="taskOrderTitle(task)"
    :subtitle="taskOrderSubtitle(task.orderDate, translate('Ordered'))"
    :amount="formatTaskAmount(task.grandTotal)"
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
    :view-order-link="showViewOrderAction && task.orderId ? `/orders/${task.orderId}` : ''"
    @update:selected="emit('update:selected', $event)"
    @action="handleAction"
  >
    <ion-list lines="full">
      <ion-item>
        <ion-label>
          {{ task.workEffortName }}
          <p>{{ task.purposeDescription }}</p>
        </ion-label>
        <ion-note slot="end" v-if="task.estimatedCompletionDate">{{ task.estimatedCompletionDate }}</ion-note>
      </ion-item>
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

  </TaskCardShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { DateTime } from 'luxon';
import {
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

const orderTaskStore = useOrderTaskStore();

const cardActions = computed<TaskCardAction[]>(() => [
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

function handleAction(actionId: string) {
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

  const value = String(fromDate);
  const numericValue = Number(value);
  const dt = Number.isFinite(numericValue)
    ? DateTime.fromMillis(value.length <= 10 ? numericValue * 1000 : numericValue)
    : (DateTime.fromISO(value).isValid ? DateTime.fromISO(value) : DateTime.fromSQL(value));

  return dt.isValid ? dt.toFormat('yyyy-LL-dd HH:mm') : value;
}

defineExpose({
  task: props.task,
  submitResolve,
});
</script>
