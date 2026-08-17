<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate('Bulk actions') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :disabled="loading" @click="loadRuns()">{{ translate('Refresh') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <SearchFilterCard
        v-model="searchQuery"
        :placeholder="translate('Search by action')"
        :show-clear="false"
        @clear="clearFilters"
      >
        <UniformFilterLayout @clear="clearFilters">
          <ion-select
            v-model="statusFilter"
            :label="translate('Status')"
            label-placement="stacked"
            fill="outline"
            interface="popover"
            :interface-options="{ showBackdrop: false }"
          >
            <ion-select-option value="All">{{ translate('All statuses') }}</ion-select-option>
            <ion-select-option v-for="option in statusOptions" :key="option.id" :value="option.id">
              {{ translate(option.label) }}
            </ion-select-option>
          </ion-select>
        </UniformFilterLayout>
      </SearchFilterCard>

      <ion-progress-bar v-if="loading" type="indeterminate" />

      <ErrorState v-if="error" title="Could not load bulk actions" :message="error" />

      <ion-list v-else-if="visibleRuns.length">
        <ion-list-header>
          <ion-label>{{ translate('{count} request(s)', { count: visibleRuns.length }) }}</ion-label>
        </ion-list-header>

        <ion-item v-for="run in visibleRuns" :key="run.logId" lines="full">
          <ion-label class="ion-text-wrap">
            {{ translate(run.actionName) }}
            <p>{{ runSummary(run) }}</p>
          </ion-label>

          <ion-note slot="end" class="ion-text-end run-submitted">
            <ion-chip :color="run.stateColor" outline>{{ translate(run.stateLabel) }}</ion-chip>
            <p>{{ submittedLabel(run) }}</p>
          </ion-note>

          <ion-buttons slot="end">
            <ion-button
              v-if="run.errorLogContentId"
              :aria-label="translate('Download error file')"
              :disabled="busyLogId === run.logId"
              @click="downloadErrorFile(run)"
            >
              <ion-icon slot="icon-only" :icon="downloadOutline" />
            </ion-button>
            <ion-button
              v-if="run.canCancel"
              color="danger"
              :aria-label="translate('Cancel request')"
              :disabled="busyLogId === run.logId"
              @click="confirmCancelRun(run)"
            >
              <ion-icon slot="icon-only" :icon="closeCircleOutline" />
            </ion-button>
          </ion-buttons>
        </ion-item>
      </ion-list>

      <EmptyState
        v-else-if="!loading"
        :title="translate('No bulk actions yet')"
        :message="translate('Bulk requests submitted from an order list appear here while they process.')"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenuButton,
  IonNote,
  IonPage,
  IonProgressBar,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  alertController,
  onIonViewDidLeave,
  onIonViewWillEnter
} from '@ionic/vue';
import { closeCircleOutline, downloadOutline } from 'ionicons/icons';
import { DateTime } from 'luxon';
import { computed, ref } from 'vue';
import { logger, translate } from '@common';
import EmptyState from '@/components/common/EmptyState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';
import UniformFilterLayout from '@/components/common/UniformFilterLayout.vue';
import {
  cancelBulkActionRun,
  fetchBulkActionErrorFile,
  fetchBulkActionRuns,
  hasActiveRun,
  type BulkActionRun
} from '@/services/bulkActions';
import { showToast } from '@/utils';

/**
 * Read-only view of the MDM runs the order bulk actions produced. Everything here comes from
 * DataManagerLog, so the page reports what the backend actually did rather than what the app
 * believed it submitted.
 */

// Statuses are grouped the way an operator thinks about them. "Completed with issues" shares
// DmlsFinished with "Completed", so that split is applied client-side on the failed-record count.
const statusOptions = [
  { id: 'active', label: 'Queued or processing' },
  { id: 'completed', label: 'Completed' },
  { id: 'completedWithIssues', label: 'Completed with issues' },
  { id: 'failed', label: 'Failed' },
  { id: 'cancelled', label: 'Cancelled' }
];

const POLL_INTERVAL_MS = 10000;

const runs = ref<BulkActionRun[]>([]);
const loading = ref(false);
const error = ref('');
const searchQuery = ref('');
const statusFilter = ref('All');
const busyLogId = ref('');
let pollTimer: ReturnType<typeof setTimeout> | undefined;

const visibleRuns = computed(() => {
  const search = searchQuery.value.trim().toLowerCase();
  return runs.value.filter((run) => {
    if (statusFilter.value === 'active' && !['pending', 'processing'].includes(run.state)) return false;
    if (statusFilter.value !== 'All' && statusFilter.value !== 'active' && run.state !== statusFilter.value) return false;
    return !search || run.actionName.toLowerCase().includes(search);
  });
});

onIonViewWillEnter(() => loadRuns());
onIonViewDidLeave(stopPolling);

async function loadRuns() {
  loading.value = true;
  error.value = '';
  try {
    const result = await fetchBulkActionRuns();
    runs.value = result.runs;
    schedulePoll();
  } catch (err: any) {
    error.value = err?.message || translate('Failed to load bulk actions');
  } finally {
    loading.value = false;
  }
}

// Only keep polling while something is actually moving; a settled list needs no timer.
function schedulePoll() {
  stopPolling();
  if (!hasActiveRun(runs.value)) return;
  pollTimer = setTimeout(loadRuns, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = undefined;
}

function runSummary(run: BulkActionRun) {
  if (run.state === 'pending') {
    return run.totalRecordCount == null
      ? translate('Queued')
      : translate('{count} order(s) queued', { count: run.totalRecordCount });
  }
  if (run.totalRecordCount == null) return translate('Processing');
  if (run.failedRecordCount > 0) {
    return translate('{success} of {total} order(s) processed ({failed} failed)', {
      success: run.successRecordCount,
      total: run.totalRecordCount,
      failed: run.failedRecordCount
    });
  }
  return translate('{success} of {total} order(s) processed', {
    success: run.successRecordCount,
    total: run.totalRecordCount
  });
}

function submittedLabel(run: BulkActionRun) {
  if (!run.submittedAt) return '';
  const submitted = DateTime.fromISO(String(run.submittedAt));
  return submitted.isValid ? submitted.toRelative() || '' : '';
}

async function downloadErrorFile(run: BulkActionRun) {
  if (!run.errorLogContentId) return;
  busyLogId.value = run.logId;
  try {
    const content = await fetchBulkActionErrorFile(run.configId, run.errorLogContentId);
    if (!content) {
      await showToast(translate('No error file is stored for this request.'));
      return;
    }
    saveTextFile(content, `${run.configId}_errors_${run.logId}.json`);
  } catch (err) {
    logger.error('Failed to download bulk action error file', err);
    await showToast(translate('Failed to download the error file. Please try again.'));
  } finally {
    busyLogId.value = '';
  }
}

function saveTextFile(content: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function confirmCancelRun(run: BulkActionRun) {
  const alert = await alertController.create({
    header: translate('Cancel request'),
    message: translate('This stops the queued request before it runs. Orders already processed are not reverted.'),
    buttons: [
      { text: translate('Dismiss'), role: 'cancel' },
      {
        text: translate('Confirm'),
        handler: async () => {
          busyLogId.value = run.logId;
          try {
            await cancelBulkActionRun(run.configId, run.logId);
            await showToast(translate('Request cancelled.'));
            await loadRuns();
          } catch (err) {
            logger.error('Failed to cancel bulk action run', err);
            await showToast(translate('Failed to cancel the request. Please try again.'));
          } finally {
            busyLogId.value = '';
          }
        }
      }
    ]
  });
  await alert.present();
}

function clearFilters() {
  searchQuery.value = '';
  statusFilter.value = 'All';
}
</script>

<style scoped>
.run-submitted {
  align-self: center;
}
</style>
