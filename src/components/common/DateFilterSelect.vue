<template>
  <div>
    <ion-item button detail="false" lines="full" @click="openDateModal">
      <ion-label>{{ label }}</ion-label>
      <ion-note slot="end">{{ selectedDateLabel }}</ion-note>
      <ion-icon slot="end" :icon="caretDownOutline" />
    </ion-item>

    <ion-modal :is-open="isOpen" @didDismiss="closeDateModal">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-button @click="closeDateModal">
              <ion-icon slot="icon-only" :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
          <ion-title>{{ label }}</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <ion-datetime
          presentation="date"
          :value="draftDate"
          @ionChange="draftDate = normalizeDate($event.detail.value)"
        />
        <ion-button v-if="modelValue" expand="block" fill="clear" color="medium" @click="clearDate">
          {{ translate('Clear') }}
        </ion-button>
        <ion-fab vertical="bottom" horizontal="end" slot="fixed">
          <ion-fab-button @click="saveDate">
            <ion-icon :icon="saveOutline" />
          </ion-fab-button>
        </ion-fab>
      </ion-content>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonButton, IonButtons, IonContent, IonDatetime, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonLabel, IonModal, IonNote, IonTitle, IonToolbar } from '@ionic/vue';
import { caretDownOutline, closeOutline, saveOutline } from 'ionicons/icons';
import { DateTime } from 'luxon';
import { translate } from '@common';

const props = withDefaults(defineProps<{
  modelValue: string;
  label: string;
}>(), {
  modelValue: '',
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
}>();

const isOpen = ref(false);
const draftDate = ref('');

const selectedDateLabel = computed(() => {
  if (!props.modelValue) return translate('Select');

  const parsedDate = DateTime.fromISO(props.modelValue);
  return parsedDate.isValid ? parsedDate.toLocaleString(DateTime.DATE_MED) : props.modelValue;
});

watch(() => props.modelValue, (value) => {
  draftDate.value = value || today();
}, { immediate: true });

function openDateModal() {
  draftDate.value = props.modelValue || today();
  isOpen.value = true;
}

function closeDateModal() {
  isOpen.value = false;
}

function saveDate() {
  emit('update:modelValue', normalizeDate(draftDate.value));
  closeDateModal();
}

function clearDate() {
  emit('update:modelValue', '');
  closeDateModal();
}

function today(): string {
  return DateTime.now().toISODate() || '';
}

function normalizeDate(value: string | string[] | null | undefined): string {
  if (!value) return '';
  const selectedValue = Array.isArray(value) ? value[0] : value;
  return selectedValue ? String(selectedValue).slice(0, 10) : '';
}
</script>
