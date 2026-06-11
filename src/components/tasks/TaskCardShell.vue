<template>
  <ion-card class="task-card-shell">
    <ion-item lines="none">
      <ion-checkbox
        v-if="selectable"
        slot="start"
        :checked="selected"
        @ionChange="emit('update:selected', $event.detail.checked)"
      />
      <ion-label>
        <slot name="title">
          {{ title }}
          <p v-if="subtitle">{{ subtitle }}</p>
        </slot>
      </ion-label>
      <ion-chip v-if="chipLabel" slot="end" outline color="medium">
        <ion-icon :icon="ticketOutline" />
        <ion-label>{{ chipLabel }}</ion-label>
      </ion-chip>
      <ion-note v-if="amount" slot="end" color="dark">{{ amount }}</ion-note>
      <slot name="heading-end" />
    </ion-item>

    <ion-list v-if="hasContactDetails" lines="full" class="task-card-contact-details">
      <ion-item>
        <ion-icon slot="start" :icon="personOutline" />
        <ion-label>
          {{ contactName || translate('Unknown') }}
        </ion-label>
        <ion-button v-if="contactName" slot="end" fill="outline" size="small" :aria-label="translate('Copy full name')" @click="copyContact(contactName)">
          {{ translate('Copy') }}
        </ion-button>
      </ion-item>
      <ion-item>
        <ion-icon slot="start" :icon="callOutline" />
        <ion-label>
          {{ contactPhone || '-' }}
        </ion-label>
        <ion-button v-if="contactPhone" slot="end" fill="outline" size="small" :aria-label="translate('Copy phone')" @click="copyContact(contactPhone)">
          {{ translate('Copy') }}
        </ion-button>
      </ion-item>
      <ion-item>
        <ion-icon slot="start" :icon="mailOutline" />
        <ion-label>
          {{ contactEmail || '-' }}
        </ion-label>
        <ion-button v-if="contactEmail" slot="end" fill="outline" size="small" :aria-label="translate('Copy email')" @click="copyContact(contactEmail)">
          {{ translate('Copy') }}
        </ion-button>
      </ion-item>
    </ion-list>

    <ion-card-content v-if="$slots['content-start'] || $slots.default" class="task-card-content">
      <slot name="content-start" />
      <div
        v-if="$slots.default"
        :class="{
          'task-card-content-grid': contentLayout === 'grid',
          'task-card-content-stack': contentLayout === 'stack',
        }"
      >
        <slot />
      </div>
    </ion-card-content>

    <div v-if="$slots.actions || $slots['actions-end']" class="task-card-actions">
      <ion-buttons class="task-card-action-buttons">
        <slot name="actions" />
      </ion-buttons>
      <div v-if="$slots['actions-end']" class="task-card-actions-end">
        <slot name="actions-end" />
      </div>
    </div>
  </ion-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonButton, IonButtons, IonCard, IonCardContent, IonCheckbox, IonChip, IonIcon, IonItem, IonLabel, IonList, IonNote } from '@ionic/vue';
import { callOutline, mailOutline, personOutline, ticketOutline } from 'ionicons/icons';
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

async function copyContact(value: string) {
  if (!value) return;

  await commonUtil.copyToClipboard(value, 'Copied');
}
</script>

<style scoped>
.task-card-shell {
  border-radius: 16px;
  overflow: hidden;
}

.task-card-contact-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  border-block-start: var(--border-medium);
}

.task-card-content {
  padding: 0;
}

.task-card-content-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  align-items: start;
}

.task-card-content-stack {
  display: flex;
  flex-direction: column;
}

.task-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-xs);
  align-items: center;
  justify-content: space-between;
  border-block-start: var(--border-medium);
  padding: var(--spacer-xs);
}

.task-card-action-buttons {
  flex-wrap: wrap;
}

.task-card-actions-end {
  flex: 1 1 260px;
  max-width: 360px;
}

@media (max-width: 640px) {
  .task-card-actions {
    align-items: stretch;
  }

  .task-card-actions-end {
    max-width: none;
  }
}
</style>
