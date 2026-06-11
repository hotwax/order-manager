<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="dismiss()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>Relationship History</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list v-if="timeline.length" lines="none">
      <ion-item v-for="entry in timeline" :key="entry.key" class="timeline-item">
        <div class="timeline-track" slot="start">
          <div class="timeline-dot" :class="entry.active ? 'dot-active' : 'dot-expired'" />
          <div class="timeline-line" />
        </div>
        <ion-label class="timeline-content">
          <div class="timeline-header-row">
            <ion-chip :color="entry.active ? 'primary' : 'medium'" outline class="type-chip">
              {{ entry.typeLabel }}
            </ion-chip>
            <ion-badge :color="entry.active ? 'primary' : 'medium'">
              {{ entry.active ? 'Active' : 'Expired' }}
            </ion-badge>
          </div>
          <h3>{{ entry.partyName }}</h3>
          <p class="party-id">{{ entry.partyId }}</p>
          <p class="date-range">
            {{ formatDate(entry.fromDate) }}
            <span v-if="entry.thruDate"> → {{ formatDate(entry.thruDate) }}</span>
            <span v-else> → Active</span>
          </p>
        </ion-label>
      </ion-item>
    </ion-list>

    <div v-else class="ion-padding ion-text-center">
      <p>No relationship history for this customer.</p>
    </div>
  </ion-content>
</template>

<script setup lang="ts">
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar,
  modalController
} from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import { computed } from 'vue';
import { DateTime } from 'luxon';
import { useCustomerStore } from '@/store/customer';
import { useSeedStore } from '@/store/seed';

const props = defineProps<{
  currentPartyId: string;
}>();

const store = useCustomerStore();
const seed = useSeedStore();

function parseDate(value?: string | number) {
  if (!value) return undefined;
  const str = String(value);
  const num = Number(value);
  if (/^\d+$/.test(str)) {
    return DateTime.fromMillis(str.length <= 10 ? num * 1000 : num);
  }
  const iso = DateTime.fromISO(str);
  return iso.isValid ? iso : DateTime.fromSQL(str);
}

function formatDate(value?: string | number) {
  const date = parseDate(value);
  return date?.isValid ? date.toLocaleString(DateTime.DATE_MED) : String(value ?? '');
}

function sortKey(value?: string | number): number {
  const date = parseDate(value);
  return date?.isValid ? date.toMillis() : 0;
}

const timeline = computed(() => {
  const personal: any[] = (store as any).personalRelationships(props.currentPartyId);
  const duplicates: any[] = (store as any).duplicateRelationships(props.currentPartyId);

  const personalEntries = personal.map((rel: any) => ({
    key: rel.key,
    typeLabel: (seed as any).describe(rel.partyRelationshipTypeId) as string,
    partyName: rel.relatedPartyName,
    partyId: rel.relatedPartyId,
    fromDate: rel.fromDate,
    thruDate: rel.thruDate,
    active: rel.active
  }));

  const duplicateEntries = duplicates.map((rel: any) => ({
    key: rel.key,
    typeLabel: (seed as any).describe('DUPLICATE') as string,
    partyName: rel.isCanonical ? rel.duplicatePartyName : rel.canonicalPartyName,
    partyId: rel.isCanonical ? rel.duplicatePartyId : rel.canonicalPartyId,
    fromDate: rel.fromDate,
    thruDate: rel.thruDate,
    active: rel.active
  }));

  return [...personalEntries, ...duplicateEntries]
    .sort((a, b) => sortKey(a.fromDate) - sortKey(b.fromDate));
});

function dismiss() {
  modalController.dismiss();
}
</script>

<style scoped>
.timeline-item {
  --padding-start: 0;
  align-items: stretch;
}

.timeline-track {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 32px;
  padding-top: 14px;
  flex-shrink: 0;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-active {
  background: var(--ion-color-primary, #3880ff);
}

.dot-expired {
  background: var(--ion-color-medium, #92949c);
}

.timeline-line {
  flex: 1;
  width: 2px;
  background: var(--ion-color-step-150, #d9d9d9);
  margin-top: 4px;
}

.timeline-item:last-child .timeline-line {
  display: none;
}

.timeline-content {
  padding: 12px 16px 16px 8px;
}

.timeline-header-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.type-chip {
  margin: 0;
  height: 22px;
  font-size: 11px;
}

.party-id {
  color: var(--ion-color-medium, #92949c);
  font-size: 12px;
  margin: 0 0 2px;
}

.date-range {
  font-size: 12px;
  color: var(--ion-color-medium, #92949c);
  margin: 0;
}
</style>
