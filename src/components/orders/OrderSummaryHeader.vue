<template>
  <div class="order-detail-header">
    <ion-item lines="none">
      <ion-icon slot="start" :icon="ticketOutline" />
      <ion-label>
        <h1>{{ order.orderName ? order.orderName : order.id }}</h1>
        <p>{{ order.id }}</p>
      </ion-label>
      <ion-badge v-if="order.status" slot="end" :color="commonUtil.getStatusColor(order.statusId)">
        {{ order.status }}
      </ion-badge>
    </ion-item>

    <OrderTimeline :order="order" :events="events" :status="historyStatus" :link-route="linkRoute" @retry="emit('retry-history')" />

    <div class="order-detail-header-details">
      <ion-card class="customer-summary-card">
        <ion-card-header>
          <ion-item lines="none">
            <ion-label>
              <ion-card-title>{{ order.customer.name || translate('Customer name') }}</ion-card-title>
            </ion-label>
            <ion-button v-if="order.customer.partyId" slot="end" fill="clear" size="small"
              :router-link="'/customers/' + order.customer.partyId">
              {{ translate('View details') }}
            </ion-button>
          </ion-item>
        </ion-card-header>
        <ion-list lines="none">
          <ion-item>
            <ion-label>
              <p>{{ translate('Email') }}</p>
              {{ order.customer.email || translate('Email not available') }}
            </ion-label>
            <ion-button v-if="!order.customer.email && order.customer.partyId" slot="end" fill="clear" size="small"
              @click="emit('open-customer-contact', 'EMAIL_ADDRESS', 'ORDER_EMAIL')">
              {{ translate('Add') }}
            </ion-button>
          </ion-item>
          <ion-item>
            <ion-label>
              <p>{{ translate('Phone') }}</p>
              {{ order.customer.phone || translate('Phone not available') }}
            </ion-label>
            <ion-button v-if="!order.customer.phone && order.customer.partyId" slot="end" fill="clear" size="small"
              @click="emit('open-customer-contact', 'TELECOM_NUMBER', 'PHONE_BILLING')">
              {{ translate('Add') }}
            </ion-button>
          </ion-item>
          <ion-item>
            <ion-label>
              <p>{{ translate('Locale') }}</p>
              {{ order.localeString || translate('Locale not available') }}
            </ion-label>
            <ion-button v-if="!order.localeString" slot="end" fill="clear" size="small" @click="emit('open-locale-prompt')">
              {{ translate('Add') }}
            </ion-button>
          </ion-item>
          <ion-item>
            <ion-label>
              <p>{{ translate('Billing address') }}</p>
              <template v-if="order.customer.billingAddress">
                <div v-for="(line, idx) in order.customer.billingAddress.lines" :key="idx">{{ line }}</div>
              </template>
              <div v-else>{{ translate('Billing address not available') }}</div>
            </ion-label>
            <ion-button v-if="!order.customer.billingAddress && order.customer.partyId" slot="end" fill="clear" size="small"
              @click="emit('open-customer-contact', 'POSTAL_ADDRESS', 'BILLING_LOCATION')">
              {{ translate('Add') }}
            </ion-button>
          </ion-item>
        </ion-list>
      </ion-card>

      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ translate('Source') }}</ion-card-title>
        </ion-card-header>
        <ion-list lines="none">
          <ion-item>
            <ion-label>
              <p>{{ translate('Brand') }}</p>
              {{ order.productStoreName }}
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-label>
              <p>{{ translate('Channel') }}</p>
              {{ order.channel || translate('Channel') }}
            </ion-label>
          </ion-item>
          <ion-item v-if="order.salesChannelEnumId === 'POS_SALES_CHANNEL'">
            <ion-label>
              <p>{{ translate('Placed at') }}</p>
              {{ order.originFacilityName || translate('Facility not available') }}
              <p>{{ order.originFacilityId }}</p>
            </ion-label>
          </ion-item>
          <template v-for="source in exchangeSources" :key="source.orderId">
            <ion-item button :detail="true" :router-link="`/orders/${source.orderId}`">
              <ion-label>
                <p>{{ translate('Exchange of') }}</p>
                <ion-skeleton-text v-if="source.loading" animated style="width: 60%" />
                <template v-else>{{ source.orderName }}</template>
              </ion-label>
            </ion-item>
            <ion-item v-for="returnId in canViewReturns ? source.returnIds : []" :key="returnId" button :detail="true" :router-link="`/returns/${returnId}`">
              <ion-label>
                <p>{{ translate('Processed with return') }}</p>
                {{ returnId }}
              </ion-label>
            </ion-item>
          </template>
        </ion-list>
      </ion-card>

      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ translate('Order identifications') }}</ion-card-title>
          <ion-button fill="clear" size="small" @click="emit('open-manage-identifications')">
            {{ translate('Manage') }}
          </ion-button>
        </ion-card-header>
        <ion-list lines="none">
          <ion-item>
            <ion-label>
              <p>{{ translate('Order number') }}</p>
              {{ order.externalId || translate('Order number') }}
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-label>
              <p>{{ translate('Order ID') }}</p>
              {{ order.id }}
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-label>
              <p>{{ translate('Order name') }}</p>
              {{ order.orderName || translate('Order name') }}
            </ion-label>
          </ion-item>
          <ion-item v-for="id in order.identifications" :key="id.orderIdentificationTypeId">
            <ion-label>
              <p>{{ id.typeLabel }}</p>
              {{ id.idValue }}
            </ion-label>
            <ion-button
              v-if="id.orderIdentificationTypeId === 'SHOPIFY_ORD_ID' && shopifyAdminUrl"
              slot="end"
              fill="clear"
              :href="shopifyAdminUrl"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="translate('View in Shopify')"
              :title="translate('View in Shopify')"
            >
              <ion-icon slot="icon-only" :icon="openOutline" />
            </ion-button>
          </ion-item>
        </ion-list>
      </ion-card>

      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ translate('Attributes') }}</ion-card-title>
          <ion-button fill="clear" size="small" @click="emit('open-manage-attributes')">
            {{ translate('Manage') }}
          </ion-button>
        </ion-card-header>
        <ion-list lines="none">
          <AttributeListItem
            v-for="attribute in order.attributes"
            :key="attribute.id"
            :name="attribute.name"
            :value="attribute.value"
            :description="attribute.description"
          />
          <ion-item v-if="!order.attributes.length">
            <ion-label>{{ translate('No order attributes') }}</ion-label>
          </ion-item>
        </ion-list>
      </ion-card>

      <ion-card v-if="order.risk.hasRiskSignal">
        <ion-card-header>
          <ion-card-title>{{ translate('Fraud risk') }}</ion-card-title>
        </ion-card-header>
        <ion-list lines="none">
          <ion-item lines="none">
            <ion-icon slot="start" :icon="shieldOutline" :color="riskLevelColor(order.riskLevelEnumId || '')" />
            <ion-label>
              <p>{{ translate('Recommendation') }}</p>
              {{ order.risk.recommendation }}
            </ion-label>
            <ion-badge slot="end" :color="riskLevelColor(order.riskLevelEnumId || '')">
              {{ order.risk.level }}
            </ion-badge>
          </ion-item>
          <ion-item v-if="order.risk.facts.length" button detail lines="none" @click="emit('open-risk-details')">
            <div class="sentiment-chips">
              <ion-chip color="danger" outline>{{ translate('{count} negative', { count: order.risk.counts.negative }) }}</ion-chip>
              <ion-chip color="medium" outline>{{ translate('{count} neutral', { count: order.risk.counts.neutral }) }}</ion-chip>
              <ion-chip color="success" outline>{{ translate('{count} positive', { count: order.risk.counts.positive }) }}</ion-chip>
            </div>
          </ion-item>
        </ion-list>
      </ion-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonBadge, IonButton, IonCard, IonCardHeader, IonCardTitle, IonChip, IonIcon, IonItem, IonLabel, IonList, IonSkeletonText } from '@ionic/vue';
import { openOutline, shieldOutline, ticketOutline } from 'ionicons/icons';
import { commonUtil, translate } from '@common';
import AttributeListItem from '@/components/orders/AttributeListItem.vue';
import OrderTimeline from '@/components/orders/OrderTimeline.vue';
import { riskLevelColor } from '@/utils';
import type { OrderHistoryStatus } from '@/store/orderDetail';
import type { EnrichedOrder } from '@/types/orderDetail';
import type { OrderEvent, OrderEventLink } from '@/utils/orderEvents';

defineProps<{
  order: EnrichedOrder;
  /** The order's history; the timeline groups it into business transactions. */
  events: OrderEvent[];
  historyStatus: OrderHistoryStatus;
  /** Where a timeline row links to, resolved against the current route and permissions. */
  linkRoute: (link: OrderEventLink) => string | undefined;
  /** The orders this one was exchanged from, hydrated as they load. */
  exchangeSources: Array<{ orderId: string; loading: boolean; orderName: string; returnIds: string[] }>;
  canViewReturns: boolean;
  shopifyAdminUrl: string;
}>();

const emit = defineEmits<{
  'open-customer-contact': [contactMechTypeId: string, contactMechPurposeTypeId: string];
  'open-locale-prompt': [];
  'open-manage-identifications': [];
  'open-manage-attributes': [];
  'open-risk-details': [];
  'retry-history': [];
}>();
</script>

<style scoped src="./orderDetailCardHeader.css"></style>

<style scoped>
.sentiment-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-xs);
}

/* One column on phones and tablets, the timeline under the cards; beside them from 900px. */
.order-detail-header {
  display: grid;
  gap: var(--spacer-base);
  grid-template-columns: minmax(0, 1fr);
}

.order-detail-header>ion-item {
  grid-row: 1;
  grid-column: 1;
}

.order-detail-header-details {
  grid-row: 2;
  display: flex;
  flex-wrap: wrap;
  justify-content: start;
}

.order-detail-header-details ion-card {
  flex: 1 1 300px;
  max-width: 375px;
}

.order-detail-timeline {
  grid-row: 3;
  border-top: var(--border-medium);
}

@media (min-width: 900px) {
  .order-detail-header {
    align-items: start;
    grid-template-columns: minmax(0, 1fr) minmax(360px, 420px);
    grid-template-rows: auto 1fr;
  }

  .order-detail-header-details {
    align-items: start;
    grid-template-columns: 1fr;
  }

  .order-detail-timeline {
    grid-column: 2;
    grid-row: 1 / span 2;
    border-top: none;
    border-left: var(--border-medium);
  }
}

.customer-summary-card ion-card-header {
  display: flex;
  gap: var(--spacer-xs);
  justify-content: space-between;
}
</style>
