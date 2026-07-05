<template>
  <ion-card class="task-card-shell ship-group-card">
    <ion-item lines="none" class="task-card-heading" :class="{ 'task-card-heading-has-chip': chipLabel }">
      <ion-checkbox
        v-if="selectable"
        slot="start"
        :checked="selected"
        @ionChange="emit('update:selected', $event.detail.checked)"
      />
      <ion-label class="task-card-heading-title">
        <slot name="title">
          {{ title }}
          <p v-if="subtitle">{{ subtitle }}</p>
        </slot>
      </ion-label>
      <ion-chip
        v-if="chipLabel"
        class="task-card-heading-chip"
        outline
        color="medium"
        button
        :aria-label="translate('Copy')"
        @click="copyChipLabel"
      >
        <ion-icon :icon="ticketOutline" />
        <ion-label>{{ chipLabel }}</ion-label>
        <ion-icon :icon="copyOutline" />
      </ion-chip>
      <ion-note v-if="amount" slot="end" color="dark">{{ amount }}</ion-note>
      <slot name="heading-end" />
    </ion-item>

    <ion-progress-bar
      v-if="normalizedProgressValue !== undefined"
      :value="normalizedProgressValue"
      :color="progressColor || undefined"
    />

    <div v-if="hasContactDetails" class="task-card-contact-details ship-group-timeline">
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

    <div v-if="$slots['content-start'] || $slots.default" class="task-card-content">
      <slot name="content-start" />
      <div
        v-if="$slots.default"
        :class="{
          'task-card-content-grid ship-group-detail-columns': contentLayout === 'grid',
          'task-card-content-stack': contentLayout === 'stack',
        }"
      >
        <slot />
      </div>
    </div>

    <ion-item class="task-actions" lines="none" v-if="$slots.actions || $slots['actions-end']">
      <slot name="actions" />
      <div v-if="$slots['actions-end']" class="task-card-actions-end">
        <slot name="actions-end" />
      </div>
    </ion-item>
  </ion-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonButton, IonCard, IonCheckbox, IonChip, IonIcon, IonItem, IonLabel, IonNote, IonProgressBar } from '@ionic/vue';
import { callOutline, copyOutline, mailOutline, personOutline, ticketOutline } from 'ionicons/icons';
import { commonUtil, translate } from '@common';

const props = withDefaults(defineProps<{
  title: string;
  subtitle?: string;
  amount?: string;
  chipLabel?: string;
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
}>(), {
  subtitle: '',
  amount: '',
  chipLabel: '',
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
});

const emit = defineEmits<{
  (event: 'update:selected', value: boolean): void;
}>();

const hasContactDetails = computed(() => (
  !!props.contactName
  || !!props.contactPhone
  || !!props.contactEmail
));

const normalizedProgressValue = computed(() => {
  if (props.progressValue == null) return undefined;

  const value = Number(props.progressValue);
  if (!Number.isFinite(value)) return undefined;

  const normalizedValue = value > 1 ? value / 100 : value;
  return Math.max(0, Math.min(1, normalizedValue));
});

async function copyContact(value: string) {
  if (!value) return;

  await commonUtil.copyToClipboard(value, 'Copied');
}

async function copyChipLabel() {
  await copyContact(props.chipLabel);
}
</script>

<style scoped>
.task-card-heading {
  position: relative;
}

.task-card-heading-has-chip .task-card-heading-title {
  flex: 0 1 auto;
  max-width: min(45%, 420px);
}

.task-card-heading-chip {
  position: absolute;
  inset-inline-start: 50%;
  margin: 0;
  transform: translateX(-50%);
}

.task-card-content-stack {
  display: flex;
  flex-direction: column;
}

.task-card-action-buttons {
  flex-wrap: wrap;
}

.task-card-actions-end {
  flex: 0 1 360px;
  margin-inline-start: auto;
  max-width: 360px;
}

.task-actions {
  border-block-start: var(--border-medium);
}

@media (max-width: 640px) {
  .task-card-heading-chip {
    position: static;
    transform: none;
  }

  .task-card-heading-has-chip .task-card-heading-title {
    max-width: none;
  }

  .task-card-actions-end {
    max-width: none;
  }
}
</style>
