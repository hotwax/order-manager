<template>
  <div class="order-detail-header">
    <!-- direct child matching .order-detail-header>ion-item -->
    <ion-item lines="none">
      <ion-icon slot="start" :icon="ticketOutline" />
      <ion-label>
        <h1>{{ order.orderName ? order.orderName : order.id }}</h1>
        <p>{{ order.id }}</p>
      </ion-label>
      <ion-badge v-if="order.status" slot="end" :color="getStatusColor(order.statusId)">
        {{ order.status }}
      </ion-badge>
    </ion-item>

    <!-- timeline: child matching .order-detail-timeline -->
    <div class="timeline order-detail-timeline">
      <ion-item lines="none">
        <ion-icon slot="start" :icon="timeOutline" />
        <h2>{{ translate('Timeline') }}</h2>
      </ion-item>

      <ion-list>
        <ion-item v-for="event in orderTimeline" :key="event.id" :router-link="event.route" :button="!!event.route" :detail="false">
          <ion-icon :icon="event.icon" slot="start" />
          <ion-label>
            <p v-if="event.timeDiff">{{ event.timeDiff }}</p>
            {{ translate(event.label) }}
            <p v-if="event.metaData">{{ event.metaData }}</p>
          </ion-label>
          <ion-note slot="end" v-if="event.value && event.valueType === 'date-time-millis'">
            {{ formatDateTime(event.value) }}
          </ion-note>
        </ion-item>

        <template v-if="!orderTimeline.length">
          <ion-item>
            <ion-icon :icon="pulseOutline" slot="start" />
            <ion-label>
              {{ translate('Order status') }}
              <p>{{ translate('Initial status details') }}</p>
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-icon :icon="compassOutline" slot="start" />
            <ion-label>
              {{ translate('Order facility change') }}
              <p>{{ translate('Facility details') }}</p>
            </ion-label>
          </ion-item>
        </template>
      </ion-list>
    </div>

    <!-- details wrapper: child matching .order-detail-header-details -->
    <div class="order-detail-header-details">
      <ion-card class="customer-summary-card">
        <ion-card-header>
          <ion-item lines="none">
            <ion-label>
              <ion-card-title>{{ order.customerName || 'Customer name' }}</ion-card-title>
            </ion-label>
            <ion-button v-if="customerPartyId" slot="end" fill="clear" size="small"
              :router-link="'/customers/' + customerPartyId">
              {{ translate('View details') }}
            </ion-button>
          </ion-item>
        </ion-card-header>
        <ion-list lines="none">
          <ion-item>
            <ion-label>
              <p>{{ translate('Email') }}</p>
              {{ customer?.email || translate('Email not available') }}
            </ion-label>
            <ion-button v-if="!customer?.email && customerPartyId" slot="end" fill="clear" size="small"
              @click="$emit('open-customer-contact', 'EMAIL_ADDRESS', 'ORDER_EMAIL')">
              {{ translate('Add') }}
            </ion-button>
          </ion-item>
          <ion-item>
            <ion-label>
              <p>{{ translate('Phone') }}</p>
              {{ customer?.phone || translate('Phone not available') }}
            </ion-label>
            <ion-button v-if="!customer?.phone && customerPartyId" slot="end" fill="clear" size="small"
              @click="$emit('open-customer-contact', 'TELECOM_NUMBER', 'PHONE_BILLING')">
              {{ translate('Add') }}
            </ion-button>
          </ion-item>
          <ion-item>
            <ion-label>
              <p>{{ translate('Locale') }}</p>
              {{ order.localeString || translate('Locale not available') }}
            </ion-label>
            <ion-button v-if="!order.localeString" slot="end" fill="clear" size="small" @click="$emit('open-locale-prompt')">
              {{ translate('Add') }}
            </ion-button>
          </ion-item>
          <ion-item>
            <ion-label>
              <p>{{ translate('Billing address') }}</p>
              <template v-if="billingAddress?.lines?.length">
                <div v-for="(line, idx) in billingAddress.lines" :key="idx">{{ line }}</div>
              </template>
              <div v-else>{{ translate('Billing address not available') }}</div>
            </ion-label>
            <ion-button v-if="!billingAddress?.lines?.length && customerPartyId" slot="end" fill="clear" size="small"
              @click="$emit('open-customer-contact', 'POSTAL_ADDRESS', 'BILLING_LOCATION')">
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
          <ion-button fill="clear" size="small" @click="$emit('open-manage-identifications')">
            {{ translate('Manage') }}
          </ion-button>
        </ion-card-header>
        <ion-list lines="none">
          <ion-item>
            <ion-label>
              <p>{{ translate('Order Number') }}</p>
              {{ order.externalId || translate('Order Number') }}
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
              <p>{{ translate('Order Name') }}</p>
              {{ order.orderName || translate('Order Name') }}
            </ion-label>
          </ion-item>
          <ion-item v-for="id in order.identifications" :key="id.orderIdentificationTypeId">
            <ion-label>
              <p>{{ id.typeLabel }}</p>
              {{ id.idValue }}
            </ion-label>
            <ion-button
              v-if="id.shopifyAdminUrl || (id.orderIdentificationTypeId === 'SHOPIFY_ORD_ID' && shopifyAdminUrl)"
              slot="end"
              fill="clear"
              :href="id.shopifyAdminUrl || shopifyAdminUrl"
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

      <ion-card v-if="riskSummary.hasRiskSignal">
        <ion-card-header>
          <ion-card-title>{{ translate('Fraud risk') }}</ion-card-title>
        </ion-card-header>
        <ion-list lines="none">
          <ion-item lines="none">
            <ion-icon slot="start" :icon="shieldOutline" :color="riskLevelColor(order.riskLevelEnumId)" />
            <ion-label>
              <p>{{ translate('Recommendation') }}</p>
              {{ riskSummary.recommendation }}
            </ion-label>
            <ion-badge slot="end" :color="riskLevelColor(order.riskLevelEnumId)">
              {{ riskSummary.level }}
            </ion-badge>
          </ion-item>
          <ion-item v-if="riskFactCount" button detail lines="none" @click="$emit('open-risk-details')">
            <div class="sentiment-chips">
              <ion-chip color="danger" outline>{{ riskCounts.negative }} {{ translate('negative') }}</ion-chip>
              <ion-chip color="medium" outline>{{ riskCounts.neutral }} {{ translate('neutral') }}</ion-chip>
              <ion-chip color="success" outline>{{ riskCounts.positive }} {{ translate('positive') }}</ion-chip>
            </div>
          </ion-item>
        </ion-list>
      </ion-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSkeletonText,
} from '@ionic/vue';
import {
  compassOutline,
  openOutline,
  pulseOutline,
  shieldOutline,
  ticketOutline,
  timeOutline,
} from 'ionicons/icons';
import AttributeListItem from '@/components/orders/AttributeListItem.vue';

defineProps<{
  order: any;
  customer: any;
  customerPartyId: string;
  billingAddress: any;
  orderTimeline: any[];
  exchangeSources: any[];
  canViewReturns: boolean;
  shopifyAdminUrl?: string;
  riskSummary: any;
  riskFactCount: number;
  riskCounts: { negative: number; neutral: number; positive: number };
  getStatusColor: (statusId: string) => string;
  riskLevelColor: (riskLevelEnumId: string) => string;
  formatDateTime: (dt: any) => string;
  translate: (key: string) => string;
}>();

defineEmits<{
  (e: 'open-customer-contact', contactMechPurposeTypeId: string, contactMechTypeId: string): void;
  (e: 'open-locale-prompt'): void;
  (e: 'open-manage-identifications'): void;
  (e: 'open-risk-details'): void;
}>();
</script>

<style scoped>
.order-detail-header {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  align-items: start;
}

.order-detail-header > ion-item {
  grid-column: 1 / -1;
}

.order-detail-header-details {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  grid-column: span 2;
  align-items: start;
}

.order-detail-header-details ion-card {
  margin: var(--spacer-xs);
}

@media (min-width: 991px) {
  .order-detail-header {
    grid-template-columns: 1fr 375px;
    grid-template-areas: "title title" "main timeline";
  }

  .order-detail-header-details {
    grid-area: main;
  }
}

.customer-summary-card ion-card-header {
  display: flex;
  gap: var(--spacer-xs);
  justify-content: space-between;
}
</style>
