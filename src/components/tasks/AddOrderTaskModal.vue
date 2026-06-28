<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="dismiss()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ title || translate('Add Task') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list>
      <ion-item v-if="props.shipGroups && props.shipGroups.length > 1">
        <ion-select
          :label="requiredLabel('Ship groups')"
          label-placement="stacked"
          interface="popover"
          :multiple="true"
          :placeholder="translate('Select ship groups')"
          required
          v-model="selectedShipGroupSeqIds"
        >
          <ion-select-option v-for="shipGroup in props.shipGroups" :key="shipGroup.id" :value="shipGroup.id">
            {{ shipGroup.label || shipGroup.id }}
          </ion-select-option>
        </ion-select>
      </ion-item>
      <ion-item>
        <ion-input
          :label="requiredLabel('Task Name')"
          label-placement="stacked"
          :placeholder="translate('Enter task name')"
          :value="form.workEffortName"
          required
          @ionInput="handleTaskNameInput($event.detail.value)"
        />
      </ion-item>
      <!-- Task type is internal to the hold-task flow: when the caller supplies a
           default type (e.g. RESOLVE_ONHOLD_ORDER), hide the selector and submit it
           internally. The generic bulk "Add task" flow (no default) still shows it. -->
      <ion-item v-if="!props.defaultWorkEffortTypeId">
        <ion-select
          :label="requiredLabel('Task Type')"
          label-placement="stacked"
          interface="popover"
          :placeholder="translate('Select Task Type')"
          required
          v-model="form.workEffortTypeId"
        >
          <ion-select-option v-for="option in taskTypes" :key="option.enumId" :value="option.enumId">
            {{ option.description || option.enumName || option.enumId }}
          </ion-select-option>
        </ion-select>
      </ion-item>
      <!-- Purpose picker: ion-select-option can't render icons, so use an anchored
           popover list that shows each purpose's workflow icon (centralized in
           taskPurposeIcons) alongside its label. -->
      <ion-item button detail="false" id="task-purpose-trigger">
        <ion-icon v-if="selectedPurposeIcon" slot="start" :icon="selectedPurposeIcon" />
        <ion-label>
          <p>{{ requiredLabel('Task Purpose') }}</p>
          <span :class="{ 'task-purpose-placeholder': !form.workEffortPurposeTypeId }">{{ selectedPurposeLabel }}</span>
        </ion-label>
      </ion-item>
      <ion-popover trigger="task-purpose-trigger" trigger-action="click" dismiss-on-select :show-backdrop="false">
        <ion-content>
          <ion-list>
            <ion-item
              v-for="option in taskPurposes"
              :key="option.enumId"
              button
              detail="false"
              @click="form.workEffortPurposeTypeId = option.enumId"
            >
              <ion-icon v-if="getTaskPurposeIcon(option.enumId)" slot="start" :icon="getTaskPurposeIcon(option.enumId)" />
              <ion-label>{{ option.description || option.enumName || option.enumId }}</ion-label>
            </ion-item>
          </ion-list>
        </ion-content>
      </ion-popover>
      <ion-item>
        <ion-textarea
          :label="requiredLabel('Description')"
          label-placement="stacked"
          :placeholder="translate('Enter description')"
          :rows="3"
          required
          v-model="form.description"
        />
      </ion-item>
    </ion-list>

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!isValid" @click="confirm()">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonPopover,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar,
  modalController,
} from '@ionic/vue';
import { closeOutline, saveOutline } from 'ionicons/icons';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { translate } from '@common';
import { useSeedStore } from '@/store/seed';
import { getTaskPurposeIcon } from '@/utils/taskPurposeIcons';

const props = defineProps<{
  // Optional modal title (already localized by the caller); defaults to "Add Task".
  title?: string;
  // When provided, the user can scope the task to one or more ship groups of an
  // order. Omitted for the generic bulk "Add task" flow, which keeps its old shape.
  shipGroups?: Array<{ id: string; label?: string }>;
  autoGenerateTaskName?: boolean;
  defaultOrderName?: string;
  defaultWorkEffortTypeId?: string;
  defaultWorkEffortPurposeTypeId?: string;
}>();

const seedStore = useSeedStore();

const form = reactive({
  workEffortName: '',
  workEffortTypeId: props.defaultWorkEffortTypeId || '',
  workEffortPurposeTypeId: props.defaultWorkEffortPurposeTypeId || '',
  description: '',
});

// Default to every ship group selected; only surfaced as a control when there
// is more than one to choose from.
const selectedShipGroupSeqIds = ref<string[]>(props.shipGroups?.map((shipGroup) => shipGroup.id) ?? []);
const taskNameEdited = ref(false);

const taskTypes = computed(() => seedStore.getEnumsByType('WorkEffortType'));
const taskPurposes = computed(() => seedStore.getEnumsByParentType('WorkEffortPurposeType'));

const selectedPurpose = computed(() => taskPurposes.value.find((option) => option.enumId === form.workEffortPurposeTypeId));
const selectedPurposeLabel = computed(() =>
  selectedPurpose.value
    ? (selectedPurpose.value.description || selectedPurpose.value.enumName || selectedPurpose.value.enumId)
    : translate('Select Task Purpose')
);
const selectedPurposeIcon = computed(() => getTaskPurposeIcon(form.workEffortPurposeTypeId));

const generatedTaskName = computed(() => {
  if (!props.autoGenerateTaskName) return '';

  const orderName = props.defaultOrderName?.trim();
  const purpose = taskPurposes.value.find((option) => option.enumId === form.workEffortPurposeTypeId);
  const purposeName = purpose?.description || purpose?.enumName || purpose?.enumId;
  return [orderName, purposeName].filter(Boolean).join(' - ');
});

const isValid = computed(() => {
  const detailsValid = !!(form.workEffortName.trim() && form.workEffortTypeId && form.workEffortPurposeTypeId && form.description.trim());
  if (props.shipGroups && props.shipGroups.length) {
    return detailsValid && selectedShipGroupSeqIds.value.length > 0;
  }
  return detailsValid;
});

onMounted(() => {
  seedStore.loadEnumType('WorkEffortType');
  seedStore.loadEnumsByParentType('WorkEffortPurposeType');
});

watch(generatedTaskName, (taskName) => {
  if (!taskNameEdited.value) form.workEffortName = taskName;
}, { immediate: true });

function dismiss() {
  modalController.dismiss(null, 'cancel');
}

function handleTaskNameInput(value: string | null | undefined) {
  taskNameEdited.value = true;
  form.workEffortName = value ?? '';
}

function requiredLabel(label: string) {
  return `${translate(label)} *`;
}

function confirm() {
  const payload: Record<string, any> = { ...form };
  if (props.shipGroups) payload.shipGroupSeqIds = [...selectedShipGroupSeqIds.value];
  modalController.dismiss(payload, 'confirm');
}
</script>

<style scoped>
.task-purpose-placeholder {
  color: var(--ion-color-medium);
}
</style>
