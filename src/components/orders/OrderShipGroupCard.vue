<template>
  <ion-card class="ship-group-card">
    <div class="ship-group-header-wrapper">
      <ion-card-header>
        <ion-card-title>
          {{ shipGroup.id }} {{ shipGroup.facilityName || translate('Facility Name') }}
        </ion-card-title>
        <ion-card-subtitle>
          {{ shipGroup.itemSummary }}
        </ion-card-subtitle>
      </ion-card-header>

      <div class="ship-group-status-toggle">
        <p>{{ shipGroup.statusLabel }}</p>
        <!-- A counter sale has one state, so there is nothing to expand into. -->
        <ion-button v-if="!shipGroup.isPosCompleted" fill="clear" color="medium" @click="emit('update:expanded', !expanded)" :aria-label="translate('Toggle ship group')" :title="translate('Toggle ship group')">
          <ion-icon slot="icon-only" :icon="expanded ? chevronUp : chevronDown" />
        </ion-button>
      </div>
    </div>

    <ion-progress-bar :value="shipGroup.progress" :color="shipGroup.progress === 1 ? 'success' : 'primary'" />

    <ion-item v-if="holdTaskCount" color="warning" lines="none">
      <ion-icon slot="start" :icon="warningOutline" />
      <ion-label>{{ holdTaskCount }} {{ translate(holdTaskCount === 1 ? 'hold task' : 'hold tasks') }}</ion-label>
      <ion-button slot="end" fill="solid" color="dark" size="small" @click="emit('show-holds')">
        {{ translate('View details') }}
      </ion-button>
    </ion-item>

    <!-- Gift, shipping date, delivery date and instruction options all describe a
         shipment that will happen; a counter sale has already happened. -->
    <div v-if="!shipGroup.isPosCompleted" class="ship-group-options-wrapper">
      <!-- shows when expanded -->
      <div v-collapsible class="ship-group-expanded-options"
        :class="{ 'ship-group-expanded-options-open': optionsOpen }"
        :aria-hidden="!optionsOpen"
        :inert="!optionsOpen">
        <div class="ship-group-options">
          <ion-chip v-if="!shipGroup.giftMessage" outline @click="openGiftModal">
            <ion-icon :icon="giftOutline" />
            <ion-label>{{ translate('Gift options') }}</ion-label>
          </ion-chip>
          <ion-chip v-if="!shipGroup.shipAfterDate && !shipGroup.shipByDate" outline @click="openShippingDatesModal">
            <ion-icon :icon="calendarOutline" />
            <ion-label>{{ translate('Shipping dates') }}</ion-label>
          </ion-chip>
          <ion-chip v-if="!shipGroup.estimatedShipDate && !shipGroup.estimatedDeliveryDate" outline @click="openDeliveryDatesModal">
            <ion-icon :icon="calendarOutline" />
            <ion-label>{{ translate('Delivery dates') }}</ion-label>
          </ion-chip>
          <ion-chip v-if="!shipGroup.shippingInstructions" outline @click="openInstructionModal">
            <ion-icon :icon="documentTextOutline" />
            <ion-label>{{ translate('Instruction') }}</ion-label>
          </ion-chip>
        </div>
      </div>
      <!-- shows all the time -->
      <div v-if="hasSelectedOptions" class="ship-group-selected-options">
        <ion-item v-if="shipGroup.giftMessage" button :detail="false" lines="none" :disabled="shipGroup.isSettled" @click="openGiftModal">
          <ion-label>
            <p>{{ translate('Gift message') }}</p>
            {{ shipGroup.giftMessage }}
          </ion-label>
          <ion-button
            v-if="!shipGroup.isSettled"
            slot="end"
            fill="clear"
            color="medium"
            :aria-label="translate('Clear gift message')"
            :title="translate('Clear gift message')"
            @click.stop="clearGiftMessage"
          >
            <ion-icon slot="icon-only" :icon="trashOutline" />
          </ion-button>
        </ion-item>
        <ion-item v-if="shipGroup.shipAfterDate || shipGroup.shipByDate" button :detail="false" lines="none"
          :disabled="shipGroup.isSettled" @click="openShippingDatesModal">
          <ion-label>
            <p class="outline">{{ translate('Ship after') }}</p>
            {{ formatDate(shipGroup.shipAfterDate) }}
          </ion-label>
          <ion-label>
            <p class="outline">{{ translate('Ship by') }}</p>
            {{ formatDate(shipGroup.shipByDate) }}
          </ion-label>
        </ion-item>
        <ion-item v-if="shipGroup.estimatedShipDate || shipGroup.estimatedDeliveryDate" button :detail="false"
          lines="none" :disabled="shipGroup.isSettled" @click="openDeliveryDatesModal">
          <ion-label>
            <p class="outline">{{ translate('Estimated ship date') }}</p>
            {{ formatDate(shipGroup.estimatedShipDate) }}
          </ion-label>
          <ion-label>
            <p class="outline">{{ translate('Estimated delivery date') }}</p>
            {{ formatDate(shipGroup.estimatedDeliveryDate) }}
          </ion-label>
        </ion-item>
        <ion-item v-if="shipGroup.shippingInstructions" button :detail="false" lines="none"
          :disabled="shipGroup.isSettled" @click="openInstructionModal">
          <ion-label>
            <p class="outline">{{ translate('Instructions') }}</p>
            {{ shipGroup.shippingInstructions }}
          </ion-label>
        </ion-item>
      </div>
    </div>

    <!-- shows all the time, except on a counter sale that never brokers, picks,
         packs or ships — every step there would read "Pending" forever -->
    <div v-if="!shipGroup.isPosCompleted" class="ship-group-timeline">
      <ion-item v-for="step in lifecycleSteps" :key="step.label" lines="none">
        <ion-icon slot="start" :icon="step.icon" />
        <ion-label>
          <p class="overline" v-if="step.date">{{ step.overline }}</p>
          {{ translate(step.label) }}
        </ion-label>
        <ion-note slot="end">{{ step.note }}</ion-note>
      </ion-item>
    </div>

    <!-- shows when collapsed; a counter sale has no collapsed state -->
    <div v-if="!shipGroup.isPosCompleted" v-collapsible class="ship-group-summary-container"
      :class="{ 'ship-group-summary-collapsed': expanded }"
      :aria-hidden="expanded"
      :inert="expanded">
      <div class="ship-group-summary-content">
        <ion-list lines="none" :aria-label="translate('Items')">
          <ion-item v-for="item in shipGroup.items.slice(0, 3)" :key="item.orderItemSeqId">
            <ion-thumbnail slot="start" v-image-preview="getProduct(item.productId)" :key="getProduct(item.productId)?.mainImageUrl">
              <DxpShopifyImg :src="item.imageUrl" :key="getProduct(item.productId)?.mainImageUrl" size="small" />
            </ion-thumbnail>
            <ion-label>
              <p class="overline">{{ secondaryIdentifier(item.productId) }}</p>
              <div>
                {{ primaryIdentifier(item.productId) || item.productId }}
                <ion-badge class="kit-badge" color="dark" v-if="isKit(item)">{{ translate("Kit") }}</ion-badge>
              </div>
              <p v-if="featureLabel(item.productId)" class="ship-group-item-features" :title="featureLabel(item.productId)">{{ featureLabel(item.productId) }}</p>
            </ion-label>
            <ion-note slot="end">{{ item.quantity }} {{ translate('units') }}</ion-note>
          </ion-item>
        </ion-list>

        <ion-list lines="none" :aria-label="translate('Fulfillment')">
          <ion-item lines="full">
            <ion-label>
              {{ carrierName || translate('Carrier name') }} {{ methodLabel || translate('Shipping Method Name') }}
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-icon :icon="sendOutline" slot="start" />
            <ion-label v-if="shipGroup.shippingAddress">
              {{ shipGroup.shippingAddress.view.name }}
              <p v-if="shipGroup.shippingAddress.view.street">{{ shipGroup.shippingAddress.view.street }}</p>
              <p v-if="shipGroup.shippingAddress.view.locality">{{ shipGroup.shippingAddress.view.locality }}</p>
            </ion-label>
            <ion-label v-else>{{ translate('Shipping address not available') }}</ion-label>
          </ion-item>
        </ion-list>
      </div>
    </div>

    <!-- shows when expanded; a counter sale has no other state, so it stays open -->
    <div v-collapsible class="ship-group-card-details"
      :class="{ 'ship-group-card-details-expanded': detailsOpen }"
      :aria-hidden="!detailsOpen"
      :inert="!detailsOpen">
      <div class="ship-group-card-details-inner">
        <div class="ship-group-detail-columns">
          <ion-list class="ship-group-items" lines="none">
            <ion-list-header>
              <ion-label>{{ translate('Items') }}</ion-label>
            </ion-list-header>
            <ion-item v-for="item in shipGroup.items" :key="item.orderItemSeqId">
              <!-- Selection only feeds the park / pull back / release actions, which a counter
                   sale and a completed or cancelled order do not have. -->
              <ion-checkbox v-if="!shipGroup.isPosCompleted && !orderIsTerminal" slot="start" :checked="selectedItemIds.includes(item.orderItemSeqId)"
                @ionChange="toggleItem(item.orderItemSeqId, $event.detail.checked)" />
              <ion-thumbnail slot="start" v-image-preview="getProduct(item.productId)" :key="getProduct(item.productId)?.mainImageUrl">
                <DxpShopifyImg :src="item.imageUrl" :key="getProduct(item.productId)?.mainImageUrl" size="small" />
              </ion-thumbnail>
              <ion-label>
                <div>
                  {{ primaryIdentifier(item.productId) || item.productId }}
                  <ion-badge class="kit-badge" color="dark" v-if="isKit(item)">{{ translate("Kit") }}</ion-badge>
                </div>
                <p>{{ secondaryIdentifier(item.productId) }}</p>
                <!-- The collapsed summary above carries the same line, but a counter sale
                     has no collapsed state and an expanded group hides it, so the variant
                     has to be named here too. -->
                <p v-if="featureLabel(item.productId)" class="ship-group-item-features" :title="featureLabel(item.productId)">{{ featureLabel(item.productId) }}</p>
              </ion-label>

              <!-- Inventory lookup answers "can we still fulfil this?"; the goods have
                   already left the store. What matters instead is whether the stock
                   they left with came off the books. -->
              <ion-button v-if="!shipGroup.isPosCompleted" slot="end" fill="clear" color="medium" @click.stop="emit('view-inventory', item.productId)" :aria-label="translate('View inventory')" :title="translate('View inventory')">
                <ion-icon slot="icon-only" :icon="cubeOutline" />
              </ion-button>
              <div v-else-if="item.issuance" slot="end" class="ship-group-item-issuance">
                <ion-badge :color="item.issuance.tone">
                  {{ translate(ISSUANCE_LABELS[item.issuance.kind]) }}
                </ion-badge>
                <!-- Stock at the store as the sale was recorded, not stock now: later
                     movements against the same inventory item are not reflected here. -->
                <ion-note v-if="item.issuance.kind === 'issued'">
                  {{ translate('On hand at sale') }} {{ item.issuance.qohBefore }} → {{ item.issuance.qohAfter }}
                </ion-note>
              </div>
            </ion-item>
          </ion-list>

          <!-- Nothing here applies to a counter sale: the carrier is _NA_, the method
               cannot be changed once the goods have left with the customer, and there
               is no ship-to address to show or edit. -->
          <ion-list v-if="!shipGroup.isPosCompleted" class="ship-group-fulfillment" lines="none">
            <ion-list-header>
              <ion-label>{{ translate('Fulfillment') }}</ion-label>
            </ion-list-header>
            <ion-item lines="full">
              <ion-select :label="translate('Carrier')" interface="popover"
                :placeholder="translate('Select Carrier')"
                :disabled="disabledActions.EDIT_CARRIER_METHOD"
                :value="carrierId"
                @ionChange="onCarrierChange($event.detail.value)">
                <ion-select-option v-for="carrier in carriers" :key="carrier.partyId" :value="carrier.partyId">
                  {{ partyName(carrier) }}
                </ion-select-option>
              </ion-select>
            </ion-item>

            <ion-item lines="full">
              <ion-select :label="translate('Shipping method')" interface="popover"
                :placeholder="translate('Select Shipping Method')"
                :disabled="disabledActions.EDIT_CARRIER_METHOD"
                :value="methodId || undefined"
                @ionChange="onMethodChange($event.detail.value)">
                <ion-select-option v-for="method in carrierMethods" :key="method.shipmentMethodTypeId" :value="method.shipmentMethodTypeId">
                  {{ seed.shipmentMethodDescription(method.shipmentMethodTypeId) }}
                </ion-select-option>
              </ion-select>
            </ion-item>

            <ion-item>
              <ion-icon :icon="sendOutline" slot="start" />
              <ion-label>
                <template v-if="shipGroup.shippingAddress?.lines.length">
                  <div v-for="(line, idx) in shipGroup.shippingAddress.lines" :key="idx">{{ line }}</div>
                </template>
                <div v-else>{{ translate('Shipping address not available') }}</div>
              </ion-label>
              <p slot="end" v-if="!shipGroup.isVirtual && distance">
                {{ distance }} {{ translate('miles') }}
              </p>
              <ion-button v-if="!disabledActions.EDIT_ADDRESS" slot="end" fill="clear"
                color="medium" :id="'shipping-opt-trigger-' + shipGroup.id"
                :aria-label="translate('Shipping options')"
                :title="translate('Shipping options')">
                <ion-icon slot="icon-only" :icon="ellipsisVertical" />
              </ion-button>
              <ion-popover :trigger="'shipping-opt-trigger-' + shipGroup.id" dismiss-on-select
                show-backdrop="false">
                <ion-content>
                  <ion-list>
                    <ion-list-header>{{ translate("Shipping address") }}</ion-list-header>
                    <ion-item button :detail="false" :disabled="disabledActions.EDIT_ADDRESS" @click="openEditShippingAddress">
                      <ion-icon :icon="createOutline" slot="end" />
                      {{ translate('Edit') }}
                    </ion-item>
                  </ion-list>
                </ion-content>
              </ion-popover>
            </ion-item>

            <!-- Edit shipping address modal -->
            <ion-modal :is-open="editor === 'address'" @didDismiss="closeEditor('address')">
              <ion-header>
                <ion-toolbar>
                  <ion-buttons slot="start">
                    <ion-button @click="closeEditor('address')" :aria-label="translate('Close')" :title="translate('Close')"><ion-icon slot="icon-only"
                        :icon="closeOutline" /></ion-button>
                  </ion-buttons>
                  <ion-title>{{ translate('Edit Shipping Address') }}</ion-title>
                  <ion-buttons slot="end">
                  </ion-buttons>
                </ion-toolbar>
              </ion-header>
              <ion-content class="ion-padding">
                <ion-list>
                  <ion-item>
                    <ion-input :label="translate('Address line 1')" label-placement="stacked"
                      :placeholder="translate('Street address')" v-model="shippingAddressForm.address1" />
                  </ion-item>
                  <ion-item>
                    <ion-input :label="translate('Address line 2')" label-placement="stacked"
                      :placeholder="translate('Apt, suite, etc.')" v-model="shippingAddressForm.address2" />
                  </ion-item>
                  <ion-item>
                    <ion-input :label="translate('City')" label-placement="stacked"
                      :placeholder="translate('City')" v-model="shippingAddressForm.city" />
                  </ion-item>
                  <ion-item>
                    <ion-input :label="translate('Postal code')" label-placement="stacked"
                      :placeholder="translate('Postal code')" v-model="shippingAddressForm.postalCode" />
                  </ion-item>
                  <ion-item>
                    <ion-select :label="translate('Country')" label-placement="stacked" interface="popover"
                      :placeholder="translate('Select Country')" v-model="shippingAddressForm.countryGeoId"
                      @ionChange="shippingAddressForm.stateProvinceGeoId = ''">
                      <ion-select-option v-for="country in seed.getCountries" :key="country.geoId" :value="country.geoId">
                        {{ country.geoName }}
                      </ion-select-option>
                    </ion-select>
                  </ion-item>
                  <ion-item>
                    <ion-select :label="translate('State / Province')" label-placement="stacked"
                      interface="popover" :placeholder="translate('Select State / Province')"
                      :disabled="!shippingAddressForm.countryGeoId"
                      v-model="shippingAddressForm.stateProvinceGeoId">
                      <ion-select-option v-for="state in seed.getStates" :key="state.geoId" :value="state.geoId">
                        {{ state.geoName }}
                      </ion-select-option>
                    </ion-select>
                  </ion-item>
                </ion-list>
                <ion-fab vertical="bottom" horizontal="end" slot="fixed">
                  <ion-fab-button :disabled="saving" @click="saveShippingAddress" :aria-label="translate('Save')">
                    <ion-icon :icon="saveOutline" />
                  </ion-fab-button>
                </ion-fab>
              </ion-content>
            </ion-modal>
          </ion-list>
        </div>
      </div>
    </div>

    <div class="ship-group-actions">
      <!-- Broker, release, park and pull back all move a group through fulfillment, in
           the order a group travels them. A counter sale has none left, so only the
           order-level actions remain. -->
      <template v-if="!shipGroup.isPosCompleted">
        <template v-if="shipGroup.isVirtual">
          <ion-button fill="clear" :disabled="disabledActions.BROKER" @click="emit('broker')">{{ translate('Broker') }}</ion-button>
          <ion-button fill="clear" :disabled="disabledActions.RELEASE" @click="emit('release')">{{ translate('Release') }}</ion-button>
          <ion-button fill="clear" :disabled="disabledActions.PARK_ITEMS" @click="emit('park')">{{ translate('Park') }}</ion-button>
        </template>
        <template v-else>
          <ion-button fill="clear" :disabled="disabledActions.PULL_BACK" @click="emit('pull-back')">{{ translate('Pull back') }}</ion-button>
          <ion-button v-if="canRequestInventoryTransfer" fill="clear" :disabled="!hasTransferableItems"
            @click="emit('request-transfer')">{{ translate('Request transfer') }}</ion-button>
        </template>
      </template>
      <ion-button fill="clear" :disabled="disabledActions.ADD_TASK" @click="emit('add-task')">{{ translate('Add Task') }}</ion-button>
      <ion-button v-if="!orderIsTerminal" fill="clear"
        :disabled="disabledActions.ADD_ITEMS" @click="emit('add-items')">{{ translate('Add Items') }}</ion-button>
    </div>

    <!-- Gift message modal -->
    <ion-modal :is-open="editor === 'gift'" @didDismiss="closeEditor('gift')">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start"><ion-button @click="closeEditor('gift')" :aria-label="translate('Close')" :title="translate('Close')"><ion-icon slot="icon-only"
                :icon="closeOutline" /></ion-button></ion-buttons>
          <ion-title>{{ translate('Gift message') }}</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <ion-item>
          <ion-textarea :label="translate('Gift message')" label-placement="stacked" :rows="4"
            :placeholder="translate('Enter gift message')" v-model="giftMessageDraft" />
        </ion-item>
        <ion-fab vertical="bottom" horizontal="end" slot="fixed">
          <ion-fab-button :disabled="saving" @click="saveGiftMessage" :aria-label="translate('Save')">
            <ion-icon :icon="saveOutline" />
          </ion-fab-button>
        </ion-fab>
      </ion-content>
    </ion-modal>

    <!-- Shipping dates modal -->
    <ion-modal :is-open="editor === 'shippingDates'" @didDismiss="closeEditor('shippingDates')">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start"><ion-button @click="closeEditor('shippingDates')" :aria-label="translate('Close')" :title="translate('Close')"><ion-icon
                slot="icon-only" :icon="closeOutline" /></ion-button></ion-buttons>
          <ion-title>{{ translate('Shipping dates') }}</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <ion-item>
          <ion-input :label="translate('Ship after')" label-placement="stacked" type="date"
            v-model="shippingDatesDraft.shipAfterDate" />
        </ion-item>
        <ion-item>
          <ion-input :label="translate('Ship by')" label-placement="stacked" type="date"
            v-model="shippingDatesDraft.shipByDate" />
        </ion-item>
        <ion-fab vertical="bottom" horizontal="end" slot="fixed">
          <ion-fab-button :disabled="saving" @click="saveShippingDates" :aria-label="translate('Save')">
            <ion-icon :icon="saveOutline" />
          </ion-fab-button>
        </ion-fab>
      </ion-content>
    </ion-modal>

    <!-- Delivery dates modal -->
    <ion-modal :is-open="editor === 'deliveryDates'" @didDismiss="closeEditor('deliveryDates')">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start"><ion-button @click="closeEditor('deliveryDates')" :aria-label="translate('Close')" :title="translate('Close')"><ion-icon
                slot="icon-only" :icon="closeOutline" /></ion-button></ion-buttons>
          <ion-title>{{ translate('Delivery dates') }}</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <ion-item>
          <ion-input :label="translate('Estimated ship date')" label-placement="stacked" type="date"
            v-model="deliveryDatesDraft.estimatedShipDate" />
        </ion-item>
        <ion-item>
          <ion-input :label="translate('Estimated delivery date')" label-placement="stacked" type="date"
            v-model="deliveryDatesDraft.estimatedDeliveryDate" />
        </ion-item>
        <ion-fab vertical="bottom" horizontal="end" slot="fixed">
          <ion-fab-button :disabled="saving" @click="saveDeliveryDates" :aria-label="translate('Save')">
            <ion-icon :icon="saveOutline" />
          </ion-fab-button>
        </ion-fab>
      </ion-content>
    </ion-modal>

    <!-- Instruction modal -->
    <ion-modal :is-open="editor === 'instructions'" @didDismiss="closeEditor('instructions')">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start"><ion-button @click="closeEditor('instructions')" :aria-label="translate('Close')" :title="translate('Close')"><ion-icon
                slot="icon-only" :icon="closeOutline" /></ion-button></ion-buttons>
          <ion-title>{{ translate('Shipping instructions') }}</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <ion-item>
          <ion-textarea :label="translate('Instructions')" label-placement="stacked" :rows="4"
            :placeholder="translate('Enter shipping instructions')" v-model="instructionDraft" />
        </ion-item>
        <ion-fab vertical="bottom" horizontal="end" slot="fixed">
          <ion-fab-button :disabled="saving" @click="saveInstruction" :aria-label="translate('Save')">
            <ion-icon :icon="saveOutline" />
          </ion-fab-button>
        </ion-fab>
      </ion-content>
    </ion-modal>
  </ion-card>
</template>

<script setup lang="ts">
import { computed, ref, watch, type Directive } from 'vue';
import {
  IonBadge, IonButton, IonButtons, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonCheckbox, IonChip, IonContent,
  IonFab, IonFabButton, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonModal, IonNote, IonPopover,
  IonProgressBar, IonSelect, IonSelectOption, IonTextarea, IonThumbnail, IonTitle, IonToolbar,
} from '@ionic/vue';
import {
  calendarOutline, chevronDown, chevronUp, closeOutline, compassOutline, createOutline, cubeOutline, documentTextOutline,
  ellipsisVertical, giftOutline, mailOutline, saveOutline, sendOutline, trashOutline, warningOutline,
} from 'ionicons/icons';
import { commonUtil, DxpShopifyImg, translate } from '@common';
import { useProductIdentity } from '@/composables/useProductIdentity';
import { useOrderDetailStore } from '@/store/orderDetail';
import { useSeedStore } from '@/store/seed';
import { isKit } from '@/utils';
import { findTimeDiff, formatDate, formatTime, toDateInputValue } from '@/utils/orderDetailDates';
import { OrderActionValidator, type ShipGroupActionId } from '@/utils/OrderActionValidator';
import type { EnrichedShipGroup, ItemIssuance, ShipGroupAddressEdit, ShipGroupEditor, ShipGroupFieldsEdit } from '@/types/orderDetail';

const props = defineProps<{
  shipGroup: EnrichedShipGroup;
  orderId: string;
  orderStatusId: string;
  expanded: boolean;
  /** This group's checked items; the selection narrows its release / park / pull back actions. */
  selectedItemIds: string[];
  holdTaskCount: number;
  distance?: string;
  carriers: any[];
  /** Which ship group actions the page's validator refuses for the current selection. */
  disabledActions: Partial<Record<ShipGroupActionId, boolean>>;
  canRequestInventoryTransfer: boolean;
  hasTransferableItems: boolean;
  /** The inline editor that is open. The page closes it once a save succeeds. */
  editor: ShipGroupEditor | null;
  /** A save from this card is in flight. */
  saving: boolean;
}>();

const emit = defineEmits<{
  'update:expanded': [expanded: boolean];
  'update:selectedItemIds': [ids: string[]];
  'show-holds': [];
  broker: [];
  release: [];
  park: [];
  'pull-back': [];
  'request-transfer': [];
  'add-task': [];
  'add-items': [];
  'view-inventory': [productId: string];
  'change-carrier-method': [carrierPartyId: string, shipmentMethodTypeId: string];
  'update:editor': [editor: ShipGroupEditor | null];
  'save-fields': [edit: ShipGroupFieldsEdit];
  'save-address': [address: ShipGroupAddressEdit];
}>();

const seed = useSeedStore();
const orderDetailStore = useOrderDetailStore();
const { getProduct, primaryIdentifier, secondaryIdentifier, featureLabel } = useProductIdentity();

const ISSUANCE_LABELS: Record<ItemIssuance['kind'], string> = {
  none: 'Inventory not issued',
  partial: 'Inventory partly issued',
  issued: 'Inventory issued',
};

const LIFECYCLE_STEPS = [
  { label: 'Brokered', field: 'firstBrokeredDate', icon: compassOutline },
  { label: 'Pick', field: 'picklistDate', icon: mailOutline },
  { label: 'Pack', field: 'packedDate', icon: cubeOutline },
  { label: 'Ship', field: 'shippedDate', icon: sendOutline },
];

/** Whether the item detail block is showing — always, for a counter sale with no toggle. */
const detailsOpen = computed(() => props.shipGroup.isPosCompleted || props.expanded);
const orderIsTerminal = computed(() => OrderActionValidator.isOrderTerminal({ statusId: props.orderStatusId }));

/** A stopped group is read-only: its options describe a shipment that will no longer change. */
const optionsOpen = computed(() => {
  const sg = props.shipGroup;
  const hasSelectableOptions = !sg.isSettled && (!sg.giftMessage
    || (!sg.shipAfterDate && !sg.shipByDate)
    || (!sg.estimatedShipDate && !sg.estimatedDeliveryDate)
    || !sg.shippingInstructions);
  return hasSelectableOptions && props.expanded;
});

const hasSelectedOptions = computed(() => {
  const sg = props.shipGroup;
  return Boolean(sg.giftMessage || sg.shipAfterDate || sg.shipByDate || sg.estimatedShipDate || sg.estimatedDeliveryDate || sg.shippingInstructions);
});

/**
 * The brokered → pick → pack → ship strip. A completed step's overline shows its age from now
 * for the first one, and the time since the nearest earlier completed step after that, so the
 * strip reads as per-step durations (#350). A step without a date is either still to come
 * ("Pending") or behind us and simply not recorded ("No date").
 */
const lifecycleSteps = computed(() => {
  const { lifecycle, isBrokered, isSettled } = props.shipGroup;
  return LIFECYCLE_STEPS.map((step, index) => {
    const date = lifecycle[step.field];
    const previous = LIFECYCLE_STEPS.slice(0, index).map((earlier) => lifecycle[earlier.field]).filter(Boolean).pop();
    const recorded = step.field === 'firstBrokeredDate' ? isBrokered || isSettled : isSettled;
    return {
      ...step,
      date,
      overline: date ? (previous ? findTimeDiff(previous, date) : commonUtil.getRelativeTime(date)) : '',
      note: formatTime(date) || (recorded ? translate('No date') : translate('Pending')),
    };
  });
});

function toggleItem(orderItemSeqId: string, checked: boolean) {
  const ids = props.selectedItemIds.filter((id) => id !== orderItemSeqId);
  emit('update:selectedItemIds', checked ? [...ids, orderItemSeqId] : ids);
}

/* ── Carrier and shipping method ──────────────────────────────────────── */

// Local selection so the method list follows a carrier change at once; reset whenever the saved
// carrier or method changes (e.g. after a save and reload).
const carrierId = ref('');
const methodId = ref('');
watch(() => [props.shipGroup.carrierPartyId, props.shipGroup.shipmentMethodTypeId], ([carrierPartyId, shipmentMethodTypeId]) => {
  carrierId.value = carrierPartyId ?? '';
  methodId.value = shipmentMethodTypeId ?? '';
}, { immediate: true });

const partyName = (party: any) => [party.firstName, party.lastName].filter(Boolean).join(' ') || party.groupName || party.partyId;
const carrierName = computed(() => {
  const carrier = props.carriers.find((party: any) => party.partyId === carrierId.value);
  return carrier ? partyName(carrier) : '';
});
const methodLabel = computed(() => methodId.value ? seed.shipmentMethodDescription(methodId.value) : '');
const carrierMethods = computed(() => [...orderDetailStore.shippingMethodsByCarrier(carrierId.value)]
  .sort((a, b) => Number(a.sequenceNumber ?? Infinity) - Number(b.sequenceNumber ?? Infinity)));

function onCarrierChange(carrierPartyId: string) {
  // The method resets to empty (placeholder) until one of the new carrier's methods is picked.
  carrierId.value = carrierPartyId;
  methodId.value = '';
}

function onMethodChange(shipmentMethodTypeId: string) {
  if (!carrierId.value || !shipmentMethodTypeId) return;
  methodId.value = shipmentMethodTypeId;
  emit('change-carrier-method', carrierId.value, shipmentMethodTypeId);
}

/* ── Inline edits ─────────────────────────────────────────────────────── */

function openEditor(editor: ShipGroupEditor) {
  emit('update:editor', editor);
}

/** Closes the editor only if it is still the open one, so a late dismiss cannot close the next. */
function closeEditor(editor: ShipGroupEditor) {
  if (props.editor === editor) emit('update:editor', null);
}

const saveFields = (fields: Record<string, any>, success: string, failure: string) => emit('save-fields', { fields, success, failure });

const giftMessageDraft = ref('');
function openGiftModal() {
  giftMessageDraft.value = props.shipGroup.giftMessage ?? '';
  openEditor('gift');
}
const saveGiftMessage = () => saveFields({ giftMessage: giftMessageDraft.value }, 'Gift message saved.', 'Failed to save gift message.');
const clearGiftMessage = () => saveFields({ giftMessage: null }, 'Gift message cleared.', 'Failed to clear gift message.');

const shippingDatesDraft = ref({ shipAfterDate: '', shipByDate: '' });
function openShippingDatesModal() {
  shippingDatesDraft.value = {
    shipAfterDate: toDateInputValue(props.shipGroup.shipAfterDate),
    shipByDate: toDateInputValue(props.shipGroup.shipByDate),
  };
  openEditor('shippingDates');
}
const saveShippingDates = () => saveFields({
  shipAfterDate: shippingDatesDraft.value.shipAfterDate || null,
  shipByDate: shippingDatesDraft.value.shipByDate || null,
}, 'Shipping dates saved.', 'Failed to save shipping dates.');

const deliveryDatesDraft = ref({ estimatedShipDate: '', estimatedDeliveryDate: '' });
function openDeliveryDatesModal() {
  deliveryDatesDraft.value = {
    estimatedShipDate: toDateInputValue(props.shipGroup.estimatedShipDate),
    estimatedDeliveryDate: toDateInputValue(props.shipGroup.estimatedDeliveryDate),
  };
  openEditor('deliveryDates');
}
const saveDeliveryDates = () => saveFields({
  estimatedShipDate: deliveryDatesDraft.value.estimatedShipDate || null,
  estimatedDeliveryDate: deliveryDatesDraft.value.estimatedDeliveryDate || null,
}, 'Delivery dates saved.', 'Failed to save delivery dates.');

const instructionDraft = ref('');
function openInstructionModal() {
  instructionDraft.value = props.shipGroup.shippingInstructions ?? '';
  openEditor('instructions');
}
const saveInstruction = () => saveFields({ shippingInstructions: instructionDraft.value }, 'Instructions saved.', 'Failed to save instructions.');

const shippingAddressForm = ref<ShipGroupAddressEdit>({ address1: '', address2: '', city: '', postalCode: '', stateProvinceGeoId: '', countryGeoId: '' });
function openEditShippingAddress() {
  const addr = props.shipGroup.shippingAddress?.postalAddress ?? {};
  shippingAddressForm.value = {
    address1: addr.address1 ?? '',
    address2: addr.address2 ?? '',
    city: addr.city ?? '',
    postalCode: addr.postalCode ?? '',
    stateProvinceGeoId: addr.stateProvinceGeoId ?? '',
    countryGeoId: addr.countryGeoId ?? '',
  };
  openEditor('address');
}
const saveShippingAddress = () => emit('save-address', { ...shippingAddressForm.value });

/* ── Collapsible height ───────────────────────────────────────────────── */

// Expanding and collapsing animate max-height (theme/work-card.css), which needs the content's
// real height; keep it in a CSS variable as the content resizes.
const collapsibleObservers = new WeakMap<HTMLElement, ResizeObserver>();

function updateCollapsibleHeight(el: HTMLElement) {
  const update = () => el.style.setProperty('--ship-group-collapsible-height', `${el.scrollHeight}px`);
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(update);
  else update();
}

const vCollapsible: Directive<HTMLElement> = {
  mounted(el) {
    updateCollapsibleHeight(el);
    // Test environments (jsdom) have no ResizeObserver; the height is then set once, on mount.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => updateCollapsibleHeight(el));
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    collapsibleObservers.set(el, observer);
  },
  updated: updateCollapsibleHeight,
  unmounted(el) {
    collapsibleObservers.get(el)?.disconnect();
    collapsibleObservers.delete(el);
  },
};
</script>

<style scoped src="./orderDetailCardHeader.css"></style>

<style scoped>
/* A variant can carry many feature values — an e-gift card lists every denomination — and the
   identity column is narrow. Keep features to one line and put the full value on hover. */
.ship-group-item-features {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
