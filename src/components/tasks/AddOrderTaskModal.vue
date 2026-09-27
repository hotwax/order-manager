<template>
  <DxpModal :title="title || translate('Add task')">
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
          :label="requiredLabel('Task name')"
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
      <!-- Task purpose picker with workflow icons: ion-select-option can't render
           icons, so use an anchored popover list (icons centralized in taskPurposeIcons).
           #391 fixes the work-effort type to a constant, so no type selector is shown. -->
      <ion-item button :detail="false" id="task-purpose-trigger">
        <ion-label>
          <p>{{ requiredLabel('Task purpose') }}</p>
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
              :detail="false"
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
  </DxpModal>
</template>

<script setup lang="ts">
import {
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonPopover,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from '@ionic/vue';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { DxpModal, translate, useModalFlow } from '@common';
import { requiredLabel } from '@/utils';
import { useSeedStore } from '@/store/seed';
import { getTaskPurposeIcon } from '@/utils/taskPurposeIcons';

const props = defineProps<{
  // Optional modal title (already localized by the caller); defaults to "Add task".
  title?: string;
  // When provided, the user can scope the task to one or more ship groups of an
  // order. Omitted for the generic bulk "Add task" flow, which keeps its old shape.
  shipGroups?: Array<{ id: string; label?: string }>;
  autoGenerateTaskName?: boolean;
  defaultOrderName?: string;
  defaultWorkEffortPurposeTypeId?: string;
}>();

const seedStore = useSeedStore();
const WORK_EFFORT_TYPE_ID = 'RESOLVE_ONHOLD_ORDER';
const OPERATOR_HOLD_PURPOSE_IDS = new Set(['ORD_HOLD_MANUAL', 'ORD_HOLD_CUST_REQ']);

const form = reactive({
  workEffortName: '',
  workEffortTypeId: WORK_EFFORT_TYPE_ID,
  workEffortPurposeTypeId: props.defaultWorkEffortPurposeTypeId || '',
  description: '',
});

// Default to every ship group selected; only surfaced as a control when there
// is more than one to choose from.
const selectedShipGroupSeqIds = ref<string[]>(props.shipGroups?.map((shipGroup) => shipGroup.id) ?? []);
const taskNameEdited = ref(false);

// Address, reservation, and fraud purposes are created by their owning backend flows. In
// particular, fraud is order-scoped and must never be fanned out through this ship-group modal.
const taskPurposes = computed(() => seedStore.getEnumsByType(WORK_EFFORT_TYPE_ID)
  .filter((purpose: any) => OPERATOR_HOLD_PURPOSE_IDS.has(purpose.enumId)));

const selectedPurpose = computed(() => taskPurposes.value.find((option) => option.enumId === form.workEffortPurposeTypeId));
const selectedPurposeLabel = computed(() =>
  selectedPurpose.value
    ? (selectedPurpose.value.description || selectedPurpose.value.enumName || selectedPurpose.value.enumId)
    : translate('Select task purpose')
);
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
  seedStore.loadEnumType(WORK_EFFORT_TYPE_ID);
});

watch(generatedTaskName, (taskName) => {
  if (!taskNameEdited.value) form.workEffortName = taskName;
}, { immediate: true });

function handleTaskNameInput(value: string | null | undefined) {
  taskNameEdited.value = true;
  form.workEffortName = value ?? '';
}

// Anything the operator typed or picked. A name the modal generated itself isn't theirs to lose.
const isDirty = computed(() => (taskNameEdited.value && !!form.workEffortName.trim())
  || !!form.description.trim()
  || form.workEffortPurposeTypeId !== (props.defaultWorkEffortPurposeTypeId || '')
  || selectedShipGroupSeqIds.value.length !== (props.shipGroups?.length ?? 0));

// Save hands the task back; the screen that opened the modal creates it, as before.
useModalFlow({
  dirty: isDirty,
  canConfirm: isValid,
  confirm() {
    const payload: Record<string, any> = { ...form };
    if (props.shipGroups) payload.shipGroupSeqIds = [...selectedShipGroupSeqIds.value];
    return payload;
  },
});
</script>

<style scoped>
.task-purpose-placeholder {
  color: var(--ion-color-medium);
}
</style>
