<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/orders" />
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate('Order details') }}</ion-title>
      </ion-toolbar>
      <ion-progress-bar v-if="loading" type="indeterminate" />
    </ion-header>

    <ion-content v-if="order">
      <div class="order-detail-header">
        <!-- direct child matching .order-detail-header>ion-item -->
        <ion-item lines="none">
          <ion-icon slot="start" :icon="ticketOutline" />
          <ion-label>
            <p class="overline">{{ order.status }}</p>
            <h1>{{ order.orderName ? order.orderName : order.id }}</h1>
            <p>{{ order.id }}</p>
          </ion-label>
        </ion-item>

        <!-- timeline: child matching .order-detail-timeline -->
        <div class="order-detail-timeline">
          <ion-list>
            <ion-list-header>
              <ion-label>{{ translate('Timeline') }}</ion-label>
            </ion-list-header>

            <ion-item v-for="historyEntry in order.history" :key="historyEntry.id">
              <ion-label>
                {{ historyEntry.label }}
                <p>{{ historyEntry.detail }}</p>
                <p v-if="historyEntry.changeReason">{{ historyEntry.changeReason }}</p>
              </ion-label>
              <ion-note slot="end">{{ formatDate(historyEntry.at) }}</ion-note>
            </ion-item>

            <template v-if="!order.history?.length">
              <ion-item>
                <ion-label>
                  {{ translate('Order status') }}
                  <p>{{ translate('Initial status details') }}</p>
                </ion-label>
              </ion-item>
              <ion-item>
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
          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ order.customerName || 'Customer name' }}</ion-card-title>
            </ion-card-header>
            <ion-list lines="none">
              <ion-item>
                <ion-label>
                  <p>{{ translate('Email') }}</p>
                  {{ customer?.email || translate('Email not available') }}
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-label>
                  <p>{{ translate('Phone') }}</p>
                  {{ customer?.phone || translate('Phone not available') }}
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-label>
                  <p>{{ translate('Billing address') }}</p>
                  <template v-if="billingAddress?.lines?.length">
                    <div v-for="(line, idx) in billingAddress.lines" :key="idx">{{ line }}</div>
                  </template>
                  <div v-else>{{ translate('Billing address not available') }}</div>
                </ion-label>
              </ion-item>
            </ion-list>
          </ion-card>

          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ translate('Order identifications') }}</ion-card-title>
            </ion-card-header>
            <ion-list lines="none">
              <ion-item>
                <ion-label>
                  <p>{{ translate('Order name') }}</p>
                  {{ order.orderName || translate('Order name') }}
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-label>
                  <p>{{ translate('Order external ID') }}</p>
                  {{ order.externalId || translate('Order external ID') }}
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-label>
                  <p>{{ translate('Order ID') }}</p>
                  {{ order.id }}
                </ion-label>
              </ion-item>
              <ion-item v-for="id in order.identifications" :key="id.orderIdentificationTypeId">
                <ion-label>
                  <p>{{ id.typeLabel }}</p>
                  {{ id.idValue }}
                </ion-label>
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
                  <p>{{ translate('Product store name') }}</p>
                  {{ order.productStoreName }}
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-label>
                  <p>{{ translate('Sales channel') }}</p>
                  {{ order.channel || translate('Sales channel enum') }}
                </ion-label>
              </ion-item>
            </ion-list>
          </ion-card>

          <ion-card v-if="riskSummary.hasRiskSignal">
            <ion-card-header>
              <ion-card-title>{{ translate('Fraud risk') }}</ion-card-title>
            </ion-card-header>
            <ion-list lines="none">
              <ion-item button detail @click="selectedSegment = 'risk'">
                <ion-icon slot="start" :icon="shieldOutline" :color="riskLevelColor(order.riskLevelEnumId)" />
                <ion-label>
                  <p>{{ translate('Recommendation') }}</p>
                  {{ riskSummary.recommendation }}
                </ion-label>
                <ion-badge slot="end" :color="riskLevelColor(order.riskLevelEnumId)">
                  {{ riskSummary.level }}
                </ion-badge>
              </ion-item>
            </ion-list>
          </ion-card>
        </div>
      </div>

      <ion-segment v-model="selectedSegment">
        <ion-segment-button value="items">
          <ion-label>{{ translate('Items') }}</ion-label>
        </ion-segment-button>
        <ion-segment-button value="ship-groups">
          <ion-label>{{ translate('Ship groups') }}</ion-label>
        </ion-segment-button>
        <ion-segment-button value="holds">
          <ion-label>{{ translate('Holds') }}</ion-label>
        </ion-segment-button>
        <ion-segment-button value="risk">
          <ion-label>{{ translate('Risk') }}</ion-label>
        </ion-segment-button>
        <ion-segment-button value="comms">
          <ion-label>{{ translate('Comms') }}</ion-label>
        </ion-segment-button>
      </ion-segment>

      <div v-if="selectedSegment === 'items'" class="order-items">

        <ion-list lines="none" class="order-items-list">
          <ion-item lines="full" class="order-items-toolbar">
            <ion-checkbox :checked="areAllSelected" justify="start" label-placement="end"
              @ionChange="toggleSelectAll($event.detail.checked)">{{ translate('Select all') }}</ion-checkbox>
            <ion-button slot="end" fill="outline" @click="openAddItemFromItemsSegment">
              {{ translate('Add Items') }}
            </ion-button>
          </ion-item>
          <ion-accordion-group>
            <ion-accordion v-for="group in groupedItems" :key="group.externalId" :value="group.externalId">
              <OrderItemListRow
                slot="header"
                class="order-item-rollup-entry"
                :primary="groupPrimaryIdentifier(group)"
                :secondary="groupSecondaryIdentifier(group)"
                :badge-label="isKit(group) ? translate('Kit') : ''"
                :image-url="getProduct(group.productId)?.mainImageUrl"
                :preview-product="getProduct(group.productId)"
                :selected="group.selected"
                :quantity="group.totalQty"
                :quantity-label="translate('qty')"
                :status-label="group.status"
                :status-color="commonUtil.getStatusColor(group.statusId)"
                :amount="money(group.totalPrice, order.currency)"
                :adjustments="getGroupAdjustmentRows(group)"
                @update:selected="group.selected = $event"
              />
              <div slot="content">
                <ion-list lines="none">
                  <OrderItemListRow
                    v-for="item in group.items"
                    :key="item.orderItemSeqId"
                    class="order-item-detail-entry"
                    :primary="item.orderItemSeqId"
                    :secondary="item.externalId || `${translate('#')}${item.shipGroupSeqId}`"
                    :selected="item.selected"
                    :quantity="item.quantity"
                    :quantity-label="translate('qty')"
                    :facility-label="item.facilityName"
                    :facility-disabled="['ITEM_CANCELLED', 'ITEM_COMPLETED'].includes(item.statusId)"
                    :attributes-label="attributeChipLabel(item.attributeCount)"
                    :attributes-disabled="!item.attributeCount"
                    :status-label="item.status"
                    :status-color="commonUtil.getStatusColor(item.statusId)"
                    :status-detail="itemStatusDetail(item)"
                    :amount="money(itemLineTotal(item), order.currency)"
                    :adjustments="getItemAdjustmentRows(item)"
                    @update:selected="item.selected = $event"
                    @facility-click="rejectAndReleaseItem(item, group.productId)"
                    @attributes-click="openItemAttributesModal(item)"
                  >
                    <template #actions>
                      <ion-button v-if="!['ITEM_CANCELLED', 'ITEM_COMPLETED'].includes(item.statusId)" fill="clear"
                        size="small" color="danger" @click.stop="cancelSingleItem(item)">
                        {{ translate('Cancel') }}
                      </ion-button>
                    </template>
                  </OrderItemListRow>
                </ion-list>
              </div>
            </ion-accordion>
          </ion-accordion-group>
        </ion-list>

        <!-- Totals Card -->

        <div class="order-summary">
          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ translate('Payment') }}</ion-card-title>
            </ion-card-header>
            <ion-list lines="none">
              <ion-item v-for="payment in order.payments" :key="payment.id">
                <ion-label>
                  <p class="overline">{{ payment.paymentMethodTypeId || payment.method }}</p>
                  {{ payment.paymentMethodTypeDesc || payment.method }}
                  <p>{{ payment.statusDesc || payment.status }}</p>
                </ion-label>
                <ion-note slot="end">{{ money(payment.amount, order.currency) }}</ion-note>
              </ion-item>
              <ion-item v-if="!order.payments?.length">
                <ion-label>{{ translate('No payment preference records') }}</ion-label>
              </ion-item>
            </ion-list>
          </ion-card>
          <ion-card class="totals">
            <ion-list lines="full">
              <ion-item>
                <ion-label>{{ translate('Subtotal') }}</ion-label>
                <ion-label slot="end">{{ money(orderTotals.subtotal, order.currency) }}</ion-label>
              </ion-item>
              <ion-item v-for="adjustment in orderAdjustmentRows" :key="adjustment.label">
                <ion-label>
                  {{ adjustment.label }}
                  <p v-if="adjustment.detail">{{ adjustment.detail }}</p>
                </ion-label>
                <ion-label slot="end">{{ money(adjustment.amount, order.currency) }}</ion-label>
              </ion-item>
              <ion-item>
                <ion-label>{{ translate('Grand total') }}</ion-label>
                <ion-label slot="end" color="dark">{{ money(orderTotals.total, order.currency) }}</ion-label>
              </ion-item>
              <ion-item>
                <ion-label>{{ translate('Payment received') }}</ion-label>
                <ion-label slot="end">{{ money(paymentReceivedTotal, order.currency) }}</ion-label>
              </ion-item>
            </ion-list>
          </ion-card>
        </div>
      </div>
      <div v-if="selectedSegment === 'ship-groups'" class="ion-padding">
        <!-- Loop through ship groups or show mock card if empty -->
        <template v-if="order.shipGroups && order.shipGroups.length">
          <ion-card v-for="shipGroup in order.shipGroups.filter((sg: any) => sg.items?.length)" :key="shipGroup.id"
            class="ship-group-card">
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
                <ion-button fill="clear" color="medium" @click="toggleShipGroup(shipGroup.id)">
                  <ion-icon slot="icon-only" :icon="isShipGroupExpanded(shipGroup.id) ? chevronUp : chevronDown" />
                </ion-button>
              </div>
            </div>

            <ion-progress-bar :value="shipGroupProgress(shipGroup)"
              :color="shipGroupProgress(shipGroup) === 1 ? 'success' : 'primary'" />
            <div class="ship-group-options-wrapper">
              <!-- shows when expanded -->
              <div class="ship-group-expanded-options"
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
                class="ship-group-selected-options ion-padding-horizontal ion-padding-top">
                <ion-item v-if="shipGroup.giftMessage" button detail="false" lines="none"
                  @click="openGiftModal(shipGroup)">
                  <ion-label>
                    <p>{{ translate('Gift message') }}</p>
                    {{ shipGroup.giftMessage }}
                  </ion-label>
                </ion-item>
                <ion-item v-if="shipGroup.shipAfterDate || shipGroup.shipByDate" button detail="false" lines="none"
                  @click="openShippingDatesModal(shipGroup)">
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
                  lines="none" @click="openDeliveryDatesModal(shipGroup)">
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
                  @click="openInstructionModal(shipGroup)">
                  <ion-label>
                    <p class="outline">{{ translate('Instructions') }}</p>
                    {{ shipGroup.shippingInstructions }}
                  </ion-label>
                </ion-item>
              </div>
            </div>

            <!-- shows all the time -->
            <div class="ship-group-timeline">
              <ion-item lines="none">
                <ion-icon slot="start" :icon="compassOutline" />
                <ion-label>
                  <p class="overline" v-if="timelineByShipGroup[shipGroup.id]?.firstBrokeredDate">{{
                    commonUtil.getRelativeTime(timelineByShipGroup[shipGroup.id]?.firstBrokeredDate) }}</p>
                  {{ translate('Brokered') }}
                </ion-label>
                <ion-note slot="end">{{ formatTime(timelineByShipGroup[shipGroup.id]?.firstBrokeredDate) ||
                  translate('Pending')
                  }}</ion-note>
              </ion-item>
              <ion-item lines="none">
                <ion-icon slot="start" :icon="mailOutline" />
                <ion-label>
                  <p class="overline" v-if="timelineByShipGroup[shipGroup.id]?.picklistDate">{{
                    commonUtil.getRelativeTime(timelineByShipGroup[shipGroup.id]?.picklistDate) }}</p>
                  {{ translate('Pick') }}
                </ion-label>
                <ion-note slot="end">{{ formatTime(timelineByShipGroup[shipGroup.id]?.picklistDate) ||
                  translate('Pending')
                  }}</ion-note>
              </ion-item>
              <ion-item lines="none">
                <ion-icon slot="start" :icon="checkmarkOutline" />
                <ion-label>
                  <p class="overline" v-if="timelineByShipGroup[shipGroup.id]?.packedDate">{{
                    commonUtil.getRelativeTime(timelineByShipGroup[shipGroup.id]?.packedDate) }}</p>
                  {{ translate('Pack') }}
                </ion-label>
                <ion-note slot="end">{{ formatTime(timelineByShipGroup[shipGroup.id]?.packedDate) ||
                  translate('Pending')
                  }}</ion-note>
              </ion-item>
              <ion-item lines="none">
                <ion-icon slot="start" :icon="sendOutline" />
                <ion-label>
                  <p class="overline" v-if="timelineByShipGroup[shipGroup.id]?.shippedDate">{{
                    commonUtil.getRelativeTime(timelineByShipGroup[shipGroup.id]?.shippedDate) }}</p>
                  {{ translate('Ship') }}
                </ion-label>
                <ion-note slot="end">{{ formatTime(timelineByShipGroup[shipGroup.id]?.shippedDate) ||
                  translate('Pending')
                  }}</ion-note>
              </ion-item>
            </div>

            <!-- shows when collapsed -->
            <div class="ship-group-summary-container"
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

            <!-- shows when expanded -->
            <div class="ship-group-card-details"
              :class="{ 'ship-group-card-details-expanded': isShipGroupExpanded(shipGroup.id) }"
              :aria-hidden="!isShipGroupExpanded(shipGroup.id)"
              :inert="isShipGroupExpanded(shipGroup.id) ? undefined : ''">
              <div class="ship-group-card-details-inner">
                <div class="ship-group-detail-columns">
                  <ion-list class="ship-group-items" lines="none">
                  <ion-list-header>
                    <ion-label>{{ translate('Items') }}</ion-label>
                  </ion-list-header>
                  <ion-item v-for="item in shipGroup.items" :key="item.id">
                    <ion-checkbox slot="start" :checked="isItemSelected(shipGroup.id, item.id)"
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
                    </ion-label>

                    <ion-button slot="end" fill="clear" color="medium" @click.stop="viewInventory(item.productId)">
                      <ion-icon slot="icon-only" :icon="cubeOutline" />
                    </ion-button>
                  </ion-item>
                  </ion-list>

                  <ion-list class="ship-group-fulfillment" lines="none">
                  <ion-list-header>
                    <ion-label>{{ translate('Fulfillment') }}</ion-label>
                  </ion-list-header>
                  <ion-item lines="full">
                    <ion-select :label="translate('Carrier')" interface="popover"
                      :placeholder="translate('Select Carrier')"
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
                    <ion-button slot="end" fill="clear" color="medium" :id="'shipping-opt-trigger-' + shipGroup.id">
                      <ion-icon slot="icon-only" :icon="ellipsisVertical" />
                    </ion-button>
                    <ion-popover :trigger="'shipping-opt-trigger-' + shipGroup.id" dismiss-on-select
                      show-backdrop="false">
                      <ion-content>
                        <ion-list>
                          <ion-list-header>{{ translate("Shipping address") }}</ion-list-header>
                          <ion-item button detail="false" @click="openEditShippingAddress(shipGroup)">
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
                          <ion-button @click="closeEditShippingAddress"><ion-icon slot="icon-only"
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
                        <ion-fab-button :disabled="savingShippingAddress" @click="saveShippingAddress(shipGroup)">
                          <ion-icon :icon="saveOutline" />
                        </ion-fab-button>
                      </ion-fab>
                    </ion-content>
                  </ion-modal>
                  </ion-list>
                </div>
              </div>
            </div>

            <div class="ship-group-actions ion-padding-horizontal ion-padding-bottom">
              <ion-button v-if="isVirtualFacility(shipGroup)" fill="clear" @click="brokerShipGroup(shipGroup.id)">{{
                translate('Broker ship group') }}</ion-button>
              <ion-button fill="clear" :disabled="!selectedItemsForShipGroup(shipGroup.id).length"
                @click="isVirtualFacility(shipGroup) ? parkSelectedItems(shipGroup) : rejectSelectedItems(shipGroup)">{{
                  isVirtualFacility(shipGroup) ? translate('Park Items') : translate('Pull back') }}</ion-button>
              <ion-button v-if="isVirtualFacility(shipGroup)" fill="clear"
                :disabled="!selectedItemsForShipGroup(shipGroup.id).length" @click="releaseSelectedItems(shipGroup)">{{
                  translate('Release') }}</ion-button>
              <ion-button fill="clear" @click="openAddTaskModal(shipGroup)">{{ translate('Add Task') }}</ion-button>
              <ion-button fill="clear" @click="openAddItemModal(shipGroup)">{{ translate('Add Items') }}</ion-button>
            </div>
          <!-- Gift message modal -->
          <ion-modal :is-open="giftModalShipGroupId === shipGroup.id" @didDismiss="giftModalShipGroupId = null">
            <ion-header>
              <ion-toolbar>
                <ion-buttons slot="start"><ion-button @click="giftModalShipGroupId = null"><ion-icon slot="icon-only"
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
                <ion-fab-button @click="saveGiftMessage(shipGroup)">
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
                <ion-buttons slot="start"><ion-button @click="shippingDatesModalShipGroupId = null"><ion-icon
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
                <ion-fab-button @click="saveShippingDates(shipGroup)">
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
                <ion-buttons slot="start"><ion-button @click="deliveryDatesModalShipGroupId = null"><ion-icon
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
                <ion-fab-button @click="saveDeliveryDates(shipGroup)">
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
                <ion-buttons slot="start"><ion-button @click="instructionModalShipGroupId = null"><ion-icon
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
                <ion-fab-button @click="saveInstruction(shipGroup)">
                  <ion-icon :icon="saveOutline" />
                </ion-fab-button>
              </ion-fab>
            </ion-content>
          </ion-modal>
          </ion-card>
        </template>

        <template v-else>
          <EmptyState :title="translate('No ship groups')"
            :message="translate('There are no ship groups defined for this order.')" />
        </template>
      </div>

      <div v-if="selectedSegment === 'holds'">
        <template v-if="hasOrderHoldTasks">
          <BadAddressTaskCard v-for="task in orderAddressValidationTasks" :key="task.workEffortId" :task="task"
            @completed="reloadHoldTasks" />
          <SwapTaskCard v-for="task in orderSwapTasks" :key="task.workEffortId" :task="task"
            @completed="reloadHoldTasks" />
          <FraudTaskCard v-for="task in orderFraudTasks" :key="task.workEffortId" :task="task"
            @completed="reloadHoldTasks" />
          <HoldTaskCard v-for="task in orderHoldTasks" :key="task.workEffortId" :task="task"
            @completed="reloadHoldTasks" />
        </template>
        <EmptyState v-else :title="translate('No holds')" :message="translate('No holds on this order')" />
      </div>

      <div v-if="selectedSegment === 'risk'">
        <ion-list>
          <ion-list-header>
            <ion-label>{{ translate('Fraud risk') }}</ion-label>
          </ion-list-header>
          <ion-item lines="none">
            <ion-icon slot="start" :icon="shieldOutline" :color="riskLevelColor(order.riskLevelEnumId)" />
            <ion-label>
              {{ riskSummary.recommendation }}
              <p>{{ translate('Recommendation') }}</p>
            </ion-label>
            <ion-badge slot="end" :color="riskLevelColor(order.riskLevelEnumId)">{{ riskSummary.level }}</ion-badge>
          </ion-item>
        </ion-list>

        <ion-list v-if="riskAssessmentsStatus === 'loading'">
          <ion-item lines="none">
            <ion-label>{{ translate('Loading risk assessments...') }}</ion-label>
          </ion-item>
        </ion-list>

        <ErrorState
          v-else-if="riskAssessmentsStatus === 'error'"
          :title="translate('Risk assessments failed to load')"
          :message="riskAssessmentsError"
        />

        <ion-list v-else-if="riskAssessments.length">
          <ion-list-header>
            <ion-label>{{ translate('Assessment details') }}</ion-label>
          </ion-list-header>
          <ion-item v-for="risk in riskAssessments" :key="risk.providerId">
            <ion-icon slot="start" :icon="informationCircleOutline" :color="riskLevelColor(risk.riskLevelEnumId)" />
            <ion-label>
              {{ risk.providerName || risk.providerId || translate('Risk provider') }}
              <p>{{ seed.enumDescription(risk.riskLevelEnumId) }}</p>
              <template v-for="fact in risk.facts || []" :key="fact.factSeqId">
                <p>{{ fact.description }} · {{ seed.enumDescription(fact.sentimentEnumId) }}</p>
              </template>
            </ion-label>
            <ion-note slot="end">{{ formatDate(risk.createdDate) }}</ion-note>
          </ion-item>
        </ion-list>

        <ion-list v-else>
          <ion-item lines="none">
            <ion-label>{{ translate('No risk assessments for this order') }}</ion-label>
          </ion-item>
        </ion-list>
      </div>

      <div v-if="selectedSegment === 'comms'">
        <div v-if="commEvents.length">
          <div class="list-item comm-event-row" v-for="ev in commEvents" :key="ev.id">
            <ion-item lines="none">
              <ion-label>
                {{ ev.id }}
                <p>{{ translate("ID") }}</p>
              </ion-label>
            </ion-item>
            <div class="tablet">
              <ion-label class="ion-text-center">
                {{ ev.partyIdFrom || '-' }}
                <p>{{ translate("from") }}</p>
              </ion-label>
            </div>
            <div class="tablet">
              <ion-label class="ion-text-center">
                {{ ev.partyIdTo || '-' }}
                <p>{{ translate("to") }}</p>
              </ion-label>
            </div>
            <div class="tablet">
              <ion-label class="ion-text-center">
                {{ ev.content || '-' }}
                <p>{{ translate("content") }}</p>
              </ion-label>
            </div>
            <div class="tablet">
              <ion-label class="ion-text-center" v-if="ev.entryDate">
                {{ formatDate(ev.entryDate) }}
                <p>{{ translate("entry date") }}</p>
              </ion-label>
              <ion-label v-else>-</ion-label>
            </div>
          </div>
        </div>
        <ion-list v-if="!commEvents.length">
          <ion-item lines="none">
            <ion-label>{{ translate("No communication events for this order") }}</ion-label>
          </ion-item>
        </ion-list>
      </div>

    </ion-content>

    <ion-content v-else-if="loading">
      <ion-list>
        <ion-item lines="none">
          <ion-label>{{ translate('Loading order...') }}</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>

    <ion-content v-slot:default v-else-if="error">
      <ErrorState :title="translate('Order failed to load')" :message="error" />
    </ion-content>

    <ion-content v-else>
      <EmptyState :title="translate('Order not found')"
        :message="translate('The selected order is not available in this workspace.')" />
    </ion-content>

    <ion-footer v-if="order && selectedSegment === 'items'">
      <ion-toolbar>
        <!-- The footer is one engine-driven list (OrderActionValidator.getOrderFooterActions):
             status transitions (Approve, Cancel order, …) on the start, lifecycle actions
             (Cancel items, Clone, Return) on the end. Only VALID actions are present — an
             action that doesn't apply to the order simply isn't rendered. -->
        <ion-buttons slot="start">
          <ion-button v-for="action in footerActions.filter(a => a.kind === 'status')" :key="action.id"
            :color="action.color" :fill="action.fill" @click="runFooterAction(action)">
            {{ footerActionLabel(action) }}
          </ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button v-for="action in footerActions.filter(a => a.kind === 'footer')" :key="action.id"
            :color="action.color" :fill="action.fill" @click="runFooterAction(action)">
            {{ footerActionLabel(action) }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { IonAccordion, IonAccordionGroup, IonBackButton, IonBadge, IonButton, IonButtons, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonCheckbox, IonChip, IonContent, IonFab, IonFabButton, IonFooter, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonMenuButton, IonModal, IonNote, IonPage, IonPopover, IonProgressBar, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonTextarea, IonThumbnail, IonTitle, IonToolbar, alertController, modalController } from '@ionic/vue';
import { storeToRefs } from 'pinia';
import { DateTime } from 'luxon';
import { calendarOutline, checkmarkOutline, chevronDown, chevronUp, closeOutline, compassOutline, createOutline, cubeOutline, documentTextOutline, ellipsisVertical, giftOutline, informationCircleOutline, mailOutline, saveOutline, sendOutline, shieldOutline, ticketOutline } from 'ionicons/icons';
import { useOrderDetailStore } from '@/store/orderDetail';
import { useSeedStore } from '@/store/seed';
import { useProductCacheStore } from '@/store/productCache';
import { useProductMaster } from '@/composables/useProductMaster';
import EmptyState from '@/components/common/EmptyState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import AddItemToOrderModal from '@/components/orders/AddItemToOrderModal.vue';
import OrderItemListRow from '@/components/orders/OrderItemListRow.vue';
import RejectItemsModal from '@/components/orders/RejectItemsModal.vue';
import ProductInventoryModal from '@/components/inventory/ProductInventoryModal.vue';
import FacilityModal from '@/components/fulfillment/FacilityModal.vue';
import PhysicalFacilityModal from '@/components/fulfillment/PhysicalFacilityModal.vue';
import RoutingGroupModal from '@/components/fulfillment/RoutingGroupModal.vue';
import OrderItemAttributesModal from '@/components/orders/OrderItemAttributesModal.vue';
import ItemFacilityInventoryModal from '@/components/fulfillment/ItemFacilityInventoryModal.vue';
import AddOrderTaskModal from '@/components/tasks/AddOrderTaskModal.vue';
import BadAddressTaskCard from '@/components/tasks/BadAddressTaskCard.vue';
import SwapTaskCard from '@/components/tasks/SwapTaskCard.vue';
import FraudTaskCard from '@/components/tasks/FraudTaskCard.vue';
import HoldTaskCard from '@/components/tasks/HoldTaskCard.vue';
import CloneOrderModal from '@/components/orders/CloneOrderModal.vue';
import { api, commonUtil, DxpShopifyImg, translate, useSolrSearch } from '@common';
import { showToast, isKit, riskLevelColor } from '@/utils';
import { OrderActionValidator } from '@/utils/OrderActionValidator';
import { useOrderTaskStore } from '@/store/orderTask';
import { useUserStore } from '@/store/user';
import { useProductStore } from '@/store/productStore';

const props = defineProps<{
  orderId: string;
}>();

const orderDetailStore = useOrderDetailStore();
const seed = useSeedStore();
const productCache = useProductCacheStore();

const { isLoading: loading, error } = storeToRefs(orderDetailStore);

const productIdentificationPref = computed(() => useProductStore().getProductIdentificationPref);
/**
 * View model — adapts the raw order master-detail payload to the shape this template
 * already binds, joining IDs to labels through the seed store and product cache. The
 * template graph and CSS are unchanged; only the data feeding it is real now.
 */
const order = computed(() => {
  const raw = orderDetailStore.current;
  if (!raw) return null;

  return {
    orderName: raw.orderName,
    id: raw.orderId,
    externalId: raw.externalId,
    status: seed.statusDescription(raw.statusId),
    statusId: raw.statusId,
    channel: seed.enumDescription(raw.salesChannelEnumId),
    productStoreName: seed.productStoreName(raw.productStoreId),
    currency: raw.currencyUom,
    riskRecommendationEnumId: raw.riskRecommendationEnumId,
    riskLevelEnumId: raw.riskLevelEnumId,
    customerName: orderDetailStore.customerName,
    history: orderDetailStore.headerStatuses.map((entry: any) => ({
      id: entry.orderStatusId,
      label: seed.statusDescription(entry.statusId),
      detail: entry.statusUserLogin || '',
      changeReason: entry.changeReason || '',
      at: entry.statusDatetime
    })),
    identifications: (raw.identifications || []).map((identification: any) => ({
      orderIdentificationTypeId: identification.orderIdentificationTypeId,
      typeLabel: seed.orderIdentificationTypeDescription(identification.orderIdentificationTypeId),
      idValue: identification.idValue
    })),
    payments: (raw.paymentPreferences || []).map((payment: any) => ({
      id: payment.orderPaymentPreferenceId,
      paymentMethodTypeId: payment.paymentMethodTypeId,
      paymentMethodTypeDesc: seed.paymentMethodDescription(payment.paymentMethodTypeId),
      amount: payment.maxAmount ?? payment.presentmentAmount,
      statusId: payment.statusId,
      statusDesc: seed.statusDescription(payment.statusId)
    })),
    shipGroups: (raw.shipGroups || []).map((shipGroup: any) => ({
      id: shipGroup.shipGroupSeqId,
      facilityId: shipGroup.facilityId,
      facilityTypeId: seed.facility(shipGroup.facilityId)?.facilityTypeId,
      facilityParentTypeId: seed.facilityType(seed.facility(shipGroup.facilityId)?.facilityTypeId)?.parentTypeId,
      facilityName: seed.facilityName(shipGroup.facilityId),
      itemSummary: shipGroupItemSummary(shipGroup),
      isGift: shipGroup.isGift,
      giftMessage: shipGroup.giftMessage,
      shippingInstructions: shipGroup.shippingInstructions,
      estimatedShipDate: shipGroup.estimatedShipDate,
      estimatedDeliveryDate: shipGroup.estimatedDeliveryDate,
      shipAfterDate: shipGroup.shipAfterDate,
      shipByDate: shipGroup.shipByDate,
      picklistDate: shipGroup.picklistDate,
      shipmentMethodTypeId: shipGroup.shipmentMethodTypeId,
      method: shipGroup.shipmentMethodTypeId,
      carrier: shipGroup.carrierPartyId,
      contactMechId: shipGroup.contactMechId,
      items: (shipGroup.items || []).map((item: any) => {
        const product = productCache.getProduct(item.productId);
        // parentProductName is the product title ("Abominable Hoodie"); productName is the
        // variant ("XS / Blue", ~= itemDescription). Prefer the title, then variant, then id.
        return {
          id: item.orderItemSeqId,
          productId: item.productId,
          name: product?.parentProductName || product?.productName || item.itemDescription || item.productId,
          sku: product?.sku || item.productId,
          imageUrl: product?.mainImageUrl || '',
          quantity: item.quantity
        };
      })
    }))
  };
});

const customer = computed(() => {
  const raw = orderDetailStore.current;
  if (!raw) return undefined;
  const email = orderDetailStore.contactMechsByPurpose['ORDER_EMAIL']?.contactMech?.infoString;
  const telecomMech = (raw.contactMechs || []).find((mech: any) => mech.telecomNumber);
  const telecom = telecomMech?.telecomNumber;
  const phone = telecom
    ? [telecom.countryCode, telecom.areaCode, telecom.contactNumber].filter(Boolean).join(' ')
    : '';
  return { email, phone };
});

const billingAddress = computed(() => {
  const mech = orderDetailStore.contactMechsByPurpose['BILLING_LOCATION'];
  const lines = addressLines(mech?.postalAddress);
  return lines.length ? { lines } : undefined;
});

const timelineByShipGroup = computed(() => orderDetailStore.timelineByShipGroup);
const expandedShipGroupIds = ref<Set<string>>(new Set());

function isVirtualFacility(shipGroup: any): boolean {
  if (!shipGroup.facilityId) return true;
  return (
    shipGroup.facilityParentTypeId === 'VIRTUAL_FACILITY' ||
    shipGroup.facilityTypeId === 'VIRTUAL_FACILITY'
  );
}

function shipGroupProgress(shipGroup: any): number {
  const tl = timelineByShipGroup.value[shipGroup.id];
  if (!tl) return 0;
  let progress = 0;
  if (tl.firstBrokeredDate) progress += 0.25;
  if (tl.picklistDate) progress += 0.25;
  if (tl.packedDate) progress += 0.25;
  if (tl.shippedDate) progress += 0.25;
  return progress;
}

function isShipGroupExpanded(shipGroupId: string): boolean {
  return expandedShipGroupIds.value.has(shipGroupId);
}

function toggleShipGroup(shipGroupId: string) {
  const next = new Set(expandedShipGroupIds.value);
  if (next.has(shipGroupId)) {
    next.delete(shipGroupId);
  } else {
    next.add(shipGroupId);
  }
  expandedShipGroupIds.value = next;
}

function shipGroupHeaderTitle(shipGroup: any): string {
  return `${shipGroup.id} ${shipGroup.facilityName || translate('Facility Name')}`;
}

function shipGroupStatusLabel(shipGroup: any): string {
  if (isVirtualFacility(shipGroup)) return translate('Not Brokered');
  const progress = Math.round(shipGroupProgress(shipGroup) * 100);
  return progress > 0 ? `${progress}% ${translate('Complete')}` : translate('Brokered');
}

function hasSelectableShipGroupOptions(shipGroup: any): boolean {
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
  const carrier = availableCarriers.value.find((party: any) => party.partyId === carrierPartyId);
  return carrier ? [carrier.firstName, carrier.lastName].filter(Boolean).join(' ') || carrier.groupName || carrier.partyId : '';
}

function shippingMethodLabel(shipmentMethodTypeId: string): string {
  return shipmentMethodTypeId ? seed.shipmentMethodDescription(shipmentMethodTypeId) : '';
}

// ── Holds segment — order-scoped task cards ───────────────────────────────────
const orderAddressValidationTasks = computed(() => orderTaskStore.getOrderAddressValidationTasks);
const orderSwapTasks = computed(() => orderTaskStore.getOrderSwapTasks);
const orderFraudTasks = computed(() => orderTaskStore.getOrderFraudTasks);
const orderHoldTasks = computed(() => orderTaskStore.getOrderHoldTasks);
const hasOrderHoldTasks = computed(() =>
  orderAddressValidationTasks.value.length > 0
  || orderSwapTasks.value.length > 0
  || orderFraudTasks.value.length > 0
  || orderHoldTasks.value.length > 0
);

function reloadHoldTasks() {
  return orderTaskStore.fetchOrderHoldTasks(props.orderId);
}

const commEvents = computed(() => orderDetailStore.commEvents.map((ev: any) => ({
  id: ev.communicationEventId,
  partyIdFrom: ev.partyIdFrom,
  partyIdTo: ev.partyIdTo,
  content: ev.content,
  entryDate: ev.entryDate
})));

const selectedItemIds = ref<Set<string>>(new Set());

const groupedItems = computed(() => {
  if (!order.value) return [];

  const groups: Record<string, {
    externalId: string;
    productId: string;
    name: string;
    sku: string;
    unitPrice: number;
    currency: string;
    totalQty: number;
    totalPrice: number;
    status: string;
    selected: boolean;
    items: Array<{
      orderItemSeqId: string;
      externalId: string;
      shipGroupSeqId: string;
      facilityId: string;
      facilityName: string;
      quantity: number;
      statusId: string;
      status: string;
      selected: boolean;
      unitPrice: number;
      returnedQty: number;
      returnableQty: number;
      attributes: any[];
      attributeCount: number;
      adjustments: Array<{ comment: string; amount: number }>;
    }>;
  }> = {};

  (order.value.shipGroups || []).forEach((sg: any) => {
    (sg.items || []).forEach((item: any) => {
      const rawSg = orderDetailStore.current?.shipGroups?.find((g: any) => g.shipGroupSeqId === sg.id);
      const rawItem = rawSg?.items?.find((i: any) => i.orderItemSeqId === item.id);

      const externalId = rawItem?.externalId || item.sku || item.id;
      const unitPrice = Number(rawItem?.unitPrice || 0);
      const statusId = rawItem?.statusId || '';
      const status = seed.statusDescription(statusId);
      const returnedQty = orderDetailStore.returnedQtyByItemSeqId[item.id] || 0;
      const returnableQty = Math.max(0, Number(item.quantity || 0) - returnedQty);

      if (!groups[externalId]) {
        groups[externalId] = {
          externalId,
          productId: rawItem?.productId || '',
          name: item.name,
          sku: item.sku,
          unitPrice,
          currency: order.value.currency,
          totalQty: orderDetailStore.quantitiesByExternalId[externalId] || 0,
          totalPrice: orderDetailStore.totalsByExternalId[externalId] || 0,
          status,
          statusId,
          get selected() { return this.items.length > 0 && this.items.every((i: any) => selectedItemIds.value.has(i.orderItemSeqId)); },
          set selected(v: boolean) { this.items.forEach((i: any) => v ? selectedItemIds.value.add(i.orderItemSeqId) : selectedItemIds.value.delete(i.orderItemSeqId)); },
          items: []
        };
      }
      groups[externalId].items.push({
        orderItemSeqId: item.id,
        externalId,
        shipGroupSeqId: sg.id,
        facilityId: sg.facilityId || '',
        facilityName: sg.facilityName || 'Facility',
        quantity: item.quantity,
        statusId,
        status,
        get selected() { return selectedItemIds.value.has(item.id); },
        set selected(v: boolean) { v ? selectedItemIds.value.add(item.id) : selectedItemIds.value.delete(item.id); },
        unitPrice,
        returnedQty,
        returnableQty,
        attributes: rawItem?.orderItemAttributes || rawItem?.attributes || rawItem?.orderItemAttributeList || [],
        attributeCount: rawItem?.orderItemAttributes?.length || rawItem?.attributes?.length || rawItem?.orderItemAttributeList?.length || 0,
        adjustments: itemAdjustmentSummaries(rawItem, item.id)
      });
    });
  });

  return Object.values(groups);
});

const orderTotals = computed(() => orderDetailStore.totals);

const riskAssessments = computed(() => orderDetailStore.riskAssessments);
const riskAssessmentsStatus = computed(() => orderDetailStore.riskAssessmentsStatus);
const riskAssessmentsError = computed(() => orderDetailStore.riskAssessmentsError);

const riskSummary = computed(() => {
  const recommendationEnumId = order.value?.riskRecommendationEnumId || '';
  const levelEnumId = order.value?.riskLevelEnumId || '';

  return {
    hasRiskSignal: Boolean(recommendationEnumId || levelEnumId),
    recommendation: recommendationEnumId ? seed.enumDescription(recommendationEnumId) : translate('No recommendation'),
    level: levelEnumId ? seed.enumDescription(levelEnumId) : translate('No risk level')
  };
});

const paymentReceivedTotal = computed(() =>
  (order.value?.payments || []).reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0)
);

const orderAdjustmentRows = computed(() =>
  Object.entries(orderTotals.value.adjustments)
    .map(([typeId, amount]) => ({
      label: seed.orderAdjustmentTypeDescription(typeId) || typeId,
      detail: shippingAdjustmentDetail(typeId),
      amount: Number(amount)
    }))
    .filter((row) => row.amount !== 0)
);

const selectedSegment = ref('items');

watch(selectedSegment, (segment) => {
  if (!props.orderId) return;
  if (segment === 'holds') {
    orderTaskStore.fetchOrderHoldTasks(props.orderId);
  }
  if (segment === 'risk') orderDetailStore.fetchRiskAssessments(props.orderId);
  if (segment === 'comms') orderDetailStore.fetchCommEvents(props.orderId);
});

const areAllSelected = computed(() => {
  if (!groupedItems.value.length) return false;
  return groupedItems.value.every(group =>
    group.items.every(item => selectedItemIds.value.has(item.orderItemSeqId))
  );
});

const selectedItems = computed(() =>
  groupedItems.value.flatMap(group =>
    group.items.filter(item => selectedItemIds.value.has(item.orderItemSeqId))
  )
);

function toggleSelectAll(checked: boolean) {
  if (checked) {
    groupedItems.value.forEach(group =>
      group.items.forEach(item => selectedItemIds.value.add(item.orderItemSeqId))
    );
  } else {
    selectedItemIds.value.clear();
  }
}

function getProduct(productId: string) {
  return useProductCacheStore().getProduct(productId);
}

function shipGroupProductIdentification(identificationPref: string, item: any): string {
  const product = getProduct(item.productId);
  return product ? commonUtil.getProductIdentificationValue(identificationPref, product) : '';
}

onMounted(() => loadOrder(props.orderId));
watch(() => props.orderId, (orderId) => loadOrder(orderId));

async function loadOrder(orderId: string, force = false) {
  if (force) {
    await orderDetailStore.fetchOrder(orderId, true);
  } else {
    await orderDetailStore.setCurrentOrder(orderId);
  }
  // Rich product data (name/SKU/image): fetch only uncached products, never refetch.
  useProductMaster().init();
  await useProductMaster().prefetch(orderDetailStore.allItems.map((item: any) => item.productId));
  // Fetch shipping methods and carriers (not order-specific, fetch once)
  await Promise.all([
    orderDetailStore.fetchShippingMethods(),
    orderDetailStore.fetchCarrierParties(),
  ]);
}

const availableCarriers = computed(() =>
  [...orderDetailStore.carrierParties].sort((a, b) => {
    const nameA = ([a.firstName, a.lastName].filter(Boolean).join(' ') || a.groupName || a.partyId).toLowerCase();
    const nameB = ([b.firstName, b.lastName].filter(Boolean).join(' ') || b.groupName || b.partyId).toLowerCase();
    return nameA.localeCompare(nameB);
  })
);

// Local reactive selection state per ship group — keyed by shipGroupSeqId.
// This allows the carrier/method dropdowns to update immediately without waiting
// for the API round-trip + loadOrder.
const shipGroupSelection = ref<Record<string, { carrierId: string; methodId: string }>>({});

// Item checkbox selection per ship group — keyed by shipGroupSeqId, value is Set of item ids.
const selectedShipGroupItems = ref<Record<string, Set<string>>>({});

function isItemSelected(shipGroupId: string, itemId: string) {
  return selectedShipGroupItems.value[shipGroupId]?.has(itemId) ?? false;
}

function toggleItemSelection(shipGroupId: string, itemId: string, checked: boolean) {
  if (!selectedShipGroupItems.value[shipGroupId]) {
    selectedShipGroupItems.value[shipGroupId] = new Set();
  }
  if (checked) {
    selectedShipGroupItems.value[shipGroupId].add(itemId);
  } else {
    selectedShipGroupItems.value[shipGroupId].delete(itemId);
  }
}

function selectedItemsForShipGroup(shipGroupId: string): string[] {
  return Array.from(selectedShipGroupItems.value[shipGroupId] ?? []);
}

function getSelection(shipGroupId: string, shipGroup: any) {
  if (!shipGroupSelection.value[shipGroupId]) {
    shipGroupSelection.value[shipGroupId] = {
      carrierId: shipGroup.carrier ?? '',
      methodId: shipGroup.shipmentMethodTypeId ?? '',
    };
  }
  return shipGroupSelection.value[shipGroupId];
}

const shipGroupDistances = ref<Record<string, string>>({});

/** Great-circle distance between two lat/lon points, in miles. */
function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const num = (value: any): number | undefined => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Resolve postal codes to coordinates via the Solr `postalCode` core (fields:
 * postcode / latitude / longitude). Returns a { zip: {lat, lon} } map. Only the
 * customer ship-to zip needs this — the origin facility exposes its own
 * lat/lon directly (see fetchDistancesForOrder).
 */
async function lookupPostalCoordinates(zips: string[]): Promise<Record<string, { lat: number; lon: number }>> {
  const coords: Record<string, { lat: number; lon: number }> = {};
  if (!zips.length) return coords;
  try {
    const { runSolrQuery } = useSolrSearch();
    const resp = await runSolrQuery({
      coreName: 'postalCode',
      json: {
        query: `postcode:(${zips.map((zip) => `"${zip}"`).join(' OR ')})`,
        params: { rows: zips.length, fl: 'postcode,latitude,longitude' }
      }
    });
    (resp?.data?.response?.docs ?? []).forEach((doc: any) => {
      const zip = String(doc.postcode ?? '').trim();
      const lat = num(doc.latitude);
      const lon = num(doc.longitude);
      if (zip && lat !== undefined && lon !== undefined) coords[zip] = { lat, lon };
    });
  } catch (error) {
    console.error('Failed to look up postal-code coordinates from Solr:', error);
  }
  return coords;
}

/** Origin facility coordinates from its postal address (lat/lon are returned
 *  directly by facilityContactMechs); falls back to the facility's zip for a
 *  Solr lookup when the address isn't geocoded. Deduped per facilityId. */
async function fetchFacilityOrigins(facilityIds: string[]): Promise<Record<string, { lat?: number; lon?: number; zip?: string }>> {
  const origins: Record<string, { lat?: number; lon?: number; zip?: string }> = {};
  await Promise.all(facilityIds.map(async (facilityId) => {
    try {
      const resp = await api({ url: 'oms/facilityContactMechs', method: 'GET', params: { facilityId } });
      const mechs: any[] = resp?.data?.facilityContactMechs ?? [];
      const postal = mechs.find((m) => m.contactMechTypeId === 'POSTAL_ADDRESS' && m.contactMechPurposeTypeId === 'SHIP_ORIG_LOCATION')
        || mechs.find((m) => m.contactMechTypeId === 'POSTAL_ADDRESS');
      if (postal) origins[facilityId] = { lat: num(postal.latitude), lon: num(postal.longitude), zip: postal.postalCode?.trim() };
    } catch (error) {
      console.error(`Failed to load origin address for facility ${facilityId}:`, error);
    }
  }));
  return origins;
}

/**
 * Distance (miles) between each BROKERED ship group's origin facility and the
 * order's ship-to address. Origin coordinates come straight from the facility's
 * postal address; the customer ship-to is geocoded from its zip via Solr.
 */
const fetchDistancesForOrder = async (shipGroups: any[]) => {
  shipGroupDistances.value = {};
  const brokered = (shipGroups || []).filter((sg: any) => !isVirtualFacility(sg) && sg.facilityId);
  if (!brokered.length) return;

  const origins = await fetchFacilityOrigins([...new Set(brokered.map((sg: any) => sg.facilityId))]);

  // Collect zips needing a Solr lookup: every ship-to zip, plus any origin
  // facility that wasn't geocoded (fall back to its zip).
  const destZipBySg: Record<string, string> = {};
  const zipsToLookup = new Set<string>();
  brokered.forEach((sg: any) => {
    const mech = sg.contactMechId
      ? orderDetailStore.contactMechsById[sg.contactMechId]
      : orderDetailStore.contactMechsByPurpose['SHIPPING_LOCATION'];
    const destZip = mech?.postalAddress?.postalCode?.trim();
    if (destZip) {
      destZipBySg[sg.id] = destZip;
      zipsToLookup.add(destZip);
    }
    const origin = origins[sg.facilityId];
    if (origin && (origin.lat === undefined || origin.lon === undefined) && origin.zip) {
      zipsToLookup.add(origin.zip);
    }
  });

  const zipCoords = await lookupPostalCoordinates([...zipsToLookup]);

  brokered.forEach((sg: any) => {
    const origin = origins[sg.facilityId];
    const originCoords = origin && origin.lat !== undefined && origin.lon !== undefined
      ? { lat: origin.lat, lon: origin.lon }
      : (origin?.zip ? zipCoords[origin.zip] : undefined);
    const destCoords = zipCoords[destZipBySg[sg.id]];
    if (originCoords && destCoords) {
      shipGroupDistances.value[sg.id] = haversineMiles(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon).toFixed(1);
    }
  });
};

// Keep local state in sync when order reloads (e.g. after save)
watch(
  () => order.value?.shipGroups,
  (shipGroups) => {
    (shipGroups || []).forEach((sg: any) => {
      shipGroupSelection.value[sg.id] = {
        carrierId: sg.carrier ?? '',
        methodId: sg.shipmentMethodTypeId ?? '',
      };
    });
    fetchDistancesForOrder(shipGroups);
  },
  { immediate: true }
);

function methodsForCarrier(carrierPartyId: string) {
  return [...orderDetailStore.shippingMethodsByCarrier(carrierPartyId)].sort((a, b) =>
    Number(a.sequenceNumber ?? Infinity) - Number(b.sequenceNumber ?? Infinity)
  );
}

async function onCarrierChange(shipGroupId: string, carrierPartyId: string) {
  // Immediately update local state so methods dropdown re-renders with new carrier's methods
  // and method resets to empty (shows placeholder)
  shipGroupSelection.value[shipGroupId] = { carrierId: carrierPartyId, methodId: '' };
}

async function onMethodChange(shipGroupId: string, shipmentMethodTypeId: string) {
  const sel = shipGroupSelection.value[shipGroupId];
  if (!sel?.carrierId || !shipmentMethodTypeId) return;
  sel.methodId = shipmentMethodTypeId;
  await saveCarrierAndMethod(shipGroupId, shipmentMethodTypeId, sel.carrierId);
}

async function saveCarrierAndMethod(shipGroupSeqId: string, shipmentMethodTypeId: string, carrierPartyId: string) {
  try {
    await orderDetailStore.updateShipmentCarrierAndMethod(order.value!.id, shipGroupSeqId, shipmentMethodTypeId, carrierPartyId);
    await showToast(translate('Carrier and shipping method updated successfully.'));
    await loadOrder(order.value!.id, true);
  } catch {
    await showToast(translate('Failed to update carrier and shipping method. Please try again.'));
  }
}

// ── Ship group attribute chips ────────────────────────────────────────────────

async function updateShipGroup(shipGroupId: string, payload: Record<string, any>) {
  await api({
    url: `oms/orders/${order.value!.id}/shipGroups/${shipGroupId}`,
    method: 'PUT',
    data: payload,
  });
  await loadOrder(order.value!.id, true);
}

// Gift message
const giftModalShipGroupId = ref<string | null>(null);
const giftMessageDraft = ref('');

function openGiftModal(shipGroup: any) {
  giftMessageDraft.value = shipGroup.giftMessage ?? '';
  giftModalShipGroupId.value = shipGroup.id;
}

async function saveGiftMessage(shipGroup: any) {
  try {
    await updateShipGroup(shipGroup.id, { giftMessage: giftMessageDraft.value });
    giftModalShipGroupId.value = null;
    await showToast(translate('Gift message saved.'));
  } catch {
    await showToast(translate('Failed to save gift message.'));
  }
}

// 3. Shipping dates
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
    await updateShipGroup(shipGroup.id, {
      shipAfterDate: shippingDatesDraft.value.shipAfterDate || null,
      shipByDate: shippingDatesDraft.value.shipByDate || null,
    });
    shippingDatesModalShipGroupId.value = null;
    await showToast(translate('Shipping dates saved.'));
  } catch {
    await showToast(translate('Failed to save shipping dates.'));
  }
}

// 4. Delivery dates
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
    await updateShipGroup(shipGroup.id, {
      estimatedShipDate: deliveryDatesDraft.value.estimatedShipDate || null,
      estimatedDeliveryDate: deliveryDatesDraft.value.estimatedDeliveryDate || null,
    });
    deliveryDatesModalShipGroupId.value = null;
    await showToast(translate('Delivery dates saved.'));
  } catch {
    await showToast(translate('Failed to save delivery dates.'));
  }
}

// 5. Instruction
const instructionModalShipGroupId = ref<string | null>(null);
const instructionDraft = ref('');

function openInstructionModal(shipGroup: any) {
  instructionDraft.value = shipGroup.shippingInstructions ?? '';
  instructionModalShipGroupId.value = shipGroup.id;
}

async function saveInstruction(shipGroup: any) {
  try {
    await updateShipGroup(shipGroup.id, { shippingInstructions: instructionDraft.value });
    instructionModalShipGroupId.value = null;
    await showToast(translate('Instructions saved.'));
  } catch {
    await showToast(translate('Failed to save instructions.'));
  }
}

/** Convert a timestamp/ISO string to YYYY-MM-DD for <ion-input type="date"> */
function toDateInputValue(value: any): string {
  if (!value) return '';
  const dt = /^\d+$/.test(String(value))
    ? DateTime.fromMillis(Number(value))
    : DateTime.fromISO(String(value));
  return dt.isValid ? dt.toISODate() ?? '' : '';
}

// ── Shipping address display & edit ──────────────────────────────────────────

function shippingAddressLines(shipGroup: any): string[] {
  const mech = shipGroup.contactMechId
    ? orderDetailStore.contactMechsById[shipGroup.contactMechId]
    : orderDetailStore.contactMechsByPurpose['SHIPPING_LOCATION'];
  return addressLines(mech?.postalAddress);
}

/**
 * Compact 3-line address for the ship-group card: name / street (address line 1
 * & 2) / locality (city, zip, state, country). Returns null when no address.
 */
function shippingAddressView(shipGroup: any): { name: string; street: string; locality: string } | null {
  const mech = shipGroup.contactMechId
    ? orderDetailStore.contactMechsById[shipGroup.contactMechId]
    : orderDetailStore.contactMechsByPurpose['SHIPPING_LOCATION'];
  const addr = mech?.postalAddress;
  if (!addr) return null;
  return {
    name: addr.toName || '',
    street: [addr.address1, addr.address2].filter(Boolean).join(', '),
    locality: [addr.city, addr.postalCode, seed.geoName(addr.stateProvinceGeoId), seed.geoName(addr.countryGeoId)].filter(Boolean).join(', ')
  };
}

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
  const mech = shipGroup.contactMechId
    ? orderDetailStore.contactMechsById[shipGroup.contactMechId]
    : orderDetailStore.contactMechsByPurpose['SHIPPING_LOCATION'];
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
  if (!order.value) return;
  savingShippingAddress.value = true;
  try {
    await orderTaskStore.updateShippingInformation(order.value.id, shipGroup.id, {
      ...shippingAddressForm.value,
      contactMechPurposeTypeId: 'SHIPPING_LOCATION',
      isEdited: true,
    });
    await showToast(translate('Shipping address updated successfully.'));
    closeEditShippingAddress();
    await loadOrder(order.value.id, true);
  } catch {
    await showToast(translate('Failed to update shipping address. Please try again.'));
  } finally {
    savingShippingAddress.value = false;
  }
}

function shipGroupItemSummary(shipGroup: any) {
  const items = shipGroup.items || [];
  const units = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
  return `${items.length} ${items.length === 1 ? 'item' : 'items'} · ${units} ${units === 1 ? 'unit' : 'units'}`;
}

function addressLines(postalAddress: any): string[] {
  if (!postalAddress) return [];
  return [
    postalAddress.toName,
    postalAddress.address1,
    postalAddress.address2,
    [postalAddress.city, seed.geoName(postalAddress.stateProvinceGeoId), postalAddress.postalCode].filter(Boolean).join(', '),
    seed.geoName(postalAddress.countryGeoId)
  ].filter(Boolean) as string[];
}

function money(value: number, currency = 'USD') {
  return commonUtil.formatCurrency(value, currency);
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

function getGroupAdjustments(group: any) {
  const adjs = orderDetailStore.adjustmentsByExternalId[group.externalId] || {};
  return Object.entries(adjs)
    .map(([comment, amount]) => ({ comment, amount: Number(amount) }))
    .filter(adj => adj.amount !== 0);
}

function groupPrimaryIdentifier(group: any): string {
  return commonUtil.getProductIdentificationValue(productIdentificationPref.value.primaryId, getProduct(group.productId) || {})
    || group.name
    || group.externalId;
}

function groupSecondaryIdentifier(group: any): string {
  return commonUtil.getProductIdentificationValue(productIdentificationPref.value.secondaryId, getProduct(group.productId) || {})
    || group.externalId;
}

function getGroupAdjustmentRows(group: any): Array<{ label: string; amount: string }> {
  return getGroupAdjustments(group).map((adjustment) => ({
    label: adjustment.comment,
    amount: money(adjustment.amount, order.value?.currency || 'USD')
  }));
}

function getItemAdjustmentRows(item: any): Array<{ label: string; amount: string }> {
  return (item.adjustments || []).map((adjustment: any) => ({
    label: adjustment.comment,
    amount: money(adjustment.amount, order.value?.currency || 'USD')
  }));
}

function itemStatusDetail(item: any): string {
  return item.shipGroupSeqId ? `${translate('#')}${item.shipGroupSeqId}` : '';
}

function itemLineTotal(item: any): number {
  return Number(item.unitPrice || 0) * Number(item.quantity || 0);
}

function attributeChipLabel(count: number): string {
  return `${count || 0} ${Number(count) === 1 ? translate('attribute') : translate('attributes')}`;
}

function itemAdjustmentLabel(adj: any): string {
  return adj.comments || adj.comment || adj.description || adj.orderAdjustmentTypeId || translate('Adjustment');
}

function itemAdjustmentKey(adj: any, fallbackSeqId = ""): string {
  return adj.orderAdjustmentId || [
    fallbackSeqId || adj.orderItemSeqId || "",
    adj.shipGroupSeqId || "",
    adj.orderAdjustmentTypeId || "",
    itemAdjustmentLabel(adj),
    Number(adj.amount || 0)
  ].join("|");
}

function itemAdjustmentSummaries(rawItem: any, orderItemSeqId: string): Array<{ comment: string; amount: number }> {
  const totals: Record<string, number> = {};
  const seen = new Set<string>();
  const adjustments = [
    ...(orderDetailStore.current?.adjustments || []).filter((adj: any) => adj.orderItemSeqId === orderItemSeqId),
    ...(rawItem?.adjustments || [])
  ];

  adjustments.forEach((adj: any) => {
    const key = itemAdjustmentKey(adj, orderItemSeqId);
    if (seen.has(key)) return;
    seen.add(key);
    const comment = itemAdjustmentLabel(adj);
    totals[comment] = (totals[comment] || 0) + Number(adj.amount || 0);
  });

  return Object.entries(totals)
    .filter(([, amount]) => Number(amount) !== 0)
    .map(([comment, amount]) => ({ comment, amount: Number(amount) }));
}

function shippingAdjustmentDetail(typeId: string): string {
  if (!typeId || !/shipping/i.test(typeId)) return '';
  const methods = new Set(
    (order.value?.shipGroups || [])
      .map((shipGroup: any) => shippingMethodLabel(shipGroup.shipmentMethodTypeId))
      .filter(Boolean)
  );
  return Array.from(methods).join(', ');
}

const orderTaskStore = useOrderTaskStore();
const userStore = useUserStore();

async function openFacilityModal(): Promise<string | null> {
  const modal = await modalController.create({ component: FacilityModal });
  await modal.present();
  const { data: facilityId } = await modal.onWillDismiss();
  return facilityId ?? null;
}

async function openAddItemFromItemsSegment() {
  const shipGroups = order.value?.shipGroups || [];
  if (!shipGroups.length) {
    await showToast(translate('No ship groups are available for this order.'));
    return;
  }

  if (shipGroups.length === 1) {
    await openAddItemModal(shipGroups[0]);
    return;
  }

  let selectedShipGroup: any = null;
  const alert = await alertController.create({
    header: translate('Select ship group'),
    buttons: [
      ...shipGroups.map((shipGroup: any) => ({
        text: shipGroupHeaderTitle(shipGroup),
        handler: () => {
          selectedShipGroup = shipGroup;
        }
      })),
      { text: translate('Cancel'), role: 'cancel' }
    ]
  });

  await alert.present();
  await alert.onDidDismiss();

  if (selectedShipGroup) await openAddItemModal(selectedShipGroup);
}

async function openItemAttributesModal(item: any) {
  const modal = await modalController.create({
    component: OrderItemAttributesModal,
    componentProps: {
      orderId: order.value!.id,
      orderItemSeqId: item.orderItemSeqId,
      attributes: item.attributes
    }
  });
  await modal.present();
}

async function brokerShipGroup(shipGroupSeqId: string) {
  const productStoreId = useProductStore().getCurrentProductStore.productStoreId;
  const modal = await modalController.create({ component: RoutingGroupModal, componentProps: { productStoreId } });
  await modal.present();
  const { data: routingGroupId } = await modal.onWillDismiss();
  if (!routingGroupId) return;
  try {
    await orderTaskStore.brokerShipGroup({ routingGroupId, orderId: order.value!.id, shipGroupSeqId, productStoreId });
    await showToast(translate('Ship group brokered successfully.'));
    await loadOrder(order.value!.id, true);
  } catch {
    await showToast(translate('Failed to broker the ship group. Please try again.'));
  }
}

async function parkShipGroup(shipGroupSeqId: string) {
  const facilityId = await openFacilityModal();
  if (!facilityId) return;
  try {
    await orderTaskStore.parkOrder(order.value!.id, shipGroupSeqId, facilityId);
    await showToast(translate('Ship group successfully moved to parking.'));
    await loadOrder(order.value!.id, true);
  } catch {
    await showToast(translate('Failed to park the ship group. Please try again.'));
  }
}

async function cancelOrderItems() {
  const raw = orderDetailStore.current;
  if (!raw || !selectedItems.value.length) return;
  const itemsSnapshot = [...selectedItems.value];
  const alert = await alertController.create({
    header: translate('Cancel items'),
    message: translate('Are you sure you want to cancel the {count} selected item(s)? This action cannot be undone.').replace('{count}', String(itemsSnapshot.length)),
    buttons: [
      { text: translate('No'), role: 'cancel' },
      {
        text: translate('Yes'),
        role: 'confirm',
        handler: async () => {
          try {
            await orderTaskStore.cancelOrder(raw.orderId, itemsSnapshot.map((item: any) => ({
              orderItemSeqId: item.orderItemSeqId,
              shipGroupSeqId: item.shipGroupSeqId,
              reason: "NO_VARIANCE_LOG",
              comment: ""
            })));
            selectedItemIds.value.clear();
            await showToast(translate('Selected items cancelled successfully.'));
            await loadOrder(raw.orderId, true);
          } catch {
            await showToast(translate('Failed to cancel the selected items. Please try again.'));
          }
        }
      }
    ]
  });
  await alert.present();
}

async function rejectAndReleaseItem(item: any, productId: string) {
  const orderId = order.value!.id;

  // Step 1 — reject (pull back) the item with hardcoded reason
  try {
    await api({
      url: `oms/orders/${orderId}/reject`,
      method: 'POST',
      data: {
        orderId,
        items: [{
          orderItemSeqId: item.orderItemSeqId,
          quantity: '1',
          rejectionReasonId: 'NO_VARIANCE_LOG',
        }],
      },
    });
  } catch {
    await showToast(translate('Failed to reject the item. Please try again.'));
    return;
  }

  // Step 2 — pick a facility with inventory to release to
  const facilityModal = await modalController.create({
    component: ItemFacilityInventoryModal,
    componentProps: { productId, productStoreId: orderDetailStore.current?.productStoreId },
    cssClass: 'item-facility-inventory-modal'
  });
  await facilityModal.present();
  const { data: facilityId } = await facilityModal.onWillDismiss();
  if (!facilityId) {
    // Rejected but no facility chosen — still refresh
    await loadOrder(orderId, true);
    return;
  }

  // Step 3 — release to chosen facility
  try {
    await api({
      url: `oms/orders/${orderId}/items/${item.orderItemSeqId}/allocation`,
      method: 'POST',
      data: { facilityId },
    });
    await showToast(translate('Item released to facility.'));
  } catch {
    await showToast(translate('Failed to release the item. Please try again.'));
  } finally {
    await loadOrder(orderId, true);
  }
}

async function cancelSingleItem(item: any) {
  const raw = orderDetailStore.current;
  if (!raw) return;
  const alert = await alertController.create({
    header: translate('Cancel Item'),
    message: translate('Are you sure you want to cancel this item? This action cannot be undone.'),
    buttons: [
      { text: translate('No'), role: 'cancel' },
      {
        text: translate('Yes'),
        role: 'confirm',
        handler: async () => {
          try {
            await orderTaskStore.cancelOrder(raw.orderId, [{
              orderItemSeqId: item.orderItemSeqId,
              shipGroupSeqId: item.shipGroupSeqId,
              reason: "NO_VARIANCE_LOG",
              comment: ""
            }]);
            await showToast(translate('Item cancelled successfully.'));
            await loadOrder(raw.orderId, true);
          } catch {
            await showToast(translate('Failed to cancel the item. Please try again.'));
          }
        }
      }
    ]
  });
  await alert.present();
}

async function parkFullOrder() {
  const facilityId = await openFacilityModal();
  if (!facilityId) return;
  try {
    await orderTaskStore.parkOrderFull(order.value!.id, facilityId);
    await showToast(translate('Order successfully moved to parking.'));
    await loadOrder(order.value!.id, true);
  } catch {
    await showToast(translate('Failed to park the order. Please try again.'));
  }
}

async function viewInventory(productId: string) {
  const modal = await modalController.create({
    component: ProductInventoryModal,
    componentProps: { productId }
  });
  await modal.present();
}

async function openCloneOrderModal() {
  const modal = await modalController.create({ component: CloneOrderModal });
  await modal.present();
  const { data, role } = await modal.onWillDismiss();
  if (role !== 'confirm' || !data) return;
  // Success feedback (toast with the new Shopify order name) is shown by the modal.
  // No reload — the cloned order lives in Shopify until the bridge syncs it back.
}

/**
 * The footer's complete, valid-only action set — ONE engine-driven list
 * (status transitions + lifecycle actions). The engine reports which actions
 * are valid for this order; we render only those we have a handler wired for
 * (Appeasement/Reship are modelled but excluded until their backend lands).
 * So a button that doesn't apply — e.g. Return on a not-yet-fulfilled order —
 * simply isn't shown.
 */
const DISPATCHABLE_FOOTER_IDS = new Set(['CLONE', 'CANCEL_ITEMS', 'RETURN']);
const footerActions = computed(() => {
  if (!order.value) return [];
  const allowedTransitions = seed.allowedTransitions(order.value.statusId);
  const ctx = {
    allItems: groupedItems.value.flatMap((group: any) => group.items),
    orderAllowedToStatusIds: new Set(allowedTransitions.map((transition: any) => transition.toStatusId))
  };
  return OrderActionValidator
    .getOrderFooterActions(order.value, allowedTransitions, selectedItems.value, ctx)
    .filter((action: any) => action.kind === 'status' || DISPATCHABLE_FOOTER_IDS.has(action.id));
});

function runFooterAction(action: any) {
  // Dispatch by id (not kind) — the cancel button rides on the start as
  // kind 'status' in both modes, but CANCEL_ITEMS has its own handler.
  switch (action.id) {
    case 'CLONE': return openCloneOrderModal();
    case 'CANCEL_ITEMS': return cancelOrderItems();
    case 'RETURN': return startReturn();
    default: return runOrderStatusAction(action); // status transitions (Approve, Cancel order, …)
  }
}

/** The morphing cancel shows its live selection count; everything else is a static label. */
function footerActionLabel(action: any): string {
  if (action.id === 'CANCEL_ITEMS') {
    return translate('Cancel {count} items').replace('{count}', String(selectedItems.value.length));
  }
  return translate(action.label);
}

async function startReturn() {
  // Returns are a separate workstream (docs/ReturnsMigrationExecution.md); this
  // button only appears once the order has a completed (returnable) item.
  await showToast(translate('Returns are not available here yet.'));
}

async function runOrderStatusAction(action: any) {
  if (!order.value) return;
  const orderId = order.value.id;
  // Destructive transitions (cancel/reject) confirm first; approve is direct.
  if (action.color === 'danger') {
    const alert = await alertController.create({
      header: translate(action.label),
      message: translate("Are you sure you want to change this order's status?"),
      buttons: [
        { text: translate('No'), role: 'cancel' },
        { text: translate('Yes'), role: 'confirm', handler: () => { changeOrderStatus(orderId, action.toStatusId); } }
      ]
    });
    await alert.present();
    return;
  }
  await changeOrderStatus(orderId, action.toStatusId);
}

async function changeOrderStatus(orderId: string, statusId: string) {
  try {
    await api({
      url: `oms/orders/${orderId}/status`,
      method: 'POST',
      data: { orderId, statusId, setItemStatus: true }
    });
    await showToast(translate('Order status updated successfully.'));
    await loadOrder(orderId, true);
  } catch {
    await showToast(translate('Failed to update the order status. Please try again.'));
  }
}

async function openAddTaskModal(shipGroup: any) {
  const modal = await modalController.create({ component: AddOrderTaskModal });
  await modal.present();
  const { data, role } = await modal.onWillDismiss();
  if (role !== 'confirm' || !data) return;
  try {
    await api({
      url: 'oms/orders/tasks',
      method: 'POST',
      data: [{
        orderId: order.value!.id,
        shipGroupSeqId: shipGroup.id,
        workEffortName: data.workEffortName,
        workEffortTypeId: data.workEffortTypeId,
        workEffortPurposeTypeId: data.workEffortPurposeTypeId,
        description: data.description,
        statusId: 'TASK_CREATED'
      }]
    });
    await showToast(translate('Tasks created successfully.'));
  } catch {
    await showToast(translate('Failed to create tasks. Please try again.'));
  }
}

async function openAddItemModal(shipGroup: any) {
  const modal = await modalController.create({
    component: AddItemToOrderModal,
    componentProps: { orderId: order.value!.id, shipGroupSeqId: shipGroup.id, onItemAdded: () => loadOrder(order.value!.id) },
  });
  await modal.present();
  const { role } = await modal.onWillDismiss();
  if (role === 'confirm') {
    await loadOrder(order.value!.id, true);
  }
}

async function openPhysicalFacilityModal(): Promise<string | null> {
  const modal = await modalController.create({ component: PhysicalFacilityModal });
  await modal.present();
  const { data: facilityId } = await modal.onWillDismiss();
  return facilityId ?? null;
}

async function parkSelectedItems(shipGroup: any) {
  const itemIds = selectedItemsForShipGroup(shipGroup.id);
  if (!itemIds.length) return;
  const facilityId = await openFacilityModal();
  if (!facilityId) return;
  const orderId = order.value!.id;
  try {
    await Promise.all(
      itemIds.map((orderItemSeqId) =>
        api({
        url: `oms/orders/${orderId}/moveItemToParking`,
        method: 'POST',
        data: { orderId, orderItemSeqId, shipGroupSeqId: shipGroup.id, toFacilityId: facilityId },
        })
      )
    );
    selectedShipGroupItems.value[shipGroup.id] = new Set();
    await showToast(translate('Selected items moved to parking.'));
    await loadOrder(orderId, true);
  } catch {
    await showToast(translate('Failed to park selected items. Please try again.'));
  }
}

async function rejectSelectedItems(shipGroup: any) {
  const itemIds = selectedItemsForShipGroup(shipGroup.id);
  if (!itemIds.length) return;

  const modal = await modalController.create({ component: RejectItemsModal });
  await modal.present();
  const { data, role } = await modal.onWillDismiss();
  if (role !== 'confirm') return;

  const rejectionReasonId = data?.rejectionReasonId;
  const orderId = order.value!.id;
  try {
    await api({
      url: `oms/orders/${orderId}/reject`,
      method: 'POST',
      data: {
        orderId,
        items: itemIds.map((orderItemSeqId) => ({
          orderItemSeqId,
          quantity: '1',
          rejectionReasonId,
        })),
      },
    });
    selectedShipGroupItems.value[shipGroup.id] = new Set();
    await showToast(translate('Selected items rejected successfully.'));
    await loadOrder(orderId, true);
  } catch {
    await showToast(translate('Failed to reject selected items. Please try again.'));
  }
}

async function releaseSelectedItems(shipGroup: any) {
  const itemIds = selectedItemsForShipGroup(shipGroup.id);
  if (!itemIds.length) return;
  const facilityId = await openPhysicalFacilityModal();
  if (!facilityId) return;
  const orderId = order.value!.id;
  try {
    await Promise.all(
      itemIds.map((orderItemSeqId) =>
        api({
        url: `oms/orders/${orderId}/items/${orderItemSeqId}/allocation`,
        method: 'POST',
        data: { facilityId },
        })
      )
    );
    selectedShipGroupItems.value[shipGroup.id] = new Set();
    await showToast(translate('Selected items released to facility.'));
    await loadOrder(orderId, true);
  } catch {
    await showToast(translate('Failed to release selected items. Please try again.'));
  }
}
</script>

<style scoped>
ion-card-header {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas: "title actions" "subtitle actions";
}

ion-card-header ion-card-title {
  grid-area: title;
}

ion-card-header ion-card-subtitle {
  grid-area: subtitle;
}

ion-card-header ion-note,
ion-card-header ion-button,
ion-card-header ion-buttons {
  grid-area: actions;
  align-self: center;
}

.order-detail-header {
  display: grid;
  gap: var(--spacer-base);
  grid-template-columns: 1fr 357px;
  grid-template-rows: auto 1fr;
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
  grid-column: 2;
  grid-row: span 2;
}


@media (min-width: 900px) {
  .order-detail-header {
    align-items: start;
    grid-template-columns: minmax(0, 1fr) minmax(360px, 420px);
  }

  .order-detail-header-details {
    align-items: start;
    grid-template-columns: 1fr;
  }
}

.comm-event-row {
  --columns-desktop: 5;
  --columns-tablet: 5;
}

.comm-event-row>ion-item {
  width: 100%;
}

.order-items-list {
  padding-block-start: var(--spacer-sm);
}

.order-items-toolbar {
  --min-height: 5rem;
}

.order-items .order-summary {
  gap: var(--spacer-sm);
  padding: var(--spacer-sm);
}

.ship-group-card {
  border-radius: 16px;
}

.ship-group-header-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-right: var(--spacer-sm);
}

.ship-group-status-toggle {
  display: flex;
  align-items: center;
  gap: var(--spacer-xs);
}

.ship-group-status-toggle p {
  margin: 0;
  color: var(--ion-color-medium);
}

.ship-group-expanded-options,
.ship-group-summary-container,
.ship-group-card-details {
  display: grid;
  transition: grid-template-rows 180ms ease;
}

.ship-group-expanded-options,
.ship-group-card-details {
  grid-template-rows: 0fr;
}

.ship-group-expanded-options-open,
.ship-group-card-details-expanded {
  grid-template-rows: 1fr;
}

.ship-group-summary-container {
  grid-template-rows: 1fr;
}

.ship-group-summary-collapsed {
  grid-template-rows: 0fr;
}

.ship-group-selected-options {
  display: grid;
  gap: var(--spacer-base);
  grid-template-columns: repeat(auto-fit, minmax(260px, 400px));
}

.ship-group-options,
.ship-group-summary-content,
.ship-group-card-details-inner {
  min-height: 0;
  overflow: hidden;
}

.ship-group-summary-content,
.ship-group-detail-columns {
  display: flex;
  flex-wrap: nowrap;
}

.ship-group-summary-content>ion-list,
.ship-group-detail-columns>ion-list {
  flex: 1 1 400px;
}

.ship-group-summary-content>*:not(:last-child),
.ship-group-detail-columns>*:not(:last-child),
.ship-group-timeline>*:not(:last-child) {
  border-inline-end: var(--border-medium);
}

.ship-group-timeline>ion-item {
  border-block: var(--border-medium);
}

.ship-group-selected-options>ion-item {
  border: var(--border-medium);
  border-radius: 8px;
}

.ship-group-options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-xs);
  align-items: center;
  padding-inline: var(--spacer-base);
  padding-block: 0;
  transition: padding-block 180ms ease;
}

.ship-group-expanded-options-open .ship-group-options {
  padding-block: var(--spacer-base);
}

.ship-group-timeline {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.ship-group-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-xs);
  justify-content: flex-start;
  border-block-start: var(--border-medium);
}

.order-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.item-key-header,
.item-key-content {
  pointer-events: none;
}

.item-key-header ion-checkbox,
.item-key-header ion-thumbnail,
.item-key-content ion-checkbox {
  pointer-events: auto;
}

@media (max-width: 699px) {
  .order-items .order-summary {
    grid-template-columns: 1fr;
  }
}
</style>
