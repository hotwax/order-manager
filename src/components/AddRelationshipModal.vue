<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="dismiss()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>Add Relationship</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list>
      <!-- Type toggle -->
      <ion-item lines="none">
        <ion-segment v-model="partyType" @ion-change="onTypeChange">
          <ion-segment-button value="PERSON">
            <ion-label>Person</ion-label>
          </ion-segment-button>
          <ion-segment-button value="PARTY_GROUP">
            <ion-label>Group</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-item>

      <!-- Search fields -->
      <template v-if="partyType === 'PERSON'">
        <ion-item lines="none">
          <div class="name-search-row">
            <ion-input
              label="First name"
              label-placement="stacked"
              placeholder="First name"
              v-model="firstName"
              @ion-input="scheduleSearch"
              :clearInput="true"
            />
            <ion-input
              label="Last name"
              label-placement="stacked"
              placeholder="Last name"
              v-model="lastName"
              @ion-input="scheduleSearch"
              :clearInput="true"
            />
          </div>
        </ion-item>
      </template>
      <template v-else>
        <ion-item>
          <ion-input
            label="Company name"
            label-placement="stacked"
            placeholder="Search by company name"
            v-model="groupName"
            @ion-input="scheduleSearch"
            :clearInput="true"
          />
        </ion-item>
      </template>
    </ion-list>

    <!-- Search results -->
    <div v-if="searching" class="ion-padding ion-text-center">
      <ion-spinner name="crescent" />
    </div>

    <ion-list v-else-if="results.length" lines="full">
      <ion-item
        v-for="party in results"
        :key="party.partyId"
        :class="{ 'party-selected': selectedParty?.partyId === party.partyId }"
        button
        detail="false"
        @click="selectParty(party)"
      >
        <ion-label>
          <h3>{{ party.name }}</h3>
          <p>{{ party.partyId }}</p>
        </ion-label>
        <ion-icon
          v-if="selectedParty?.partyId === party.partyId"
          slot="end"
          :icon="checkmarkCircle"
          color="primary"
        />
      </ion-item>
    </ion-list>

    <div v-else-if="hasSearchTerm && !searching" class="ion-padding ion-text-center">
      <p>No parties found</p>
    </div>

    <div v-else-if="!hasSearchTerm" class="ion-padding ion-text-center">
      <p class="hint">Type a name to search</p>
    </div>

    <!-- Relationship config — shown after a party is selected -->
    <ion-list v-if="selectedParty" lines="full">
      <ion-item lines="none">
        <ion-label color="medium">
          <p class="overline">Selected party</p>
          <h3>{{ selectedParty.name }}</h3>
        </ion-label>
      </ion-item>
      <ion-item>
        <ion-select
          label="Relationship type"
          label-placement="stacked"
          interface="popover"
          placeholder="Select relationship type"
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
        <ion-input
          label="Comment"
          label-placement="stacked"
          placeholder="Optional"
          v-model="comments"
        />
      </ion-item>
    </ion-list>
    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!isValid" @click="confirm()">
        <ion-icon :icon="checkmarkCircle" />
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
  IonLabel,
  IonList,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  modalController
} from '@ionic/vue';
import { checkmarkCircle, closeOutline } from 'ionicons/icons';
import { computed, ref } from 'vue';
import { useSeedStore } from '@/store/seed';
import { findParties } from '@/services/customer';
import type { PartySearchResult } from '@/services/customer';

const props = defineProps<{
  currentPartyId: string;
}>();

const seed = useSeedStore();

const partyType = ref<'PERSON' | 'PARTY_GROUP'>('PERSON');
const firstName = ref('');
const lastName = ref('');
const groupName = ref('');
const results = ref<PartySearchResult[]>([]);
const searching = ref(false);
const selectedParty = ref<PartySearchResult | null>(null);
const partyRelationshipTypeId = ref('');
const comments = ref('');

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const relationshipTypes = computed(() =>
  (seed as any).partyRelationshipTypes.ids
    .map((id: string) => (seed as any).partyRelationshipTypes.byId[id])
    .filter(Boolean)
);

const hasSearchTerm = computed(() =>
  partyType.value === 'PERSON'
    ? firstName.value.trim().length > 0 || lastName.value.trim().length > 0
    : groupName.value.trim().length > 0
);

const isValid = computed(() => !!selectedParty.value && !!partyRelationshipTypeId.value);

function onTypeChange() {
  firstName.value = '';
  lastName.value = '';
  groupName.value = '';
  results.value = [];
  selectedParty.value = null;
  partyRelationshipTypeId.value = '';
}

function scheduleSearch() {
  selectedParty.value = null;
  if (debounceTimer) clearTimeout(debounceTimer);
  if (!hasSearchTerm.value) {
    results.value = [];
    return;
  }
  debounceTimer = setTimeout(() => runSearch(), 350);
}

async function runSearch() {
  searching.value = true;
  try {
    const parties = await findParties({
      partyTypeId: partyType.value,
      firstName: firstName.value || undefined,
      lastName: lastName.value || undefined,
      groupName: groupName.value || undefined
    });
    results.value = parties.filter((p) => p.partyId !== props.currentPartyId);
  } catch {
    results.value = [];
  } finally {
    searching.value = false;
  }
}

function selectParty(party: PartySearchResult) {
  selectedParty.value = selectedParty.value?.partyId === party.partyId ? null : party;
}

function dismiss() {
  modalController.dismiss(null, 'cancel');
}

function confirm() {
  modalController.dismiss({
    partyId: selectedParty.value!.partyId,
    partyRelationshipTypeId: partyRelationshipTypeId.value,
    comments: comments.value.trim() || undefined
  }, 'confirm');
}
</script>

<style scoped>
.name-search-row {
  display: flex;
  gap: 12px;
  width: 100%;
}

.name-search-row ion-input {
  flex: 1;
}

.party-selected {
  --background: var(--ion-color-primary-tint, #e8f0fe);
}

.hint {
  color: var(--ion-color-medium, #92949c);
}

.overline {
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-size: 10px;
  color: var(--ion-color-medium, #92949c);
  margin: 0 0 4px;
}
</style>
