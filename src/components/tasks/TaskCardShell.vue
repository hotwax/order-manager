<template>
  <ion-card class="ship-group-card">
    <ion-card-header>
      <div class="order-task-header">
        <ion-checkbox
          v-if="selectable"
          :checked="selected"
          @ionChange="emit('update:selected', $event.detail.checked)"
        />
        <div>
          <ion-card-title>{{ title }}</ion-card-title>
          <ion-card-subtitle v-if="subtitle">{{ subtitle }}</ion-card-subtitle>
          <ion-card-subtitle v-if="amount">{{ amount }}</ion-card-subtitle>
        </div>
        <ion-badge
          v-if="taskAge"
          class="meta"
          color="dark"
          :title="taskCreatedTitle"
          :aria-label="taskCreatedTitle"
        >
          {{ taskAge }}
        </ion-badge>
      </div>
    </ion-card-header>

    <ion-progress-bar
      v-if="normalizedProgressValue !== undefined"
      :value="normalizedProgressValue"
      :color="progressColor || undefined"
    />

    <div v-if="hasContactDetails" class="ship-group-timeline">
      <ion-item lines="none">
        <ion-icon slot="start" :icon="personOutline" />
        <ion-label>
          {{ contactName || translate('Unknown') }}
        </ion-label>
        <ion-button v-if="contactName" slot="end" fill="outline" size="small" :aria-label="translate('Copy full name')" @click="copyContact(contactName)">
          {{ translate('Copy') }}
        </ion-button>
      </ion-item>
      <ion-item lines="none">
        <ion-icon slot="start" :icon="callOutline" />
        <ion-label>
          {{ contactPhone || '-' }}
        </ion-label>
        <ion-button v-if="contactPhone" slot="end" fill="outline" size="small" :aria-label="translate('Copy phone')" @click="copyContact(contactPhone)">
          {{ translate('Copy') }}
        </ion-button>
      </ion-item>
      <ion-item lines="none">
        <ion-icon slot="start" :icon="mailOutline" />
        <ion-label>
          {{ contactEmail || '-' }}
        </ion-label>
        <ion-button v-if="contactEmail" slot="end" fill="outline" size="small" :aria-label="translate('Copy email')" @click="copyContact(contactEmail)">
          {{ translate('Copy') }}
        </ion-button>
      </ion-item>
    </div>

    <div v-if="$slots['content-start'] || $slots.default">
      <slot name="content-start" />
      <div
        v-if="$slots.default"
        :class="{
          'ship-group-detail-columns': contentLayout === 'grid',
          'task-card-content-stack': contentLayout === 'stack',
        }"
      >
        <slot />
      </div>
    </div>

    <ion-item class="task-actions" lines="none" v-if="orderedActions.length || viewOrderLink">
      <ion-button
        v-for="action in orderedActions"
        :key="action.id"
        fill="clear"
        :color="actionColor(action.kind)"
        :disabled="action.disabled"
        @click="emit('action', action.id)"
      >
        {{ action.label }}
      </ion-button>
      <ion-button v-if="viewOrderLink" slot="end" fill="clear" color="primary" :router-link="viewOrderLink">
        {{ translate('View order') }}
      </ion-button>
    </ion-item>
  </ion-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonBadge, IonButton, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonCheckbox, IonIcon, IonItem, IonLabel, IonProgressBar } from '@ionic/vue';
import { callOutline, mailOutline, personOutline } from 'ionicons/icons';
import { commonUtil, translate } from '@common';
import type { TaskCardAction, TaskCardActionKind } from '@/types/taskCard';
import { taskAgeLabel, taskCreatedTimestampLabel } from '@/utils/taskCardDisplay';

const props = withDefaults(defineProps<{
  title: string;
  subtitle?: string;
  amount?: string;
  taskCreatedDate?: string | number;
  contactName?: string;
  contactPhone?: string;
  contactPhoneHref?: string;
  contactEmail?: string;
  contactEmailHref?: string;
  contentLayout?: 'grid' | 'stack';
  progressValue?: number;
  progressColor?: string;
  selectable?: boolean;
  selected?: boolean;
  actions?: TaskCardAction[];
  viewOrderLink?: string;
}>(), {
  subtitle: '',
  amount: '',
  taskCreatedDate: '',
  contactName: '',
  contactPhone: '',
  contactPhoneHref: '',
  contactEmail: '',
  contactEmailHref: '',
  contentLayout: 'stack',
  progressValue: undefined,
  progressColor: '',
  selectable: false,
  selected: false,
  actions: () => [],
  viewOrderLink: '',
});

const emit = defineEmits<{
  (event: 'update:selected', value: boolean): void;
  (event: 'action', actionId: string): void;
}>();

const hasContactDetails = computed(() => (
  !!props.contactName
  || !!props.contactPhone
  || !!props.contactEmail
));

const taskAge = computed(() => taskAgeLabel(props.taskCreatedDate, translate('Created')));
const taskCreatedTitle = computed(() => taskCreatedTimestampLabel(props.taskCreatedDate, translate('Task created')));

const normalizedProgressValue = computed(() => {
  if (props.progressValue == null) return undefined;

  const value = Number(props.progressValue);
  if (!Number.isFinite(value)) return undefined;

  const normalizedValue = value > 1 ? value / 100 : value;
  return Math.max(0, Math.min(1, normalizedValue));
});

const orderedActions = computed(() => {
  const priority: Record<TaskCardActionKind, number> = {
    primary: 0,
    neutral: 1,
    danger: 2,
  };

  return props.actions
    .map((action, index) => ({ action, index }))
    .sort((left, right) => priority[left.action.kind] - priority[right.action.kind] || left.index - right.index)
    .map(({ action }) => action);
});

function actionColor(kind: TaskCardActionKind): string {
  return kind === 'neutral' ? 'medium' : kind;
}

async function copyContact(value: string) {
  if (!value) return;

  await commonUtil.copyToClipboard(value, 'Copied');
}
</script>

<style scoped>
.order-task-header {
  display: flex;
  align-items: center;
  gap: var(--spacer-sm);
}

.order-task-header .meta {
  margin-inline-start: auto;
}

.task-card-content-stack {
  display: flex;
  flex-direction: column;
}

.task-actions {
  border-block-start: var(--border-medium);
}
</style>
