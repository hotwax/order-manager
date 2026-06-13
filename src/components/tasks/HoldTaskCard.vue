<template>
  <TaskCardShell
    :title="taskOrderTitle(task)"
    :subtitle="formatTaskDate(task.orderDate)"
    :amount="money(task.grandTotal)"
    :chip-label="task.workEffortId"
    :contact-name="getCustomerName(task.customer)"
    :contact-phone="getPhoneNumber(task)"
    :contact-phone-href="getPhoneHref(task)"
    :contact-email="getEmailAddress(task)"
    :contact-email-href="getEmailHref(task)"
    content-layout="grid"
    :selectable="selectable"
    :selected="selected"
    @update:selected="emit('update:selected', $event)"
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

    <template #actions>
      <ion-button fill="clear" color="primary" @click="resolveTask()">{{ translate('Resolve task') }}</ion-button>
      <ion-button v-if="showViewOrderAction && task.orderId" fill="clear" color="primary" :router-link="'/orders/' + task.orderId">{{ translate('View order') }}</ion-button>
    </template>
  </TaskCardShell>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { DateTime } from 'luxon';
import {
  IonButton,
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
import { formatTaskDate, taskOrderTitle } from '@/utils/taskCardDisplay';

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

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

defineExpose({
  task: props.task,
  submitResolve,
});
</script>
