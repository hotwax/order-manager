<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button v-if="step === 'party'" @click="dismiss()" :aria-label="translate('Close')">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
        <ion-button v-else @click="step = 'party'" :aria-label="translate('Back')">
          <ion-icon slot="icon-only" :icon="arrowBackOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ step === 'party' ? translate("Find party") : translate("Add Relationship") }}</ion-title>
    </ion-toolbar>
    <ion-toolbar v-if="step === 'party'">
      <ion-searchbar
        :value="queryString"
        :placeholder="translate('Name, party ID, email, or phone')"
        :debounce="300"
        @ionInput="onSearchInput($event.target.value)"
      />
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <!-- Step 1: find the party -->
    <template v-if="step === 'party'">
      <div v-if="searching" class="ion-padding ion-text-center">
        <ion-spinner name="crescent" />
      </div>

      <ion-radio-group v-else-if="results.length" v-model="selectedPartyId">
        <ion-list lines="full">
          <ion-item v-for="party in results" :key="party.partyId">
            <ion-radio label-placement="end" justify="start" :value="party.partyId">
              <ion-label class="ion-text-wrap">
                <p class="overline">{{ party.partyId }}</p>
                {{ party.name }}
                <p v-if="party.contact">{{ party.contact }}</p>
              </ion-label>
            </ion-radio>
          </ion-item>
        </ion-list>
      </ion-radio-group>

      <div v-else class="ion-padding ion-text-center">
        <ion-note>{{ hasSearchTerm ? translate("No parties found") : translate("Search for a party to relate") }}</ion-note>
      </div>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button :disabled="!selectedParty" :aria-label="translate('Next')" @click="step = 'relationship'">
          <ion-icon :icon="arrowForwardOutline" />
        </ion-fab-button>
      </ion-fab>
    </template>

    <!-- Step 2: describe the relationship -->
    <template v-else>
      <ion-list lines="full">
        <ion-item lines="none">
          <ion-label class="ion-text-wrap">
            <p class="overline">{{ translate("Selected party") }}</p>
            {{ selectedParty?.name }}
            <p>{{ selectedParty?.partyId }}</p>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-select
            :label="translate('Relationship type')"
            label-placement="stacked"
            interface="popover"
            :placeholder="translate('Select relationship type')"
            v-model="partyRelationshipTypeId"
          >
            <ion-select-option
              v-for="type in relationshipTypes"
              :key="type.partyRelationshipTypeId"
              :value="type.partyRelationshipTypeId"
            >
              {{ type.partyRelationshipName || type.description || type.partyRelationshipTypeId }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select
            :label="translate('Role (current party)')"
            label-placement="stacked"
            interface="popover"
            :placeholder="translate('Select role')"
            v-model="roleTypeIdFrom"
          >
            <ion-select-option
              v-for="role in availableRoleTypes"
              :key="role.roleTypeId"
              :value="role.roleTypeId"
            >
              {{ role.description || role.roleTypeId }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select
            :label="translate('Role (selected party)')"
            label-placement="stacked"
            interface="popover"
            :placeholder="translate('Select role')"
            v-model="roleTypeIdTo"
          >
            <ion-select-option
              v-for="role in availableRoleTypes"
              :key="role.roleTypeId"
              :value="role.roleTypeId"
            >
              {{ role.description || role.roleTypeId }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-input
            :label="translate('Comment')"
            label-placement="stacked"
            :placeholder="translate('Optional')"
            v-model="comments"
          />
        </ion-item>
      </ion-list>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button :disabled="!isValid" :aria-label="translate('Confirm')" @click="confirm()">
          <ion-icon :icon="checkmarkCircle" />
        </ion-fab-button>
      </ion-fab>
    </template>
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
  IonLabel,
  IonList,
  IonNote,
  IonRadio,
  IonRadioGroup,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  modalController
} from '@ionic/vue';
import { arrowBackOutline, arrowForwardOutline, checkmarkCircle, closeOutline } from 'ionicons/icons';
import { computed, ref } from 'vue';
import { translate } from '@common';
import { useSeedStore } from '@/store/seed';
import { searchCustomers } from '@/services/customer';

interface RelatableParty {
  partyId: string;
  name: string;
  contact: string;
}

const props = defineProps<{
  currentPartyId: string;
}>();

const seed = useSeedStore();

const step = ref<'party' | 'relationship'>('party');
const queryString = ref('');
const results = ref<RelatableParty[]>([]);
const searching = ref(false);
const selectedParty = ref<RelatableParty | null>(null);
const partyRelationshipTypeId = ref('');
const roleTypeIdFrom = ref('');
const roleTypeIdTo = ref('');
const comments = ref('');

// Guards against an earlier search resolving after a later one and overwriting it.
let latestSearchId = 0;

const relationshipTypes = computed(() =>
  (seed as any).partyRelationshipTypes.ids
    .map((id: string) => (seed as any).partyRelationshipTypes.byId[id])
    .filter(Boolean)
);

const availableRoleTypes = computed(() =>
  ((seed as any).roleTypes.ids as string[])
    .map((id: string) => (seed as any).roleTypes.byId[id])
    .filter(Boolean)
);

const hasSearchTerm = computed(() => queryString.value.trim().length > 0);

const isValid = computed(() =>
  !!selectedParty.value &&
  !!partyRelationshipTypeId.value &&
  !!roleTypeIdFrom.value &&
  !!roleTypeIdTo.value
);

function onSearchInput(value: string) {
  queryString.value = value ?? '';
  selectedParty.value = null;
  if (!hasSearchTerm.value) {
    results.value = [];
    return;
  }
  runSearch();
}

// One box over the customer search index, which matches on party ID, name, email
// and phone in a single query, so the party type never has to be chosen up front.
async function runSearch() {
  const searchId = ++latestSearchId;
  searching.value = true;
  try {
    const { customers } = await searchCustomers({
      queryString: queryString.value.trim(),
      partyTypeId: 'All',
      pageSize: 20,
      pageIndex: 0
    });
    if (searchId !== latestSearchId) return;
    results.value = customers
      .filter((doc: any) => doc.partyId && doc.partyId !== props.currentPartyId)
      .map((doc: any) => ({
        partyId: doc.partyId,
        name: doc.fullName || doc.groupName || [doc.firstName, doc.lastName].filter(Boolean).join(' ').trim() || doc.partyId,
        contact: doc.emailAddress || doc.phoneNumber || ''
      }));
  } catch {
    if (searchId === latestSearchId) results.value = [];
  } finally {
    if (searchId === latestSearchId) searching.value = false;
  }
}

const selectedPartyId = computed({
  get: () => selectedParty.value?.partyId ?? '',
  set: (partyId: string) => {
    selectedParty.value = results.value.find((party) => party.partyId === partyId) ?? null;
  }
});

function dismiss() {
  modalController.dismiss(null, 'cancel');
}

function confirm() {
  modalController.dismiss({
    partyId: selectedParty.value!.partyId,
    partyRelationshipTypeId: partyRelationshipTypeId.value,
    roleTypeIdFrom: roleTypeIdFrom.value,
    roleTypeIdTo: roleTypeIdTo.value,
    comments: comments.value.trim() || undefined
  }, 'confirm');
}
</script>
