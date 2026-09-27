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
          <template v-for="entry in day.entries" :key="entry.id">
            <ion-accordion v-if="isExpandable(entry)" :value="entry.id">
              <ion-item slot="header">
                <OrderTimelineEntry :entry="entry" />
              </ion-item>
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
                  <ion-note v-if="record.at" slot="end">{{ formatClockWithSeconds(record.at) }}</ion-note>
                </ion-item>
              </ion-list>
            </ion-accordion>
            <ion-item v-else :router-link="routeOf(entry)" :button="!!routeOf(entry)" :detail="false">
              <OrderTimelineEntry :entry="entry" />
            </ion-item>
          </template>
        </ion-accordion-group>
      </template>

      <ion-item v-if="sourceStatus.loading.length" lines="none">
        <ion-label>
          <ion-skeleton-text animated style="width: 60%" />
          <p><ion-skeleton-text animated style="width: 40%" /></p>
        </ion-label>
      </ion-item>
      <ion-item v-if="sourceStatus.failed.length" lines="none">
        <ion-icon slot="start" :icon="warningOutline" color="warning" />
        <ion-label>
          {{ translate("Some history couldn't load") }}
          <p>{{ failedSourcesLabel }}</p>
        </ion-label>
        <ion-button slot="end" fill="clear" size="small" @click="emit('retry')">{{ translate('Retry') }}</ion-button>
      </ion-item>
      <ion-item v-if="sourceStatus.facilityChangesTruncated" lines="none">
        <ion-label>
          <p>{{ translate('Showing the latest {count} facility moves', { count: FACILITY_CHANGE_PAGE_SIZE }) }}</p>
        </ion-label>
      </ion-item>
      <ion-item v-if="!days.length && !sourceStatus.loading.length" lines="none">
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
import { isVirtualFacilityId, useOrderDetailStore, type OrderEventSourceKey, type OrderEventSourceStatus } from '@/store/orderDetail';
import { useSeedStore } from '@/store/seed';
import type { EnrichedOrder } from '@/types/orderDetail';
import type { OrderEvent, OrderEventLink } from '@/utils/orderEvents';
import {
  formatClock, formatClockWithSeconds, groupTransactions, timelineDays,
  type TimelineContext, type TimelineEntry, type TimelineTransaction,
} from '@/utils/orderTimeline';

const props = defineProps<{
  order: EnrichedOrder;
  events: OrderEvent[];
  sourceStatus: OrderEventSourceStatus;
  /** Where a return or exchange row links to; the view knows the route and the user's permissions. */
  linkRoute: (link: OrderEventLink) => string | undefined;
}>();

const emit = defineEmits<{ retry: [] }>();

const seed = useSeedStore();
const orderDetailStore = useOrderDetailStore();

const SOURCE_LABELS: Record<OrderEventSourceKey, string> = {
  facilityChanges: 'Facility moves',
  unfillable: 'Brokering attempts',
  fulfillment: 'Pick, pack and ship dates',
  returns: 'Return details',
  exchanges: 'Exchange orders',
};

const context = computed<TimelineContext>(() => {
  const shipGroupOfItem: Record<string, string> = {};
  props.order.shipGroups.forEach((shipGroup) => shipGroup.items.forEach((item) => { shipGroupOfItem[item.orderItemSeqId] = shipGroup.id; }));
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
  };
});

const days = computed(() => timelineDays(groupTransactions(props.events, context.value), context.value));

const failedSourcesLabel = computed(() => props.sourceStatus.failed.map((key) => translate(SOURCE_LABELS[key])).join(', '));

const isExpandable = (entry: TimelineEntry) => !entry.link && (!!entry.children?.length || entry.records.length > 1);

const routeOf = (entry: TimelineEntry) => (entry.link ? props.linkRoute(entry.link) : undefined);

/** A folded run's transactions, each timed on its own. */
function childEntries(entry: TimelineEntry) {
  return (entry.children || []).map((child: TimelineTransaction) => ({ ...child, time: child.at ? formatClock(child.at) : '', elapsed: '' }));
}
</script>
