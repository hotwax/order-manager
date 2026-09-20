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
        <p>{{ shipGroupStatusLabel(shipGroup) }}</p>
        <!-- A counter sale has one state, so there is nothing to expand into. -->
        <ion-button v-if="!isPosCompleted(shipGroup)" fill="clear" color="medium" @click="toggleShipGroup(shipGroup.id)" :aria-label="translate('Toggle ship group')">
          <ion-icon slot="icon-only" :icon="isShipGroupExpanded(shipGroup.id) ? chevronUp : chevronDown" />
        </ion-button>
      </div>
    </div>

    <ion-progress-bar :value="shipGroupProgress(shipGroup)"
      :color="shipGroupProgress(shipGroup) === 1 ? 'success' : 'primary'" />

    <ion-item v-if="shipGroupHoldTaskCount(shipGroup)" color="warning" lines="none">
      <ion-icon slot="start" :icon="warningOutline" />
      <ion-label>{{ shipGroupHoldTaskLabel(shipGroup) }}</ion-label>
      <ion-button slot="end" fill="solid" color="dark" size="small" @click="showShipGroupHoldTask">
        {{ translate('View details') }}
      </ion-button>
    </ion-item>

    <!-- Gift, shipping date, delivery date and instruction options all describe a
         shipment that will happen; a counter sale has already happened. -->
    <div v-if="!isPosCompleted(shipGroup)" class="ship-group-options-wrapper">
      <!-- shows when expanded -->
      <div v-collapsible class="ship-group-expanded-options"
        :class="{ 'ship-group-expanded-options-open': hasSelectableShipGroupOptions(shipGroup) && isShipGroupExpanded(shipGroup.id) }"
        :aria-hidden="!(hasSelectableShipGroupOptions(shipGroup) && isShipGroupExpanded(shipGroup.id))"
        :inert="hasSelectableShipGroupOptions(shipGroup) && isShipGroupExpanded(shipGroup.id) ? undefined : ''">
        <div class="ship-group-options">
          <ion-chip v-if="!shipGroup.giftMessage" outline @click="openGiftModal(shipGroup)">
            <ion-icon :icon="giftOutline" />
            <ion-label>{{ translate('Gift options') }}</ion-label>
          </ion-chip>
          <ion-chip v-if="!shipGroup.shipAfterDate && !shipGroup.shipByDate" outline
            @click="openShippingDatesModal(shipGroup)">
            <ion-icon :icon="calendarOutline" />
            <ion-label>{{ translate('Shipping dates') }}</ion-label>
          </ion-chip>
          <ion-chip v-if="!shipGroup.estimatedShipDate && !shipGroup.estimatedDeliveryDate" outline
            @click="openDeliveryDatesModal(shipGroup)">
            <ion-icon :icon="calendarOutline" />
            <ion-label>{{ translate('Delivery dates') }}</ion-label>
          </ion-chip>
          <ion-chip v-if="!shipGroup.shippingInstructions" outline @click="openInstructionModal(shipGroup)">
            <ion-icon :icon="documentTextOutline" />
            <ion-label>{{ translate('Instruction') }}</ion-label>
          </ion-chip>
        </div>
      </div>
      <!-- shows all the time -->
      <div v-if="hasSelectedShipGroupOptions(shipGroup)"
        class="ship-group-selected-options">
        <ion-item v-if="shipGroup.giftMessage" button detail="false" lines="none"
          :disabled="isShipGroupReadOnly(shipGroup)" @click="openGiftModal(shipGroup)">
          <ion-label>
            <p>{{ translate('Gift message') }}</p>
            {{ shipGroup.giftMessage }}
          </ion-label>
          <ion-button
            v-if="!isShipGroupReadOnly(shipGroup)"
            slot="end"
            fill="clear"
            color="medium"
            :aria-label="translate('Clear gift message')"
            @click.stop="clearGiftMessage(shipGroup)"
          >
            <ion-icon slot="icon-only" :icon="trashOutline" />
          </ion-button>
        </ion-item>
        <ion-item v-if="shipGroup.shipAfterDate || shipGroup.shipByDate" button detail="false" lines="none"
          :disabled="isShipGroupReadOnly(shipGroup)" @click="openShippingDatesModal(shipGroup)">
          <ion-label>
            <p class="outline">{{ translate('Ship after') }}</p>
            {{ formatDate(shipGroup.shipAfterDate) }}
          </ion-label>
          <ion-label>
            <p class="outline">{{ translate('Ship by') }}</p>
            {{ formatDate(shipGroup.shipByDate) }}
          </ion-label>
        </ion-item>
        <ion-item v-if="shipGroup.estimatedShipDate || shipGroup.estimatedDeliveryDate" button detail="false"
          lines="none" :disabled="isShipGroupReadOnly(shipGroup)" @click="openDeliveryDatesModal(shipGroup)">
          <ion-label>
            <p class="outline">{{ translate('Estimated ship date') }}</p>
            {{ formatDate(shipGroup.estimatedShipDate) }}
          </ion-label>
          <ion-label>
            <p class="outline">{{ translate('Estimated delivery date') }}</p>
            {{ formatDate(shipGroup.estimatedDeliveryDate) }}
          </ion-label>
        </ion-item>
        <ion-item v-if="shipGroup.shippingInstructions" button detail="false" lines="none"
          :disabled="isShipGroupReadOnly(shipGroup)" @click="openInstructionModal(shipGroup)">
          <ion-label>
            <p class="outline">{{ translate('Instructions') }}</p>
            {{ shipGroup.shippingInstructions }}
          </ion-label>
        </ion-item>
      </div>
    </div>

    <!-- shows all the time, except on a counter sale that never brokers, picks,
         packs or ships — every step there would read "Pending" forever -->
    <div v-if="!isPosCompleted(shipGroup)" class="ship-group-timeline">
      <ion-item lines="none">
        <ion-icon slot="start" :icon="compassOutline" />
        <ion-label>
          <p class="overline" v-if="lifecycleByShipGroup[shipGroup.id]?.firstBrokeredDate">{{
            lifecycleStepLabel(lifecycleByShipGroup[shipGroup.id], 'brokered') }}</p>
          {{ translate('Brokered') }}
        </ion-label>
        <ion-note slot="end">{{ brokeredStepNote(shipGroup) }}</ion-note>
      </ion-item>
      <ion-item lines="none">
        <ion-icon slot="start" :icon="mailOutline" />
        <ion-label>
          <p class="overline" v-if="lifecycleByShipGroup[shipGroup.id]?.picklistDate">{{
            lifecycleStepLabel(lifecycleByShipGroup[shipGroup.id], 'pick') }}</p>
          {{ translate('Pick') }}
        </ion-label>
        <ion-note slot="end">{{ lifecycleStepNote(shipGroup, lifecycleByShipGroup[shipGroup.id]?.picklistDate) }}</ion-note>
      </ion-item>
      <ion-item lines="none">
        <ion-icon slot="start" :icon="cubeOutline" />
        <ion-label>
          <p class="overline" v-if="lifecycleByShipGroup[shipGroup.id]?.packedDate">{{
            lifecycleStepLabel(lifecycleByShipGroup[shipGroup.id], 'pack') }}</p>
          {{ translate('Pack') }}
        </ion-label>
        <ion-note slot="end">{{ lifecycleStepNote(shipGroup, lifecycleByShipGroup[shipGroup.id]?.packedDate) }}</ion-note>
      </ion-item>
      <ion-item lines="none">
        <ion-icon slot="start" :icon="sendOutline" />
        <ion-label>
          <p class="overline" v-if="lifecycleByShipGroup[shipGroup.id]?.shippedDate">{{
            lifecycleStepLabel(lifecycleByShipGroup[shipGroup.id], 'ship') }}</p>
          {{ translate('Ship') }}
        </ion-label>
        <ion-note slot="end">{{ lifecycleStepNote(shipGroup, lifecycleByShipGroup[shipGroup.id]?.shippedDate) }}</ion-note>
      </ion-item>
    </div>

    <!-- shows when collapsed; a counter sale has no collapsed state -->
    <div v-if="!isPosCompleted(shipGroup)" v-collapsible class="ship-group-summary-container"
      :class="{ 'ship-group-summary-collapsed': isShipGroupExpanded(shipGroup.id) }"
      :aria-hidden="isShipGroupExpanded(shipGroup.id)"
      :inert="isShipGroupExpanded(shipGroup.id) ? '' : undefined">
      <div class="ship-group-summary-content">
        <ion-list lines="none" :aria-label="translate('Items')">
          <ion-item v-for="item in shipGroupPreviewItems(shipGroup)" :key="item.id">
            <ion-thumbnail slot="start" v-image-preview="getProduct(item.productId)"
              :key="getProduct(item.productId)?.mainImageUrl">
              <DxpShopifyImg :src="item?.imageUrl" :key="getProduct(item.productId)?.mainImageUrl" size="small" />
            </ion-thumbnail>
            <ion-label>
              <p class="overline">{{ shipGroupProductIdentification(productIdentificationPref.secondaryId, item)
                }}</p>
              <div>
                {{ shipGroupProductIdentification(productIdentificationPref.primaryId, item) || item.productId }}
                <ion-badge class="kit-badge" color="dark" v-if="isKit(item)">{{ translate("Kit") }}</ion-badge>
              </div>
              <p v-if="productFeatureLabel(item.productId)" class="ship-group-item-features"
                :title="productFeatureLabel(item.productId)">{{ productFeatureLabel(item.productId) }}</p>
            </ion-label>
            <ion-note slot="end">{{ item.quantity }} {{ translate('units') }}</ion-note>
          </ion-item>
        </ion-list>

        <ion-list lines="none" :aria-label="translate('Fulfillment')">
          <ion-item lines="full">
            <ion-label>
              {{ carrierName(getSelection(shipGroup.id, shipGroup).carrierId) || translate('Carrier name') }} {{
                shippingMethodLabel(getSelection(shipGroup.id, shipGroup).methodId) || translate('Shipping Method Name') }}
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-icon :icon="sendOutline" slot="start" />
            <ion-label v-if="shippingAddressView(shipGroup)">
              {{ shippingAddressView(shipGroup)?.name }}
              <p v-if="shippingAddressView(shipGroup)?.street">{{ shippingAddressView(shipGroup)?.street }}</p>
              <p v-if="shippingAddressView(shipGroup)?.locality">{{ shippingAddressView(shipGroup)?.locality }}</p>
            </ion-label>
            <ion-label v-else>{{ translate('Shipping address not available') }}</ion-label>
          </ion-item>
        </ion-list>
      </div>
    </div>

    <!-- shows when expanded; a counter sale has no other state, so it stays open -->
    <div v-collapsible class="ship-group-card-details"
      :class="{ 'ship-group-card-details-expanded': isShipGroupDetailsOpen(shipGroup) }"
      :aria-hidden="!isShipGroupDetailsOpen(shipGroup)"
      :inert="isShipGroupDetailsOpen(shipGroup) ? undefined : ''">
      <div class="ship-group-card-details-inner">
        <div class="ship-group-detail-columns">
          <ion-list class="ship-group-items" lines="none">
          <ion-list-header>
            <ion-label>{{ translate('Items') }}</ion-label>
          </ion-list-header>
          <ion-item v-for="item in shipGroup.items" :key="item.id">
            <!-- Selection only feeds the pull back / release actions, which a counter
                 sale does not have. -->
            <ion-checkbox v-if="!isPosCompleted(shipGroup)" slot="start" :checked="isItemSelected(shipGroup.id, item.id)"
              @ionChange="toggleItemSelection(shipGroup.id, item.id, $event.detail.checked)" />
            <ion-thumbnail slot="start" v-image-preview="getProduct(item.productId)"
              :key="getProduct(item.productId)?.mainImageUrl">
              <DxpShopifyImg :src="item?.imageUrl" :key="getProduct(item.productId)?.mainImageUrl"
                size="small" />
            </ion-thumbnail>
            <ion-label>
              <div>
                {{ shipGroupProductIdentification(productIdentificationPref.primaryId, item) || item.productId
                }}
                <ion-badge class="kit-badge" color="dark" v-if="isKit(item)">{{ translate("Kit") }}</ion-badge>
              </div>
              <p>{{ shipGroupProductIdentification(productIdentificationPref.secondaryId, item) }}</p>
              <!-- The collapsed summary above carries the same line, but a counter sale
                   has no collapsed state and an expanded group hides it, so the variant
                   has to be named here too. -->
              <p v-if="productFeatureLabel(item.productId)" class="ship-group-item-features"
                :title="productFeatureLabel(item.productId)">{{ productFeatureLabel(item.productId) }}</p>
            </ion-label>

            <!-- Inventory lookup answers "can we still fulfil this?"; the goods have
                 already left the store. What matters instead is whether the stock
                 they left with came off the books. -->
            <ion-button v-if="!isPosCompleted(shipGroup)" slot="end" fill="clear" color="medium" @click.stop="viewInventory(item.productId)" :aria-label="translate('View inventory')">
              <ion-icon slot="icon-only" :icon="cubeOutline" />
            </ion-button>
            <div v-else-if="itemIssuanceBadges[item.id]" slot="end" class="ship-group-item-issuance">
              <ion-badge :color="itemIssuanceBadges[item.id].tone">
                {{ translate(itemIssuanceBadges[item.id].label) }}
              </ion-badge>
              <!-- Stock at the store as the sale was recorded, not stock now: later
                   movements against the same inventory item are not reflected here. -->
              <ion-note v-if="itemIssuanceBadges[item.id].label === 'Inventory issued'">
                {{ translate('On hand at sale') }} {{ itemIssuanceBadges[item.id].qohBefore }} → {{ itemIssuanceBadges[item.id].qohAfter }}
              </ion-note>
            </div>
          </ion-item>
          </ion-list>

          <!-- Nothing here applies to a counter sale: the carrier is _NA_, the method
               cannot be changed once the goods have left with the customer, and there
               is no ship-to address to show or edit. -->
          <ion-list v-if="!isPosCompleted(shipGroup)" class="ship-group-fulfillment" lines="none">
          <ion-list-header>
            <ion-label>{{ translate('Fulfillment') }}</ion-label>
          </ion-list-header>
          <ion-item lines="full">
            <ion-select :label="translate('Carrier')" interface="popover"
              :placeholder="translate('Select Carrier')"
              :disabled="isShipGroupActionDisabled(shipGroup, 'EDIT_CARRIER_METHOD')"
              :value="getSelection(shipGroup.id, shipGroup).carrierId"
              @ionChange="onCarrierChange(shipGroup.id, $event.detail.value)">
              <ion-select-option v-for="carrier in availableCarriers" :key="carrier.partyId"
                :value="carrier.partyId">
                {{ [carrier.firstName, carrier.lastName].filter(Boolean).join(' ') || carrier.groupName ||
                carrier.partyId
                }}
              </ion-select-option>
            </ion-select>
          </ion-item>

          <ion-item lines="full">
            <ion-select :label="translate('Shipping method')" interface="popover"
              :placeholder="translate('Select Shipping Method')"
              :disabled="isShipGroupActionDisabled(shipGroup, 'EDIT_CARRIER_METHOD')"
              :value="getSelection(shipGroup.id, shipGroup).methodId || undefined"
              @ionChange="onMethodChange(shipGroup.id, $event.detail.value)">
              <ion-select-option
                v-for="method in methodsForCarrier(getSelection(shipGroup.id, shipGroup).carrierId)"
                :key="method.shipmentMethodTypeId" :value="method.shipmentMethodTypeId">
                {{ seed.shipmentMethodDescription(method.shipmentMethodTypeId) }}
              </ion-select-option>
            </ion-select>
          </ion-item>

          <ion-item>
            <ion-icon :icon="sendOutline" slot="start" />
            <ion-label>
              <template v-if="shippingAddressLines(shipGroup).length">
                <div v-for="(line, idx) in shippingAddressLines(shipGroup)" :key="idx">{{ line }}</div>
              </template>
              <div v-else>{{ translate('Shipping address not available') }}</div>
            </ion-label>
            <p slot="end" v-if="!isVirtualFacility(shipGroup) && shipGroupDistances[shipGroup.id]">
              {{ shipGroupDistances[shipGroup.id] }} {{ translate('miles') }}
            </p>
            <ion-button v-if="!isShipGroupActionDisabled(shipGroup, 'EDIT_ADDRESS')" slot="end" fill="clear"
              color="medium" :id="'shipping-opt-trigger-' + shipGroup.id"
              :aria-label="translate('Shipping options')">
              <ion-icon slot="icon-only" :icon="ellipsisVertical" />
            </ion-button>
            <ion-popover :trigger="'shipping-opt-trigger-' + shipGroup.id" dismiss-on-select
              show-backdrop="false">
              <ion-content>
                <ion-list>
                  <ion-list-header>{{ translate("Shipping address") }}</ion-list-header>
                  <ion-item button detail="false"
                    :disabled="isShipGroupActionDisabled(shipGroup, 'EDIT_ADDRESS')"
                    @click="openEditShippingAddress(shipGroup)">
                    <ion-icon :icon="createOutline" slot="end" />
                    {{ translate('Edit') }}
                  </ion-item>
                </ion-list>
              </ion-content>
            </ion-popover>
          </ion-item>

          <!-- Edit shipping address modal -->
          <ion-modal :is-open="editingShipGroupId === shipGroup.id" @didDismiss="closeEditShippingAddress">
            <ion-header>
              <ion-toolbar>
                <ion-buttons slot="start">
                  <ion-button @click="closeEditShippingAddress" :aria-label="translate('Close')"><ion-icon slot="icon-only"
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
                    <ion-select-option v-for="country in seed.getCountries" :key="country.geoId"
                      :value="country.geoId">
                      {{ country.geoName }}
                    </ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item>
                  <ion-select :label="translate('State / Province')" label-placement="stacked"
                    interface="popover" :placeholder="translate('Select State / Province')"
                    :disabled="!shippingAddressForm.countryGeoId"
                    v-model="shippingAddressForm.stateProvinceGeoId">
                    <ion-select-option v-for="state in statesForCountry" :key="state.geoId"
                      :value="state.geoId">
                      {{ state.geoName }}
                    </ion-select-option>
                  </ion-select>
                </ion-item>
              </ion-list>
              <ion-fab vertical="bottom" horizontal="end" slot="fixed">
                <ion-fab-button :disabled="savingShippingAddress" @click="saveShippingAddress(shipGroup)" :aria-label="translate('Save')">
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
      <ion-button v-if="isVirtualFacility(shipGroup) && !isPosCompleted(shipGroup)" fill="clear"
        :disabled="isShipGroupActionDisabled(shipGroup, 'BROKER')" @click="brokerShipGroup(shipGroup.id)">{{
        translate('Broker') }}</ion-button>
      <ion-button v-if="isVirtualFacility(shipGroup) && !isPosCompleted(shipGroup)" fill="clear"
        :disabled="isShipGroupActionDisabled(shipGroup, 'RELEASE')" @click="releaseSelectedItems(shipGroup)">{{
          translate('Release') }}</ion-button>
      <ion-button v-if="!isPosCompleted(shipGroup)" fill="clear"
        :disabled="isShipGroupActionDisabled(shipGroup, isVirtualFacility(shipGroup) ? 'PARK_ITEMS' : 'PULL_BACK')"
        @click="isVirtualFacility(shipGroup) ? parkSelectedItems(shipGroup) : rejectSelectedItems(shipGroup)">{{
          isVirtualFacility(shipGroup) ? translate('Park') : translate('Pull back') }}</ion-button>
      <ion-button
        v-if="canRequestInventoryTransfer && !isVirtualFacility(shipGroup) && !isPosCompleted(shipGroup)"
        fill="clear"
        :disabled="!inventoryTransferItemsForShipGroup(shipGroup).length"
        @click="requestInventoryTransfersForShipGroup(shipGroup)"
      >{{ translate('Request transfer') }}</ion-button>
      <ion-button fill="clear" :disabled="isShipGroupActionDisabled(shipGroup, 'ADD_TASK')"
        @click="openAddTaskModal(shipGroup)">{{ translate('Add Task') }}</ion-button>
      <ion-button v-if="!['ORDER_CANCELLED', 'ORDER_COMPLETED'].includes(order?.statusId)" fill="clear"
        :disabled="isShipGroupActionDisabled(shipGroup, 'ADD_ITEMS')"
        @click="openAddItemModal(shipGroup)">{{ translate('Add Items') }}</ion-button>
    </div>

    <!-- Gift message modal -->
    <ion-modal :is-open="giftModalShipGroupId === shipGroup.id" @didDismiss="giftModalShipGroupId = null">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start"><ion-button @click="giftModalShipGroupId = null" :aria-label="translate('Close')"><ion-icon slot="icon-only"
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
          <ion-fab-button @click="saveGiftMessage(shipGroup)" :aria-label="translate('Save')">
            <ion-icon :icon="saveOutline" />
          </ion-fab-button>
        </ion-fab>
      </ion-content>
    </ion-modal>

    <!-- Shipping dates modal -->
    <ion-modal :is-open="shippingDatesModalShipGroupId === shipGroup.id"
      @didDismiss="shippingDatesModalShipGroupId = null">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start"><ion-button @click="shippingDatesModalShipGroupId = null" :aria-label="translate('Close')"><ion-icon
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
          <ion-fab-button @click="saveShippingDates(shipGroup)" :aria-label="translate('Save')">
            <ion-icon :icon="saveOutline" />
          </ion-fab-button>
        </ion-fab>
      </ion-content>
    </ion-modal>

    <!-- Delivery dates modal -->
    <ion-modal :is-open="deliveryDatesModalShipGroupId === shipGroup.id"
      @didDismiss="deliveryDatesModalShipGroupId = null">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start"><ion-button @click="deliveryDatesModalShipGroupId = null" :aria-label="translate('Close')"><ion-icon
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
          <ion-fab-button @click="saveDeliveryDates(shipGroup)" :aria-label="translate('Save')">
            <ion-icon :icon="saveOutline" />
          </ion-fab-button>
        </ion-fab>
      </ion-content>
    </ion-modal>

    <!-- Instruction modal -->
    <ion-modal :is-open="instructionModalShipGroupId === shipGroup.id"
      @didDismiss="instructionModalShipGroupId = null">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start"><ion-button @click="instructionModalShipGroupId = null" :aria-label="translate('Close')"><ion-icon
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
          <ion-fab-button @click="saveInstruction(shipGroup)" :aria-label="translate('Save')">
            <ion-icon :icon="saveOutline" />
          </ion-fab-button>
        </ion-fab>
      </ion-content>
    </ion-modal>
  </ion-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCheckbox,
  IonChip,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonPopover,
  IonProgressBar,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonThumbnail,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { DateTime } from 'luxon';
import {
  calendarOutline,
  chevronDown,
  chevronUp,
  closeOutline,
  compassOutline,
  createOutline,
  cubeOutline,
  documentTextOutline,
  ellipsisVertical,
  giftOutline,
  mailOutline,
  saveOutline,
  sendOutline,
  trashOutline,
  warningOutline,
} from 'ionicons/icons';
import { useSeedStore } from '@/store/seed';
import { useOrderDetailStore } from '@/store/orderDetail';
import { useOrderTaskStore } from '@/store/orderTask';
import { useProductCacheStore } from '@/store/productCache';
import { commonUtil, DxpShopifyImg, translate } from '@common';
import { isKit, showToast } from '@/utils';
import { shipGroupItemStates as itemStatesFor } from '@/utils/shipGroupItemStates';

const props = withDefaults(defineProps<{
  shipGroup: any;
  order: any;
  isShipGroupExpanded?: (shipGroupId: string) => boolean;
  toggleShipGroup?: (shipGroupId: string) => void;
  shipGroupHoldTaskCount?: (shipGroup: any) => number;
  shipGroupHoldTaskLabel?: (shipGroup: any) => string;
  showShipGroupHoldTask?: () => void;
  isItemSelected?: (shipGroupId: string, itemId: string) => boolean;
  toggleItemSelection?: (shipGroupId: string, itemId: string, checked: boolean) => void;
  isShipGroupActionDisabled?: (shipGroup: any, actionId: string) => boolean;
  brokerShipGroup?: (shipGroupId: string, reassign?: boolean) => void;
  releaseSelectedItems?: (shipGroup: any) => void;
  parkSelectedItems?: (shipGroup: any) => void;
  rejectSelectedItems?: (shipGroup: any) => void;
  canRequestInventoryTransfer?: boolean;
  inventoryTransferItemsForShipGroup?: (shipGroup: any) => any[];
  requestInventoryTransfersForShipGroup?: (shipGroup: any) => void;
  openAddTaskModal?: (shipGroup: any) => void;
  openAddItemModal?: (shipGroup: any) => void;
  viewInventory?: (productId: string) => void;
  availableCarriers?: any[];
  shipGroupDistances?: Record<string, string>;
  productIdentificationPref?: any;
  saveCarrierAndMethod?: (shipGroupId: string, methodId: string, carrierId: string) => Promise<void>;
  updateShipGroup?: (shipGroupId: string, data: any) => Promise<void>;
  loadOrder?: (orderId: string, force?: boolean) => Promise<void>;
  customerPartyId?: string;
}>(), {
  isShipGroupExpanded: () => false,
  toggleShipGroup: () => {},
  shipGroupHoldTaskCount: () => 0,
  shipGroupHoldTaskLabel: () => '',
  showShipGroupHoldTask: () => {},
  isItemSelected: () => false,
  toggleItemSelection: () => {},
  isShipGroupActionDisabled: () => false,
  brokerShipGroup: () => {},
  releaseSelectedItems: () => {},
  parkSelectedItems: () => {},
  rejectSelectedItems: () => {},
  canRequestInventoryTransfer: false,
  inventoryTransferItemsForShipGroup: () => [],
  requestInventoryTransfersForShipGroup: () => {},
  openAddTaskModal: () => {},
  openAddItemModal: () => {},
  viewInventory: () => {},
  availableCarriers: () => [],
  shipGroupDistances: () => ({}),
  productIdentificationPref: () => ({ primaryId: 'productId', secondaryId: '' }),
  saveCarrierAndMethod: async () => {},
  updateShipGroup: async () => {},
  loadOrder: async () => {},
  customerPartyId: '',
});

const seed = useSeedStore();
const orderDetailStore = useOrderDetailStore();
const orderTaskStore = useOrderTaskStore();
const productCache = useProductCacheStore();

const isShipGroupDetailsOpen = (shipGroup: any) => isPosCompleted(shipGroup) || props.isShipGroupExpanded(shipGroup.id);

const shipGroupSelection = ref<Record<string, { carrierId: string; methodId: string }>>({});

function getSelection(shipGroupId: string, shipGroup: any) {
  if (!shipGroupSelection.value[shipGroupId]) {
    shipGroupSelection.value[shipGroupId] = {
      carrierId: shipGroup.carrierPartyId ?? shipGroup.carrier ?? '',
      methodId: shipGroup.shipmentMethodTypeId ?? '',
    };
  }
  return shipGroupSelection.value[shipGroupId];
}

watch(
  () => props.shipGroup,
  (sg) => {
    if (sg?.id) {
      shipGroupSelection.value[sg.id] = {
        carrierId: sg.carrierPartyId ?? sg.carrier ?? '',
        methodId: sg.shipmentMethodTypeId ?? '',
      };
    }
  },
  { immediate: true, deep: true }
);

function isVirtualFacility(shipGroup: any): boolean {
  if (shipGroup.isVirtual !== undefined) return shipGroup.isVirtual;
  if (!shipGroup.facilityId) return true;
  return (
    shipGroup.facilityParentTypeId === 'VIRTUAL_FACILITY' ||
    shipGroup.facilityTypeId === 'VIRTUAL_FACILITY'
  );
}

function isPosCompleted(shipGroup: any): boolean {
  return shipGroup?.shipmentMethodTypeId === 'POS_COMPLETED';
}

function shipGroupBrokeredDate(shipGroup: any): string | number | undefined {
  return shipGroup.firstBrokeredDate;
}

function isShipGroupBrokered(shipGroup: any): boolean {
  return shipGroup.isBrokered ?? (!isVirtualFacility(shipGroup) || !!shipGroup.firstBrokeredDate);
}

function shipGroupItemStates(shipGroup: any) {
  return itemStatesFor(shipGroup?.items);
}

function isShipGroupReadOnly(shipGroup: any): boolean {
  return shipGroup.isReadOnly ?? shipGroupItemStates(shipGroup).settled;
}

function shipGroupProgress(shipGroup: any): number {
  return shipGroup.progress ?? 0;
}

function shipGroupStatusLabel(shipGroup: any): string {
  return shipGroup.statusLabel || '';
}

function hasSelectableShipGroupOptions(shipGroup: any): boolean {
  if (isShipGroupReadOnly(shipGroup)) return false;
  return !shipGroup.giftMessage
    || (!shipGroup.shipAfterDate && !shipGroup.shipByDate)
    || (!shipGroup.estimatedShipDate && !shipGroup.estimatedDeliveryDate)
    || !shipGroup.shippingInstructions;
}

function hasSelectedShipGroupOptions(shipGroup: any): boolean {
  return !!shipGroup.giftMessage
    || !!shipGroup.shipAfterDate
    || !!shipGroup.shipByDate
    || !!shipGroup.estimatedShipDate
    || !!shipGroup.estimatedDeliveryDate
    || !!shipGroup.shippingInstructions;
}

function shipGroupPreviewItems(shipGroup: any) {
  return (shipGroup.items || []).slice(0, 3);
}

function carrierName(carrierPartyId: string): string {
  const carrier = props.availableCarriers.find((party: any) => party.partyId === carrierPartyId);
  return carrier ? [carrier.firstName, carrier.lastName].filter(Boolean).join(' ') || carrier.groupName || carrier.partyId : '';
}

function shippingMethodLabel(shipmentMethodTypeId: string): string {
  return shipmentMethodTypeId ? seed.shipmentMethodDescription(shipmentMethodTypeId) : '';
}

function methodsForCarrier(carrierPartyId: string) {
  return [...orderDetailStore.shippingMethodsByCarrier(carrierPartyId)].sort((a, b) =>
    Number(a.sequenceNumber ?? Infinity) - Number(b.sequenceNumber ?? Infinity)
  );
}

async function onCarrierChange(shipGroupId: string, carrierPartyId: string) {
  const sel = getSelection(shipGroupId, props.shipGroup);
  sel.carrierId = carrierPartyId;
  sel.methodId = '';
}

async function onMethodChange(shipGroupId: string, shipmentMethodTypeId: string) {
  const sel = getSelection(shipGroupId, props.shipGroup);
  if (!sel.carrierId || !shipmentMethodTypeId) return;
  sel.methodId = shipmentMethodTypeId;
  await props.saveCarrierAndMethod(shipGroupId, shipmentMethodTypeId, sel.carrierId);
}

function getProduct(productId: string) {
  return productCache.getProduct(productId);
}

function shipGroupProductIdentification(identificationPref: string, item: any): string {
  const product = getProduct(item.productId);
  return product ? commonUtil.getProductIdentificationValue(identificationPref, product) : '';
}

function productFeatureLabel(productId: string): string {
  return commonUtil.getFeatures(getProduct(productId)?.productFeatures);
}

function shipGroupShippingContactMech(shipGroup: any) {
  return shipGroup.contactMechId
    ? orderDetailStore.contactMechsByIdByOrderId(props.order?.id)[shipGroup.contactMechId]
    : orderDetailStore.contactMechsByPurposeByOrderId(props.order?.id)?.['SHIPPING_LOCATION'];
}

function shippingAddressLines(shipGroup: any): string[] {
  if (shipGroup.shippingAddress?.lines?.length) return shipGroup.shippingAddress.lines;
  const addr = shipGroupShippingContactMech(shipGroup)?.postalAddress;
  if (!addr) return [];
  return [
    addr.toName,
    addr.address1,
    addr.address2,
    [addr.city, seed.geoName(addr.stateProvinceGeoId), addr.postalCode].filter(Boolean).join(', '),
    seed.geoName(addr.countryGeoId)
  ].filter(Boolean) as string[];
}

function shippingAddressView(shipGroup: any): { name: string; street: string; locality: string } | null {
  if (shipGroup.shippingAddress?.view) return shipGroup.shippingAddress.view;
  const addr = shipGroupShippingContactMech(shipGroup)?.postalAddress;
  if (!addr) return null;
  return {
    name: addr.toName || '',
    street: [addr.address1, addr.address2].filter(Boolean).join(', '),
    locality: [addr.city, addr.postalCode, seed.geoName(addr.stateProvinceGeoId), seed.geoName(addr.countryGeoId)].filter(Boolean).join(', ')
  };
}

const lifecycleByShipGroup = computed(() => {
  const map: Record<string, any> = {};
  if (props.shipGroup?.id) {
    map[props.shipGroup.id] = props.shipGroup.lifecycle || orderDetailStore.timelineByShipGroup?.[props.shipGroup.id] || {};
  }
  return map;
});

const itemIssuanceBadges = computed(() => {
  const badges: Record<string, any> = {};
  const issuanceByItem = orderDetailStore.issuanceByItemSeqIdByOrderId(props.order?.id);
  (props.shipGroup?.items || []).forEach((item: any) => {
    if (item.issuanceBadge) {
      badges[item.id] = item.issuanceBadge;
      return;
    }
    if (isPosCompleted(props.shipGroup) && issuanceByItem) {
      const summary = issuanceByItem[item.id];
      const ordered = Number(item.quantity) || 0;
      const issued = summary?.issued || 0;
      const stock = { qohBefore: summary?.qohBefore ?? 0, qohAfter: summary?.qohAfter ?? 0 };

      if (issued <= 0) badges[item.id] = { label: 'Inventory not issued', tone: 'warning', ...stock };
      else if (ordered && issued < ordered) badges[item.id] = { label: 'Inventory partly issued', tone: 'warning', ...stock };
      else badges[item.id] = { label: 'Inventory issued', tone: 'success', ...stock };
    }
  });
  return badges;
});

// Collapsible Height Directive
const collapsibleObservers = new WeakMap<HTMLElement, ResizeObserver>();

function updateCollapsibleHeight(el: HTMLElement) {
  const update = () => {
    el.style.setProperty('--ship-group-collapsible-height', `${el.scrollHeight}px`);
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(update);
    return;
  }
  update();
}

const vCollapsible = {
  mounted(el: HTMLElement) {
    updateCollapsibleHeight(el);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => updateCollapsibleHeight(el));
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    collapsibleObservers.set(el, observer);
  },
  updated(el: HTMLElement) {
    updateCollapsibleHeight(el);
  },
  unmounted(el: HTMLElement) {
    collapsibleObservers.get(el)?.disconnect();
    collapsibleObservers.delete(el);
  },
};

// Date / Time formatters
function toDateInputValue(value: any): string {
  if (!value) return '';
  const dt = /^\d+$/.test(String(value))
    ? DateTime.fromMillis(Number(value))
    : DateTime.fromISO(String(value));
  return dt.isValid ? dt.toISODate() ?? '' : '';
}

function formatDate(value: string | number | undefined) {
  if (!value) return '';
  const num = Number(value);
  const dt = Number.isFinite(num) && String(value).length >= 10 ? DateTime.fromMillis(num) : DateTime.fromISO(String(value));
  return dt.isValid ? dt.toFormat('yyyy-LL-dd HH:mm') : String(value);
}

function formatTime(value: string | number | undefined) {
  if (!value) return '';
  const num = Number(value);
  const dt = Number.isFinite(num) && String(value).length >= 10
    ? DateTime.fromMillis(num)
    : DateTime.fromISO(String(value));
  return dt.isValid ? dt.toFormat('HH:mm') : String(value);
}

function findTimeDiff(startTime: string | number | undefined, endTime: string | number | undefined) {
  const startMillis = timelineMillis(startTime);
  const endMillis = timelineMillis(endTime);
  if (!startMillis || !endMillis) return '';
  const timeDiff = DateTime.fromMillis(endMillis).diff(DateTime.fromMillis(startMillis), ['years', 'months', 'days', 'hours', 'minutes']);
  let diffString = '+ ';
  if (timeDiff.years) diffString += `${Math.round(timeDiff.years)} years `;
  if (timeDiff.months) diffString += `${Math.round(timeDiff.months)} months `;
  if (timeDiff.days) diffString += `${Math.round(timeDiff.days)} days `;
  if (timeDiff.hours) diffString += `${Math.round(timeDiff.hours)} hours `;
  if (timeDiff.minutes) diffString += `${Math.round(timeDiff.minutes)} minutes`;
  return diffString.trim() === '+' ? '' : diffString.trim();
}

function timelineMillis(value: string | number | undefined | null) {
  if (!value) return undefined;
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return String(value).length === 10 ? numericValue * 1000 : numericValue;
  }
  const stringValue = String(value);
  const sqlDate = DateTime.fromSQL(stringValue);
  if (sqlDate.isValid) return sqlDate.toMillis();
  const isoDate = DateTime.fromISO(stringValue);
  return isoDate.isValid ? isoDate.toMillis() : undefined;
}

type LifecycleStep = 'brokered' | 'pick' | 'pack' | 'ship';
const LIFECYCLE_STEP_ORDER: LifecycleStep[] = ['brokered', 'pick', 'pack', 'ship'];

function lifecycleStepValue(timeline: any, step: LifecycleStep) {
  if (!timeline) return undefined;
  if (step === 'brokered') return timeline.firstBrokeredDate || timeline.firstReleasedDate;
  if (step === 'pick') return timeline.picklistDate;
  if (step === 'pack') return timeline.packedDate;
  return timeline.shippedDate;
}

function lifecycleStepLabel(timeline: any, step: LifecycleStep) {
  const value = lifecycleStepValue(timeline, step);
  if (!value) return '';
  const stepIndex = LIFECYCLE_STEP_ORDER.indexOf(step);
  for (let index = stepIndex - 1; index >= 0; index--) {
    const previousValue = lifecycleStepValue(timeline, LIFECYCLE_STEP_ORDER[index]);
    if (previousValue) return findTimeDiff(previousValue, value);
  }
  return commonUtil.getRelativeTime(value);
}

function lifecycleStepNote(shipGroup: any, date: any): string {
  return formatTime(date) || (shipGroupItemStates(shipGroup).settled ? translate('No date') : translate('Pending'));
}

function brokeredStepNote(shipGroup: any): string {
  return formatTime(shipGroupBrokeredDate(shipGroup))
    || (isShipGroupBrokered(shipGroup) || shipGroupItemStates(shipGroup).settled
      ? translate('No date')
      : translate('Pending'));
}

// ── Modals & Draft States ───────────────────────────────────────────────────

// 1. Edit Shipping Address
const editingShipGroupId = ref<string | null>(null);
const savingShippingAddress = ref(false);
const shippingAddressForm = ref({
  address1: '',
  address2: '',
  city: '',
  postalCode: '',
  stateProvinceGeoId: '',
  countryGeoId: '',
});
const statesForCountry = computed(() => seed.getStates);

function openEditShippingAddress(shipGroup: any) {
  const mech = shipGroupShippingContactMech(shipGroup);
  const addr = mech?.postalAddress ?? {};
  shippingAddressForm.value = {
    address1: addr.address1 ?? '',
    address2: addr.address2 ?? '',
    city: addr.city ?? '',
    postalCode: addr.postalCode ?? '',
    stateProvinceGeoId: addr.stateProvinceGeoId ?? '',
    countryGeoId: addr.countryGeoId ?? '',
  };
  editingShipGroupId.value = shipGroup.id;
}

function closeEditShippingAddress() {
  editingShipGroupId.value = null;
}

async function saveShippingAddress(shipGroup: any) {
  if (!props.order) return;
  const partyId = props.customerPartyId || props.order.customerPartyId;
  if (!partyId) {
    await showToast(translate('Customer is not available for this order.'));
    return;
  }

  const contactMechId = shipGroupShippingContactMech(shipGroup)?.contactMechId || shipGroup.contactMechId;
  savingShippingAddress.value = true;
  try {
    await orderTaskStore.updateShippingInformation(props.order.id, shipGroup.id, {
      ...shippingAddressForm.value,
      partyId,
      contactMechId,
      contactMechPurposeTypeId: 'SHIPPING_LOCATION',
      isEdited: true,
    });
    await showToast(translate('Shipping address updated successfully.'));
    closeEditShippingAddress();
    await props.loadOrder(props.order.id, true);
  } catch {
    await showToast(translate('Failed to update shipping address. Please try again.'));
  } finally {
    savingShippingAddress.value = false;
  }
}

// 2. Gift Message Modal
const giftModalShipGroupId = ref<string | null>(null);
const giftMessageDraft = ref('');

function openGiftModal(shipGroup: any) {
  giftMessageDraft.value = shipGroup.giftMessage ?? '';
  giftModalShipGroupId.value = shipGroup.id;
}

async function saveGiftMessage(shipGroup: any) {
  try {
    await props.updateShipGroup(shipGroup.id, { giftMessage: giftMessageDraft.value });
    giftModalShipGroupId.value = null;
    await showToast(translate('Gift message saved.'));
  } catch {
    await showToast(translate('Failed to save gift message.'));
  }
}

async function clearGiftMessage(shipGroup: any) {
  try {
    await props.updateShipGroup(shipGroup.id, { giftMessage: null });
    await showToast(translate('Gift message cleared.'));
  } catch {
    await showToast(translate('Failed to clear gift message.'));
  }
}

// 3. Shipping Dates Modal
const shippingDatesModalShipGroupId = ref<string | null>(null);
const shippingDatesDraft = ref({ shipAfterDate: '', shipByDate: '' });

function openShippingDatesModal(shipGroup: any) {
  shippingDatesDraft.value = {
    shipAfterDate: toDateInputValue(shipGroup.shipAfterDate),
    shipByDate: toDateInputValue(shipGroup.shipByDate),
  };
  shippingDatesModalShipGroupId.value = shipGroup.id;
}

async function saveShippingDates(shipGroup: any) {
  try {
    await props.updateShipGroup(shipGroup.id, {
      shipAfterDate: shippingDatesDraft.value.shipAfterDate || null,
      shipByDate: shippingDatesDraft.value.shipByDate || null,
    });
    shippingDatesModalShipGroupId.value = null;
    await showToast(translate('Shipping dates saved.'));
  } catch {
    await showToast(translate('Failed to save shipping dates.'));
  }
}

// 4. Delivery Dates Modal
const deliveryDatesModalShipGroupId = ref<string | null>(null);
const deliveryDatesDraft = ref({ estimatedShipDate: '', estimatedDeliveryDate: '' });

function openDeliveryDatesModal(shipGroup: any) {
  deliveryDatesDraft.value = {
    estimatedShipDate: toDateInputValue(shipGroup.estimatedShipDate),
    estimatedDeliveryDate: toDateInputValue(shipGroup.estimatedDeliveryDate),
  };
  deliveryDatesModalShipGroupId.value = shipGroup.id;
}

async function saveDeliveryDates(shipGroup: any) {
  try {
    await props.updateShipGroup(shipGroup.id, {
      estimatedShipDate: deliveryDatesDraft.value.estimatedShipDate || null,
      estimatedDeliveryDate: deliveryDatesDraft.value.estimatedDeliveryDate || null,
    });
    deliveryDatesModalShipGroupId.value = null;
    await showToast(translate('Delivery dates saved.'));
  } catch {
    await showToast(translate('Failed to save delivery dates.'));
  }
}

// 5. Instruction Modal
const instructionModalShipGroupId = ref<string | null>(null);
const instructionDraft = ref('');

function openInstructionModal(shipGroup: any) {
  instructionDraft.value = shipGroup.shippingInstructions ?? '';
  instructionModalShipGroupId.value = shipGroup.id;
}

async function saveInstruction(shipGroup: any) {
  try {
    await props.updateShipGroup(shipGroup.id, { shippingInstructions: instructionDraft.value });
    instructionModalShipGroupId.value = null;
    await showToast(translate('Instructions saved.'));
  } catch {
    await showToast(translate('Failed to save instructions.'));
  }
}
</script>

<style scoped>
.ship-group-item-features {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
