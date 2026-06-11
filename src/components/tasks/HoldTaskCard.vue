<template>
  <TaskCardShell
    :title="task.orderName"
    :subtitle="task.orderDate"
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
    <ion-list lines="none">
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

    <ion-list lines="none">
      <ion-item>
        <ion-label>
          {{ getAssignedParty(task, 'TASK_ASSIGNEE') }}
        </ion-label>
      </ion-item>
      <ion-item>
        <ion-label>
          <p class="overline">{{ translate('Reporter') }}</p>
          {{ getAssignedParty(task, 'TASK_REPORTER') }}
        </ion-label>
      </ion-item>
    </ion-list>

    <ion-list lines="none">
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
      <ion-button fill="clear" color="primary" :router-link="'/orders/' + task.orderId">{{ translate('View order') }}</ion-button>
    </template>
  </TaskCardShell>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
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

const props = withDefaults(defineProps<{ task: any; selectable?: boolean; selected?: boolean }>(), {
  selectable: false,
  selected: false,
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
      { text: translate('No'), role: 'cancel' },
      {
        text: translate('Yes'),
        role: 'confirm',
        handler: async () => {
          await orderTaskStore.changeTaskStatus(props.task.workEffortId, 'TASK_COMPLETED');
          emit('completed');
        }
      }
    ]
  });
  await alert.present();
}

async function submitResolve() {
  await orderTaskStore.changeTaskStatus(props.task.workEffortId, 'TASK_COMPLETED');
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

function getAssignedParty(task: any, roleTypeId: string): string {
  const party = task.assignedParties?.find((p: any) => p.roleTypeId === roleTypeId);
  if (!party) return roleTypeId === 'TASK_ASSIGNEE' ? translate('Unassigned') : translate('System');
  return party.groupName || [party.firstName, party.lastName].filter(Boolean).join(' ') || party.partyId;
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

defineExpose({
  task: props.task,
  submitResolve,
});
</script>
