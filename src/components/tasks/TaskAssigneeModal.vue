<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Assign task') }}</ion-title>
    </ion-toolbar>
    <ion-toolbar>
      <ion-searchbar v-model="queryString" :placeholder="translate('Search staff')" @keyup.enter="findAssignees" />
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list>
      <ion-list-header>{{ translate('Staff') }}</ion-list-header>
      <ion-radio-group v-model="selectedAssigneeId">
        <ion-item button @click="selectedAssigneeId = meAssignee.id">
          <ion-radio slot="start" :value="meAssignee.id" />
          <ion-label>
            {{ translate('Me') }}
            <p>{{ meAssignee.externalId || meAssignee.id }}</p>
          </ion-label>
        </ion-item>
        <ion-item v-if="isLoading">
          <ion-spinner name="crescent" slot="start" />
          <ion-label>{{ translate('Fetching staff') }}</ion-label>
        </ion-item>
        <ion-item v-else-if="!assignees.length">
          <ion-label>{{ translate('No staff found') }}</ion-label>
        </ion-item>
        <template v-else>
          <ion-item v-for="assignee in assignees" :key="assignee.id" button @click="selectedAssigneeId = assignee.id">
            <ion-radio slot="start" :value="assignee.id" />
            <ion-label>
              {{ assignee.name }}
              <p>{{ assignee.externalId || assignee.id }}</p>
            </ion-label>
          </ion-item>
        </template>
      </ion-radio-group>
    </ion-list>

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!selectedAssigneeId" @click="saveAssignee">
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
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonRadio,
  IonRadioGroup,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
  modalController
} from '@ionic/vue';
import { closeOutline, saveOutline } from 'ionicons/icons';
import { commonUtil, logger, translate, useSolrSearch } from '@common';
import { computed, onMounted, ref } from 'vue';
import { useUserStore } from '@/store/user';

type Assignee = {
  id: string;
  name: string;
  externalId?: string;
};

const userStore = useUserStore();
const queryString = ref('');
const assignees = ref<Assignee[]>([]);
const isLoading = ref(false);
const selectedAssigneeId = ref('me');

const meAssignee = computed<Assignee>(() => {
  const profile = userStore.getUserProfile || {};
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.partyName || profile.userId || profile.partyId || 'Me';

  return {
    id: profile.partyId || profile.userId || 'me',
    name,
    externalId: profile.userLoginId || profile.userId || profile.partyId
  };
});

function closeModal(responseData?: Assignee) {
  modalController.dismiss(responseData);
}

function selectedAssignee() {
  if (selectedAssigneeId.value === meAssignee.value.id || selectedAssigneeId.value === 'me') return meAssignee.value;
  return assignees.value.find((assignee) => assignee.id === selectedAssigneeId.value);
}

function saveAssignee() {
  const assignee = selectedAssignee();
  if (!assignee) return;

  closeModal(assignee);
}

async function findAssignees() {
  isLoading.value = true;
  assignees.value = [];

  const query = assigneeQuery(queryString.value);
  const payload = {
    json: {
      params: {
        rows: '50',
        q: query,
        defType: 'edismax',
        qf: 'firstName lastName groupName partyId externalId',
        sort: 'firstName asc'
      },
      filter: ['docType:EMPLOYEE', 'statusId:PARTY_ENABLED']
    }
  };

  try {
    const resp = await useSolrSearch().runSolrQuery(payload);
    if (resp.status === 200 && !commonUtil.hasError(resp)) {
      assignees.value = (resp.data.response?.docs || [])
        .map(normalizeAssignee)
        .filter((assignee: Assignee) => assignee.id && assignee.id !== meAssignee.value.id);
    } else {
      throw resp.data;
    }
  } catch (error) {
    logger.error('Failed to fetch task assignees', error);
  } finally {
    isLoading.value = false;
  }
}

function assigneeQuery(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return '*:*';

  const tokens = trimmedValue.split(/\s+/).map((token) => `*${token}*`);
  return `(${tokens.join(' OR ')}) OR "${trimmedValue}"^100`;
}

function normalizeAssignee(doc: any): Assignee {
  const personName = [doc.firstName, doc.lastName].filter(Boolean).join(' ');

  return {
    id: doc.partyId,
    name: doc.groupName || personName || doc.partyId,
    externalId: doc.externalId
  };
}

onMounted(() => {
  selectedAssigneeId.value = meAssignee.value.id;
  findAssignees();
});
</script>
