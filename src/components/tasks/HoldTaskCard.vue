<template>
  <ion-card>
    <ion-item lines="none">
      <ion-checkbox
        v-if="selectable"
        slot="start"
        :checked="selected"
        @ion-change="emit('update:selected', $event.detail.checked)"
      />
      <ion-label>
        {{ task.orderName }}
        <p>{{ task.orderDate }}</p>
      </ion-label>
      <ion-chip slot="end" outline color="medium">
        {{ translate('Task') }}: {{ task.workEffortId }}
      </ion-chip>
      <ion-note slot="end" color="dark">{{ money(task.grandTotal) }}</ion-note>
    </ion-item>

    <ion-card-content>
      <!-- Contact Details -->
      <div class="contact-details border-top ion-padding-top">
        <ion-item lines="none">
          <ion-icon slot="start" :icon="personOutline" />
          <ion-label>
            {{ getCustomerName(task.customer) }}
            <p>{{ translate('Customer') }}</p>
          </ion-label>
          <ion-buttons slot="end">
            <ion-button fill="clear" :href="'tel:' + commonUtil.formatPhoneNumber(task.billingPhone?.countryCode, task.billingPhone?.areaCode, task.billingPhone?.contactNumber)">
              <ion-icon slot="icon-only" :icon="callOutline" />
            </ion-button>
            <ion-button fill="clear" :href="'mailto:' + (task.billingEmail ?? task.shippingEmail)">
              <ion-icon slot="icon-only" :icon="mailOutline" />
            </ion-button>
          </ion-buttons>
        </ion-item>

        <ion-item lines="none" v-if="task.customerPhone">
          <ion-label>
            <p>{{ translate('Telecom contact') }}</p>
            {{ task.customerPhone }}
          </ion-label>
        </ion-item>

        <ion-item lines="none" v-if="task.customerEmail">
          <ion-label>
            <p>{{ translate('Email contact') }}</p>
            {{ task.customerEmail }}
          </ion-label>
        </ion-item>
      </div>

      <!-- Task Details -->
      <div class="task-details border-top ion-padding-top">
        <ion-list lines="none">
          <ion-item>
            <ion-label>
              {{ task.workEffortName }}
              <p>{{ task.purposeDescription }}</p>
            </ion-label>
            <ion-note slot="end" v-if="task.estimatedCompletionDate">{{ translate('Due') }}: {{ task.estimatedCompletionDate }}</ion-note>
          </ion-item>
          <ion-item v-if="task.notes">
            <ion-label>
              <p>{{ translate('Notes') }}</p>
              {{ task.notes }}
            </ion-label>
          </ion-item>
        </ion-list>

        <ion-list lines="none" class="ion-margin-top">
          <ion-item>
            <ion-label>
              {{ getAssignedParty(task, 'TASK_ASSIGNEE') }}
              <p>{{ translate('Assignee') }}</p>
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-label>
              {{ getAssignedParty(task, 'TASK_REPORTER') }}
              <p>{{ translate('Reporter') }}</p>
            </ion-label>
          </ion-item>
        </ion-list>

        <ion-list lines="none" class="ion-margin-top">
          <ion-item>
            <ion-textarea
              :label="translate('Resolution comment')"
              label-placement="stacked"
              :placeholder="translate('Enter resolution comment...')"
              v-model="resolutionComment"
            />
          </ion-item>
        </ion-list>
      </div>

      <!-- Actions -->
      <div class="actions border-top ion-margin-top ion-padding-top">
        <ion-buttons>
          <ion-button fill="solid" color="primary" @click="resolveTask()">{{ translate('Resolve task') }}</ion-button>
          <ion-button fill="outline" color="secondary" :router-link="'/orders/' + task.orderId">{{ translate('View order') }}</ion-button>
        </ion-buttons>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCheckbox,
  IonChip,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTextarea,
  alertController,
} from '@ionic/vue';
import {
  personOutline,
  callOutline,
  mailOutline,
} from 'ionicons/icons';
import { commonUtil, translate } from '@common';
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

<style scoped>
.border-top {
  border-top: 1px solid var(--ion-color-light);
}
</style>
