<template>
  <ion-card>
    <ion-item lines="none">
      <ion-checkbox
        v-if="selectable"
        slot="start"
        :model-value="selected"
        @ionChange="emit('update:selected', Boolean($event.detail.checked))"
      />
      <ion-label>
        {{ task.orderName || task.orderId }}
        <p>{{ task.orderDate || '-' }}</p>
      </ion-label>
      <ion-chip slot="end" outline color="medium">
        {{ translate('Task') }}: {{ task.workEffortId }}
      </ion-chip>
      <ion-note slot="end" color="dark">{{ money(task.grandTotal) }}</ion-note>
    </ion-item>

    <ion-card-content>
      <div class="contact-details border-top ion-padding-top">
        <ion-item lines="none">
          <ion-icon slot="start" :icon="personOutline" />
          <ion-label>
            {{ getCustomerName(task.customer) }}
            <p>{{ translate('Customer') }}</p>
          </ion-label>
          <ion-buttons slot="end">
            <ion-button
              fill="clear"
              :disabled="!phoneHref"
              :href="phoneHref"
            >
              <ion-icon slot="icon-only" :icon="callOutline" />
            </ion-button>
            <ion-button
              fill="clear"
              :disabled="!emailHref"
              :href="emailHref"
            >
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

      <div class="task-details border-top ion-padding-top">
        <ion-list lines="none">
          <ion-item>
            <ion-label>
              {{ task.workEffortName || task.workEffortId }}
              <p>{{ task.purposeDescription || task.workEffortPurposeTypeId || '-' }}</p>
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

      <div class="actions border-top ion-margin-top ion-padding-top">
        <ion-buttons>
          <ion-button fill="solid" color="primary" @click="emit('resolve', task.workEffortId)">{{ translate('Resolve task') }}</ion-button>
          <ion-button v-if="showViewOrder" fill="outline" color="secondary" :router-link="'/orders/' + task.orderId">{{ translate('View order') }}</ion-button>
        </ion-buttons>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
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
} from '@ionic/vue';
import { callOutline, mailOutline, personOutline } from 'ionicons/icons';
import { commonUtil, translate } from '@common';

const props = withDefaults(defineProps<{
  task: any;
  selectable?: boolean;
  selected?: boolean;
  showViewOrder?: boolean;
}>(), {
  selectable: true,
  selected: false,
  showViewOrder: true,
});

const emit = defineEmits<{
  (event: 'update:selected', selected: boolean): void;
  (event: 'resolve', workEffortId: string): void;
}>();

const resolutionComment = ref('');

const phoneHref = computed(() => {
  const phone = props.task.billingPhone;
  const formatted = commonUtil.formatPhoneNumber(phone?.countryCode, phone?.areaCode, phone?.contactNumber);
  return formatted ? `tel:${formatted}` : '';
});

const emailHref = computed(() => {
  const email = props.task.billingEmail ?? props.task.shippingEmail;
  return email ? `mailto:${email}` : '';
});

function getCustomerName(customer: any): string {
  return [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || customer?.groupName || translate('Unknown');
}

function getAssignedParty(task: any, roleTypeId: string): string {
  const party = task.assignedParties?.find((p: any) => p.roleTypeId === roleTypeId);
  if (!party) return roleTypeId === 'TASK_ASSIGNEE' ? translate('Unassigned') : translate('System');
  return party.groupName || [party.firstName, party.lastName].filter(Boolean).join(' ') || party.partyId;
}

function money(value: number) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}
</script>

<style scoped>
.border-top {
  border-top: 1px solid var(--ion-color-light);
}
</style>
