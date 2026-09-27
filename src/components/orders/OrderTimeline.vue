<template>
  <div class="timeline order-detail-timeline">
    <ion-item lines="none">
      <ion-icon slot="start" :icon="timeOutline" />
      <h2>{{ translate('Timeline') }}</h2>
    </ion-item>

    <ion-list>
      <template v-for="day in days" :key="day.key">
        <ion-item-divider color="light">
          <ion-label>{{ day.label }}</ion-label>
        </ion-item-divider>
        <template v-for="entry in day.entries" :key="entry.id">
          <ion-item :router-link="routeOf(entry)" :button="!!routeOf(entry) || opens(entry)" :detail="false" @click="toggle(entry)">
            <ion-icon slot="start" :icon="ICONS[entry.kind]" />
            <ion-label>
              <p v-if="entry.elapsed" class="overline">{{ entry.elapsed }}</p>
              {{ entry.headline }}
              <p v-for="(line, index) in entryLines(entry)" :key="index">{{ line }}</p>
            </ion-label>
            <ion-note slot="end">{{ entry.time }}</ion-note>
            <ion-icon v-if="opens(entry)" slot="end" :icon="opened.has(entry.id) ? chevronUpOutline : chevronDownOutline" />
          </ion-item>
          <!-- A folded run opens onto its transactions; any other row onto the records behind it. -->
          <ion-list v-if="opened.has(entry.id)" lines="none">
            <ion-item v-for="row in openedRows(entry)" :key="row.id">
              <ion-label>
                {{ row.title }}
                <p v-for="(line, index) in row.lines" :key="index">{{ line }}</p>
              </ion-label>
              <ion-note slot="end">{{ row.time }}</ion-note>
            </ion-item>
          </ion-list>
        </template>
      </template>

      <ion-item v-if="loading" lines="none">
        <ion-label>
          <ion-skeleton-text animated style="width: 60%" />
          <p><ion-skeleton-text animated style="width: 40%" /></p>
        </ion-label>
      </ion-item>
      <ion-item v-if="status.failed" lines="none">
        <ion-icon slot="start" :icon="warningOutline" color="warning" />
        <ion-label>{{ translate("Some history couldn't load") }}</ion-label>
        <ion-button slot="end" fill="clear" size="small" @click="emit('retry')">{{ translate('Retry') }}</ion-button>
      </ion-item>
      <ion-item v-if="status.truncated" lines="none">
        <ion-label>
          <p>{{ translate('Showing the latest {count} facility moves', { count: FACILITY_CHANGE_PAGE_SIZE }) }}</p>
        </ion-label>
      </ion-item>
      <ion-item v-if="!days.length && !loading" lines="none">
        <ion-label>{{ translate('No history recorded') }}</ion-label>
      </ion-item>
    </ion-list>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import { IonButton, IonIcon, IonItem, IonItemDivider, IonLabel, IonList, IonNote, IonSkeletonText } from '@ionic/vue';
import {
  addCircleOutline, alertCircleOutline, arrowForwardCircleOutline, arrowUndoOutline, cartOutline, checkmarkCircleOutline,
  checkmarkDoneOutline, chevronDownOutline, chevronUpOutline, closeCircleOutline, cloudDownloadOutline, compassOutline,
  cubeOutline, mailOutline, navigateOutline, pauseCircleOutline, pulseOutline, repeatOutline, sendOutline, storefrontOutline,
  swapHorizontalOutline, timeOutline, warningOutline,
} from 'ionicons/icons';
import { translate } from '@common';
import { FACILITY_CHANGE_PAGE_SIZE } from '@/composables/useOrderDetail';
import { useProductIdentity } from '@/composables/useProductIdentity';
import { isVirtualFacilityId, useOrderDetailStore, type OrderHistoryStatus } from '@/store/orderDetail';
import { useSeedStore } from '@/store/seed';
import type { EnrichedOrder } from '@/types/orderDetail';
import type { OrderEvent, OrderEventLink } from '@/utils/orderEvents';
import {
  formatClock, formatClockWithSeconds, groupTransactions, timelineDays,
  type TimelineContext, type TimelineEntry, type TransactionKind,
} from '@/utils/orderTimeline';

const props = defineProps<{
  order: EnrichedOrder;
  events: OrderEvent[];
  status: OrderHistoryStatus;
  /** Where a return or exchange row links to; the view knows the route and the user's permissions. */
  linkRoute: (link: OrderEventLink) => string | undefined;
}>();

const emit = defineEmits<{ retry: [] }>();

const seed = useSeedStore();
const orderDetailStore = useOrderDetailStore();
const { primaryIdentifier } = useProductIdentity();

// The ship-group strip uses the same compass, mail, cube and send icons for its four steps.
const ICONS: Record<TransactionKind, string> = {
  placed: cartOutline, imported: cloudDownloadOutline, approved: checkmarkCircleOutline, status: pulseOutline,
  cancelled: closeCircleOutline, shipped: sendOutline, packed: cubeOutline, picked: mailOutline,
  completed: checkmarkDoneOutline, sold: storefrontOutline, brokered: compassOutline, released: arrowForwardCircleOutline,
  rejected: alertCircleOutline, moved: navigateOutline, parked: pauseCircleOutline, unfillable: warningOutline,
  return: arrowUndoOutline, exchange: swapHorizontalOutline, items: addCircleOutline, run: repeatOutline,
};

const context = computed<TimelineContext>(() => {
  const shipGroupOfItem: Record<string, string> = {};
  const productOfItem: Record<string, string> = {};
  props.order.shipGroups.forEach((shipGroup) => shipGroup.items.forEach((item) => {
    shipGroupOfItem[item.orderItemSeqId] = shipGroup.id;
    productOfItem[item.orderItemSeqId] = item.productId;
  }));
  return {
    translate,
    facilityName: (facilityId: string) => seed.facilityName(facilityId),
    statusDescription: (statusId: string) => seed.statusDescription(statusId),
    describe: (value: string) => seed.describe(value),
    enumDescription: (enumId: string) => seed.enumDescription(enumId),
    isVirtualFacility: isVirtualFacilityId,
    itemTotal: Object.keys(shipGroupOfItem).length,
    shipGroupOfItem,
    posShipGroupIds: new Set(props.order.shipGroups.filter((shipGroup) => shipGroup.isPosCompleted).map((shipGroup) => shipGroup.id)),
    originFacilityId: props.order.originFacilityName ? props.order.originFacilityId : undefined,
    orderLabel: (orderId: string) => orderDetailStore.orderById(orderId)?.orderName || orderId,
    // Named as the item rows name it.
    itemLabel: (orderItemSeqId: string) => {
      const productId = productOfItem[orderItemSeqId];
      return productId ? primaryIdentifier(productId) || productId : '';
    },
  };
});

// Whether a facility is parking decides how a move reads — the move a cancellation makes into
// Rejected Item Parking, or a rejection — so the rows wait for the facility list on a cold load.
const facilitiesReady = computed(() => seed.facilities.ids.length > 0 || ['loaded', 'error'].includes(seed.facilities.status));
const loading = computed(() => props.status.loading || !facilitiesReady.value);

const days = computed(() => (facilitiesReady.value ? timelineDays(groupTransactions(props.events, context.value), context.value) : []));

const routeOf = (entry: TimelineEntry) => (entry.link ? props.linkRoute(entry.link) : undefined);
const opens = (entry: TimelineEntry) => !entry.link && (!!entry.children?.length || entry.records.length > 1);

const opened = reactive(new Set<string>());
function toggle(entry: TimelineEntry) {
  if (!opens(entry)) return;
  if (opened.has(entry.id)) opened.delete(entry.id);
  else opened.add(entry.id);
}

const entryLines = (entry: TimelineEntry) => [
  ...entry.details,
  ...entry.notes,
  entry.reason,
  entry.actor ? translate('By {actor}', { actor: entry.actor }) : '',
  entry.atKind === 'recorded' ? translate('Dated when the return was recorded') : '',
].filter(Boolean);

function openedRows(entry: TimelineEntry) {
  if (entry.children) {
    return entry.children.map((child) => ({
      id: child.id,
      title: child.headline,
      lines: [...child.details, child.reason].filter(Boolean),
      time: child.at === undefined ? '' : formatClock(child.at),
    }));
  }
  return entry.records.map((record) => ({ ...record, time: record.at === undefined ? '' : formatClockWithSeconds(record.at) }));
}
</script>
