<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="modalController.dismiss(undefined, savedSome ? 'confirm' : 'cancel')" :aria-label="translate('Close')" :title="translate('Close')">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Manage order attributes') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list>
      <ion-list-header>
        <ion-label>{{ translate('Add Attribute') }}</ion-label>
      </ion-list-header>
      <div class="attribute-form__pair">
        <ion-item class="attribute-form__field">
          <ion-input
            v-model="form.attrName"
            :label="translate('Name')"
            label-placement="stacked"
            :placeholder="translate('Attribute name')"
            :disabled="saving"
          />
        </ion-item>
        <ion-item class="attribute-form__field">
          <ion-input
            v-model="form.attrValue"
            :label="translate('Value')"
            label-placement="stacked"
            :placeholder="translate('Attribute value')"
            :disabled="saving"
          />
        </ion-item>
      </div>
      <ion-item>
        <ion-input
          v-model="form.attrDescription"
          :label="translate('Description')"
          label-placement="stacked"
          :placeholder="translate('Attribute description')"
          :disabled="saving"
        />
      </ion-item>
      <ion-item lines="none">
        <ion-button slot="end" fill="outline" :disabled="!form.attrName.trim() || saving" @click="addAttribute">
          {{ translate('Add') }}
        </ion-button>
      </ion-item>
    </ion-list>

    <ion-list v-if="draft.length">
      <ion-list-header>
        <ion-label>{{ translate('Attributes') }}</ion-label>
      </ion-list-header>
      <template v-for="attr in draft" :key="attr.attrName">
        <ion-item v-if="editingName === attr.attrName">
          <ion-input
            v-model="editValue"
            :label="attr.attrName"
            label-placement="stacked"
            :disabled="saving"
            @keyup.enter="applyEdit(attr)"
          />
          <ion-button slot="end" fill="clear" size="default" :disabled="!canApplyEdit(attr) || saving" @click="applyEdit(attr)" :aria-label="translate('Done')" :title="translate('Done')">
            <ion-icon slot="icon-only" :icon="checkmarkDoneOutline" />
          </ion-button>
          <ion-button slot="end" fill="clear" size="default" :disabled="saving" @click="cancelEdit" :aria-label="translate('Cancel edit')" :title="translate('Cancel edit')">
            <ion-icon slot="icon-only" :icon="closeOutline" />
          </ion-button>
        </ion-item>
        <AttributeListItem
          v-else
          :name="attr.attrName"
          :value="attr.attrValue"
          :description="attr.attrDescription"
        >
          <template #end>
            <ion-badge v-if="unsavedNames.has(attr.attrName)" color="medium">{{ translate('Unsaved') }}</ion-badge>
            <ion-button fill="clear" :disabled="saving" @click="startEdit(attr)" :aria-label="translate('Edit')" :title="translate('Edit')">
              <ion-icon slot="icon-only" :icon="createOutline" />
            </ion-button>
            <ion-button fill="clear" color="danger" :disabled="saving" @click="removeAttribute(attr)" :aria-label="translate('Delete')" :title="translate('Delete')">
              <ion-icon slot="icon-only" :icon="trashOutline" />
            </ion-button>
          </template>
        </AttributeListItem>
      </template>
    </ion-list>

    <EmptyState
      v-else
      :title="translate('No attributes')"
      :message="translate('This order has no attributes.')"
    />

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!canSave || saving" :aria-label="translate('Save')" @click="save">
        <ion-spinner v-if="saving" name="crescent" />
        <ion-icon v-else :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import {
  IonBadge, IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonInput, IonItem,
  IonLabel, IonList, IonListHeader, IonSpinner, IonTitle, IonToolbar, modalController
} from '@ionic/vue';
import { checkmarkDoneOutline, closeOutline, createOutline, saveOutline, trashOutline } from 'ionicons/icons';
import { computed, reactive, ref } from 'vue';
import { api, commonUtil, translate } from '@common';
import EmptyState from '@/components/common/EmptyState.vue';
import AttributeListItem from '@/components/orders/AttributeListItem.vue';
import { showToast } from '@/utils';

type Attribute = { attrName: string; attrValue?: string; attrDescription?: string };

const props = defineProps<{
  orderId: string;
  attributes: Attribute[];
}>();

// What the order holds on the server, and the list as the operator has changed it. Adding,
// editing and deleting only change the draft; Save writes the difference.
const saved = ref<Attribute[]>(props.attributes.map((attr) => ({ ...attr })));
const draft = ref<Attribute[]>(props.attributes.map((attr) => ({ ...attr })));
const saving = ref(false);
// Part of a failed save went through, so the order has changed even if the modal is closed.
const savedSome = ref(false);

const form = reactive({ attrName: '', attrValue: '', attrDescription: '' });

const editingName = ref('');
const editValue = ref('');

const changes = computed(() => ({
  removed: saved.value.filter((attr) => !draft.value.some((entry) => entry.attrName === attr.attrName)),
  stored: draft.value.filter((attr) => {
    const before = saved.value.find((entry) => entry.attrName === attr.attrName);
    return !before || before.attrValue !== attr.attrValue || before.attrDescription !== attr.attrDescription;
  }),
}));

// Rows added or edited since the last save, marked so the list doesn't read as saved.
const unsavedNames = computed(() => new Set(changes.value.stored.map((attr) => attr.attrName)));

// An attribute still typed into the form or an edit left open is saved too, rather than lost.
const canSave = computed(() => {
  const editing = draft.value.find((attr) => attr.attrName === editingName.value);
  return changes.value.removed.length > 0
    || changes.value.stored.length > 0
    || !!form.attrName.trim()
    || (!!editing && canApplyEdit(editing));
});

/** Adds the form's attribute to the draft, or says why it can't. */
async function addAttribute() {
  const attrName = form.attrName.trim();
  if (!attrName) return true;
  // OMS matches attribute names regardless of case (saving QA_CHECK overwrites qa_check), so
  // adding a name the order already has, in any case, would overwrite that attribute.
  if (draft.value.some((attr) => attr.attrName.toLowerCase() === attrName.toLowerCase())) {
    await showToast(translate('This attribute already exists.'));
    return false;
  }
  draft.value.push({
    attrName,
    attrValue: form.attrValue.trim() || undefined,
    attrDescription: form.attrDescription.trim() || undefined
  });
  form.attrName = '';
  form.attrValue = '';
  form.attrDescription = '';
  return true;
}

function startEdit(attr: Attribute) {
  editingName.value = attr.attrName;
  editValue.value = attr.attrValue ?? '';
}

function cancelEdit() {
  editingName.value = '';
  editValue.value = '';
}

function canApplyEdit(attr: Attribute) {
  const value = editValue.value.trim();
  return !!value && value !== (attr.attrValue ?? '');
}

function applyEdit(attr: Attribute) {
  if (!canApplyEdit(attr)) return;
  attr.attrValue = editValue.value.trim();
  cancelEdit();
}

function removeAttribute(attr: Attribute) {
  if (editingName.value === attr.attrName) cancelEdit();
  draft.value = draft.value.filter((entry) => entry.attrName !== attr.attrName);
}

async function save() {
  if (!canSave.value || saving.value) return;
  const editing = draft.value.find((attr) => attr.attrName === editingName.value);
  if (editing) applyEdit(editing);
  if (!(await addAttribute())) return;

  const { removed, stored } = changes.value;
  saving.value = true;
  try {
    // Deletes go first, so a name removed and added back in another case isn't taken for the old one.
    for (const attr of removed) {
      const resp = await api({ url: `oms/orders/${props.orderId}/attributes/${encodeURIComponent(attr.attrName)}`, method: 'DELETE' });
      if (commonUtil.hasError(resp)) throw resp.data;
      saved.value = saved.value.filter((entry) => entry.attrName !== attr.attrName);
      savedSome.value = true;
    }
    // POST stores the attribute, creating a new name or overwriting an existing one, so each write
    // carries the description along with the value.
    for (const attr of stored) {
      const resp = await api({ url: `oms/orders/${props.orderId}/attributes`, method: 'POST', data: { ...attr } });
      if (commonUtil.hasError(resp)) throw resp.data;
      saved.value = [...saved.value.filter((entry) => entry.attrName !== attr.attrName), { ...attr }];
      savedSome.value = true;
    }
    await showToast(translate('Attributes saved.'));
    await modalController.dismiss(undefined, 'confirm');
  } catch {
    // What went through is now the saved state, so another Save sends only what is left.
    await showToast(translate('Failed to save attributes. Please try again.'));
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
ion-content {
  --padding-bottom: 80px;
}

.attribute-form__pair {
  display: flex;
  flex-wrap: wrap;
}

.attribute-form__field {
  flex: 1 1 12rem;
}
</style>
