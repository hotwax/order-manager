<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="modalController.dismiss(undefined, dirty ? 'confirm' : 'cancel')" :aria-label="translate('Close')">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Manage order identifications') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list>
      <ion-list-header>
        <ion-label>{{ translate('Add identification') }}</ion-label>
      </ion-list-header>
      <div class="identification-form__pair">
        <ion-item class="identification-form__field">
          <ion-select
            v-model="addForm.orderIdentificationTypeId"
            :label="translate('Identification type')"
            label-placement="stacked"
            interface="popover"
            :disabled="adding"
          >
            <ion-select-option v-for="type in typeOptions" :key="type.enumId" :value="type.enumId">
              {{ type.description }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item class="identification-form__field">
          <ion-input
            v-model="addForm.idValue"
            :label="translate('Value')"
            label-placement="stacked"
            :placeholder="translate('Identification value')"
            :disabled="adding"
          />
        </ion-item>
      </div>
      <ion-item lines="none">
        <ion-button fill="clear" size="small" @click="openCreateTypeModal">
          {{ translate('Create identification type') }}
        </ion-button>
      </ion-item>
    </ion-list>

    <ion-list v-if="localIdentifications.length">
      <ion-list-header>
        <ion-label>{{ translate('Identifications') }}</ion-label>
      </ion-list-header>
      <IdentificationListItem
        v-for="identification in localIdentifications"
        :key="`${identification.orderIdentificationTypeId}::${identification.fromDate}`"
        :label="seed.orderIdentificationTypeDescription(identification.orderIdentificationTypeId)"
        :value="identification.idValue"
        :hide-value="editingKey === rowKey(identification)"
        :is-updatable="isRowUpdatable(identification)"
      >
        <template #end>
          <template v-if="editingKey === rowKey(identification)">
            <ion-input class="identification-edit-input" v-model="editValue" :disabled="savingKey === rowKey(identification) || !isRowUpdatable(identification)" />
            <ion-button
              fill="clear"
              :disabled="savingKey === rowKey(identification) || !isRowUpdatable(identification) || !editValue.trim() || editValue.trim() === identification.idValue"
              @click="saveEdit(identification)"
              :aria-label="translate('Save edit')"
            >
              <ion-spinner v-if="savingKey === rowKey(identification)" slot="icon-only" name="crescent" />
              <ion-icon v-else :icon="checkmarkDoneOutline" slot="icon-only" />
            </ion-button>
            <ion-button fill="clear" :disabled="savingKey === rowKey(identification)" @click="cancelEdit" :aria-label="translate('Cancel edit')">
              <ion-icon :icon="closeOutline" slot="icon-only" />
            </ion-button>
          </template>
          <template v-else>
            <ion-button v-if="isRowUpdatable(identification)" fill="clear" @click="startEdit(identification)" :aria-label="translate('Edit')">
              <ion-icon slot="icon-only" :icon="createOutline" />
            </ion-button>
            <ion-button fill="clear" color="danger" :disabled="removingKey === rowKey(identification) || !isRowUpdatable(identification)" @click="removeIdentification(identification)" :aria-label="translate('Remove')">
              <ion-spinner v-if="removingKey === rowKey(identification)" slot="icon-only" name="crescent" />
              <ion-icon v-else slot="icon-only" :icon="trashOutline" />
            </ion-button>
          </template>
        </template>
      </IdentificationListItem>
    </ion-list>

    <EmptyState
      v-else
      :title="translate('No identifications')"
      :message="translate('This order has no additional identifications.')"
    />

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!canAdd || adding" :aria-label="translate('Add identification')" @click="addIdentification">
        <ion-spinner v-if="adding" name="crescent" />
        <ion-icon v-else :icon="addOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import {
  IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonInput, IonItem,
  IonLabel, IonList, IonListHeader, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar,
  modalController
} from '@ionic/vue';
import { addOutline, checkmarkDoneOutline, closeOutline, createOutline, trashOutline } from 'ionicons/icons';
import { computed, reactive, ref } from 'vue';
import { DateTime } from 'luxon';
import { api, commonUtil, translate } from '@common';
import { useSeedStore } from '@/store/seed';
import { useUserStore } from '@/store/user';
import { showToast } from '@/utils';
import EmptyState from '@/components/common/EmptyState.vue';
import IdentificationListItem from '@/components/orders/IdentificationListItem.vue';
import CreateIdentificationTypeModal from '@/components/orders/CreateIdentificationTypeModal.vue';
import Actions from "@/authorization/actions";

type Identification = {
  orderIdentificationTypeId: string;
  idValue: string;
  fromDate?: string;
  typeLabel?: string;
  shopifyAdminUrl?: string;
};

const props = defineProps<{
  orderId: string;
  identifications: Identification[];
}>();

const SYSTEM_SOURCED_TYPE_IDS = new Set(
  (import.meta.env.VITE_SYSTEM_SOURCED_IDENTIFICATION_TYPE_IDS || '')
    .split(',')
    .map((typeId: string) => typeId.trim())
    .filter(Boolean)
);

function isSystemSourced(identification: Identification) {
  return SYSTEM_SOURCED_TYPE_IDS.has(identification.orderIdentificationTypeId);
}

const seed = useSeedStore();
const userStore = useUserStore();
// A user with Actions.APP_ORDER_IDENTIFICATION_UPDATE (ORDERMGR_ADMIN) can edit/remove any
// identification, including system/imported ones; everyone else can only edit/remove the
// identifications that aren't system-sourced.
const canUpdate = computed(() => userStore.hasPermission(Actions.APP_ORDER_IDENTIFICATION_UPDATE));

function isRowUpdatable(identification: Identification) {
  return canUpdate.value || !isSystemSourced(identification);
}

const localIdentifications = ref<Identification[]>([...props.identifications]);
const typeOptions = computed(() => {
  const existingTypeIds = new Set(localIdentifications.value.map((identification) => identification.orderIdentificationTypeId));
  return seed.orderIdentificationTypeOptions.filter((type) => {
    if (existingTypeIds.has(type.enumId)) return false;
    // Without the permission, a user can't add a system-sourced type either — otherwise they
    // could delete one (allowed) and immediately recreate it with an arbitrary value.
    if (!canUpdate.value && SYSTEM_SOURCED_TYPE_IDS.has(type.enumId)) return false;
    return true;
  });
});
const dirty = ref(false);

const addForm = reactive({ orderIdentificationTypeId: '', idValue: '' });
const adding = ref(false);
const canAdd = computed(() => !!addForm.orderIdentificationTypeId && !!addForm.idValue.trim());

const editingKey = ref('');
const editValue = ref('');
const savingKey = ref('');
const removingKey = ref('');

function rowKey(identification: Identification) {
  return `${identification.orderIdentificationTypeId}::${identification.fromDate}`;
}

async function addIdentification() {
  if (!canAdd.value) return;
  // Defense in depth: the type picker already excludes system-sourced types without the
  // permission, but guard the write itself in case addForm was populated some other way.
  if (!canUpdate.value && SYSTEM_SOURCED_TYPE_IDS.has(addForm.orderIdentificationTypeId)) return;

  const isDuplicate = localIdentifications.value.some(
    (identification) =>
      identification.orderIdentificationTypeId === addForm.orderIdentificationTypeId &&
      identification.idValue === addForm.idValue.trim()
  );
  if (isDuplicate) {
    await showToast(translate('This identification already exists.'));
    return;
  }

  adding.value = true;
  try {
    const fromDate = DateTime.now().toMillis();
    const resp = await api({
      url: `oms/orders/${props.orderId}/identifications`,
      method: 'POST',
      data: { orderIdentificationTypeId: addForm.orderIdentificationTypeId, idValue: addForm.idValue.trim(), fromDate }
    });
    if (commonUtil.hasError(resp)) throw resp.data;

    localIdentifications.value.push({
      orderIdentificationTypeId: addForm.orderIdentificationTypeId,
      idValue: addForm.idValue.trim(),
      fromDate: String(fromDate)
    });
    addForm.orderIdentificationTypeId = '';
    addForm.idValue = '';
    dirty.value = true;
    await showToast(translate('Identification added successfully.'));
  } catch {
    await showToast(translate('Failed to add identification. Please try again.'));
  } finally {
    adding.value = false;
  }
}

function startEdit(identification: Identification) {
  if (!isRowUpdatable(identification)) return;
  editingKey.value = rowKey(identification);
  editValue.value = identification.idValue;
}

function cancelEdit() {
  editingKey.value = '';
  editValue.value = '';
}

async function saveEdit(identification: Identification) {
  if (!isRowUpdatable(identification)) return;
  if (!editValue.value.trim() || editValue.value.trim() === identification.idValue) return;
  const key = rowKey(identification);
  savingKey.value = key;
  try {
    // Updating a value means expiring the old identification row, then creating a fresh
    // one — there's no in-place value update on this entity.
    const now = DateTime.now().toMillis();
    const expireResp = await api({
      url: `oms/orders/${props.orderId}/identifications`,
      method: 'PUT',
      data: {
        orderIdentificationTypeId: identification.orderIdentificationTypeId,
        orderId: props.orderId,
        fromDate: identification.fromDate,
        thruDate: now
      }
    });
    if (commonUtil.hasError(expireResp)) throw expireResp.data;

    const createResp = await api({
      url: `oms/orders/${props.orderId}/identifications`,
      method: 'POST',
      data: {
        orderIdentificationTypeId: identification.orderIdentificationTypeId,
        idValue: editValue.value.trim(),
        fromDate: now
      }
    });
    if (commonUtil.hasError(createResp)) throw createResp.data;

    identification.idValue = editValue.value.trim();
    identification.fromDate = String(now);
    editingKey.value = '';
    editValue.value = '';
    dirty.value = true;
    await showToast(translate('Identification updated successfully.'));
  } catch {
    await showToast(translate('Failed to update identification. Please try again.'));
  } finally {
    savingKey.value = '';
  }
}

async function removeIdentification(identification: Identification) {
  if (!isRowUpdatable(identification)) return;
  const key = rowKey(identification);
  removingKey.value = key;
  try {
    const resp = await api({
      url: `oms/orders/${props.orderId}/identifications`,
      method: 'PUT',
      data: {
        orderIdentificationTypeId: identification.orderIdentificationTypeId,
        orderId: props.orderId,
        fromDate: identification.fromDate,
        thruDate: DateTime.now().toMillis()
      }
    });
    if (commonUtil.hasError(resp)) throw resp.data;

    localIdentifications.value = localIdentifications.value.filter((entry) => rowKey(entry) !== key);
    dirty.value = true;
    await showToast(translate('Identification removed.'));
  } catch {
    await showToast(translate('Failed to remove identification. Please try again.'));
  } finally {
    removingKey.value = '';
  }
}

async function openCreateTypeModal() {
  const modal = await modalController.create({ component: CreateIdentificationTypeModal });
  await modal.present();
  const { data, role } = await modal.onWillDismiss();
  if (role !== 'confirm' || !data?.enumId) return;
  addForm.orderIdentificationTypeId = data.enumId;
}
</script>

<style scoped>
ion-content {
  --padding-bottom: 16px;
}

.identification-form__pair {
  display: flex;
  flex-wrap: wrap;
}

.identification-form__field {
  flex: 1 1 12rem;
}

.identification-edit-input {
  flex: 0 1 10rem;
}
</style>
