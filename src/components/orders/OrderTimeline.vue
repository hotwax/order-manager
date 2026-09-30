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
        <ion-accordion-group :multiple="true">
          <!-- ion-accordion makes its header a button with a chevron, so only rows that open use it. -->
          <template v-for="entry in day.entries" :key="entry.id">
            <ion-accordion v-if="opens(entry)" :value="entry.id">
              <ion-item slot="header">
                <OrderTimelineEntry :entry="entry" />
              </ion-item>
              <!-- A folded run opens onto its transactions; any other row onto the records behind it. -->
              <ion-list v-if="entry.children" slot="content" lines="none">
                <ion-item v-for="child in childEntries(entry)" :key="child.id">
                  <OrderTimelineEntry :entry="child" />
                </ion-item>
              </ion-list>
              <ion-list v-else slot="content" lines="none">
                <ion-item v-for="record in entry.records" :key="record.id">
                  <ion-label>
                    {{ record.title }}
                    <p v-for="(line, index) in record.lines" :key="index">{{ line }}</p>
                  </ion-label>
                  <ion-note v-if="record.at" slot="end">{{ formatTime(record.at, { seconds: true }) }}</ion-note>
                </ion-item>
              </ion-list>
            </ion-accordion>
            <ion-item v-else :router-link="routeOf(entry)" :button="!!routeOf(entry)" :detail="false">
              <OrderTimelineEntry :entry="entry" />
            </ion-item>
          </template>
        </ion-accordion-group>
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
import { computed } from 'vue';
import {
  IonAccordion, IonAccordionGroup, IonButton, IonIcon, IonItem, IonItemDivider, IonLabel, IonList, IonNote, IonSkeletonText,
} from '@ionic/vue';
import { timeOutline, warningOutline } from 'ionicons/icons';
import { translate } from '@common';
import OrderTimelineEntry from '@/components/orders/OrderTimelineEntry.vue';
import { FACILITY_CHANGE_PAGE_SIZE } from '@/composables/useOrderDetail';
import { useProductIdentity } from '@/composables/useProductIdentity';
import { isVirtualFacilityId, useOrderDetailStore, type OrderHistoryStatus } from '@/store/orderDetail';
import type { EnrichedOrder } from '@/types/orderDetail';
import { formatTime } from '@/utils/format';
import type { OrderEvent, OrderEventLink } from '@/utils/orderEvents';
import { groupTransactions, timelineDays, type TimelineContext, type TimelineEntry } from '@/utils/orderTimeline';

const props = defineProps<{
  order: EnrichedOrder;
  events: OrderEvent[];
  status: OrderHistoryStatus;
  /** Where a return or exchange row links to; the view knows the route and the user's permissions. */
  linkRoute: (link: OrderEventLink) => string | undefined;
}>();

const emit = defineEmits<{ retry: [] }>();

const orderDetailStore = useOrderDetailStore();
const { primaryIdentifier } = useProductIdentity();

const context = computed<TimelineContext>(() => {
  const seed = orderDetailStore.seedLookup;
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
    isVirtualFacility: (facilityId: string) => isVirtualFacilityId(facilityId, seed),
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
const facilitiesReady = computed(() => orderDetailStore.seedLookup.ready);
const loading = computed(() => props.status.loading || !facilitiesReady.value);

const days = computed(() => (facilitiesReady.value ? timelineDays(groupTransactions(props.events, context.value), context.value) : []));

const routeOf = (entry: TimelineEntry) => (entry.link ? props.linkRoute(entry.link) : undefined);
const opens = (entry: TimelineEntry) => !entry.link && (!!entry.children?.length || entry.records.length > 1);

/** A folded run's transactions, each timed on its own. */
const childEntries = (entry: TimelineEntry) =>
  (entry.children || []).map((child) => ({ ...child, time: formatTime(child.at), elapsed: '' }));
</script>
