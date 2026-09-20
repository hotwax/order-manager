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
            <h1>{{ order.orderName ? order.orderName : order.id }}</h1>
            <p>{{ order.id }}</p>
          </ion-label>
          <ion-badge v-if="order.status" slot="end" :color="commonUtil.getStatusColor(order.statusId)">
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
                  @click="openCustomerContactModal('EMAIL_ADDRESS', 'ORDER_EMAIL')">
                  {{ translate('Add') }}
                </ion-button>
              </ion-item>
              <ion-item>
                <ion-label>
                  <p>{{ translate('Phone') }}</p>
                  {{ customer?.phone || translate('Phone not available') }}
                </ion-label>
                <ion-button v-if="!customer?.phone && customerPartyId" slot="end" fill="clear" size="small"
                  @click="openCustomerContactModal('TELECOM_NUMBER', 'PHONE_BILLING')">
                  {{ translate('Add') }}
                </ion-button>
              </ion-item>
              <ion-item>
                <ion-label>
                  <p>{{ translate('Locale') }}</p>
                  {{ order.localeString || translate('Locale not available') }}
                </ion-label>
                <ion-button v-if="!order.localeString" slot="end" fill="clear" size="small" @click="openLocalePrompt">
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
                  @click="openCustomerContactModal('POSTAL_ADDRESS', 'BILLING_LOCATION')">
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
              <ion-button fill="clear" size="small" @click="openManageIdentificationsModal()">
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
                <a
                  v-if="id.shopifyAdminUrl"
                  slot="end"
                  :href="id.shopifyAdminUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  :aria-label="translate('View in Shopify')"
                  :title="translate('View in Shopify')"
                >
                  <ion-icon :icon="openOutline" />
                </a>
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
              <ion-item v-if="riskFactCount" button detail lines="none" @click="openRiskDetails">
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

      <ion-segment v-model="selectedSegment">
        <ion-segment-button value="items">
          <ion-label>{{ translate('Items') }}</ion-label>
        </ion-segment-button>
        <ion-segment-button value="ship-groups">
          <ion-label>{{ translate('Shipgroups') }}</ion-label>
        </ion-segment-button>
        <ion-segment-button value="holds">
          <ion-label>{{ translate('Holds') }}</ion-label>
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
            <ion-button v-if="!['ORDER_CANCELLED', 'ORDER_COMPLETED'].includes(order?.statusId)" slot="end" fill="outline" color="medium" @click="openAddItemFromItemsSegment">
              {{ translate('Add items') }}
            </ion-button>
          </ion-item>
          <ion-accordion-group>
            <template v-for="{ group, soleItem } in itemGroups" :key="group.externalId">
              <!-- Nothing to roll up when the group is a single order item, so the item row is
                   rendered directly with the product identity the rolled up header would carry. -->
              <OrderItemListRow
                v-if="soleItem"
                :primary="groupPrimaryIdentifier(group)"
                :secondary="groupSecondaryIdentifier(group)"
                :badge-label="isKit(group) ? translate('Kit') : ''"
                :features="productFeatureLabel(group.productId)"
                :image-url="getProduct(group.productId)?.mainImageUrl"
                :preview-product="getProduct(group.productId)"
                :selected="soleItem.selected"
                :quantity="soleItem.quantity"
                :quantity-label="translate('qty')"
                :facility-label="soleItem.facilityName"
                :facility-disabled="isItemFacilityActionDisabled(soleItem)"
                :attributes-label="attributeChipLabel(soleItem.attributeCount)"
                :statuses="soleItem.statuses"
                :status-detail="itemStatusDetail(soleItem)"
                :amount="money(itemLineTotal(soleItem), order.currency)"
                :adjustments="getItemAdjustmentRows(soleItem)"
                @update:selected="soleItem.selected = $event"
                @facility-click="rejectAndReleaseItem(soleItem)"
                @attributes-click="openItemAttributesModal(soleItem)"
              >
                <template #actions>
                  <ion-button
                    v-if="canRequestInventoryTransfer && isInventoryTransferRequestEligible(soleItem)"
                    fill="clear"
                    size="small"
                    @click.stop="requestInventoryTransferForItem(soleItem)"
                  >
                    {{ translate('Request transfer') }}
                  </ion-button>
                  <ion-button
                    v-if="isItemCancelAllowed(soleItem)"
                    fill="clear"
                    size="small"
                    color="danger"
                    @click.stop="cancelSingleItem(soleItem)"
                  >
                    {{ translate('Cancel') }}
                  </ion-button>
                </template>
              </OrderItemListRow>
              <ion-accordion v-else :value="group.externalId">
                <OrderItemListRow
                  slot="header"
                  :select-on-row-click="false"
                  :primary="groupPrimaryIdentifier(group)"
                  :secondary="groupSecondaryIdentifier(group)"
                  :badge-label="isKit(group) ? translate('Kit') : ''"
                  :features="productFeatureLabel(group.productId)"
                  :image-url="getProduct(group.productId)?.mainImageUrl"
                  :preview-product="getProduct(group.productId)"
                  :selected="group.selected"
                  :quantity="group.totalQty"
                  :quantity-label="translate('qty')"
                  :facility-label="groupLocationLabel(group)"
                  :facility-disabled="true"
                  :statuses="group.statuses"
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
                      :primary="`${translate('Item')} ${item.orderItemSeqId}`"
                      :secondary="item.externalId && item.externalId !== 'null' ? `${translate('External ID')}: ${item.externalId}` : ''"
                      :selected="item.selected"
                      :quantity="item.quantity"
                      :quantity-label="translate('qty')"
                      :show-quantity="false"
                      :facility-label="item.facilityName"
                      :facility-disabled="isItemFacilityActionDisabled(item)"
                      :attributes-label="attributeChipLabel(item.attributeCount)"
                      :statuses="item.statuses"
                      :status-detail="itemStatusDetail(item)"
                      :amount="money(itemLineTotal(item), order.currency)"
                      :adjustments="getItemAdjustmentRows(item)"
                      @update:selected="item.selected = $event"
                      @facility-click="rejectAndReleaseItem(item)"
                      @attributes-click="openItemAttributesModal(item)"
                    >
                      <template #actions>
                        <ion-button
                          v-if="canRequestInventoryTransfer && isInventoryTransferRequestEligible(item)"
                          fill="clear"
                          size="small"
                          @click.stop="requestInventoryTransferForItem(item)"
                        >
                          {{ translate('Request transfer') }}
                        </ion-button>
                        <ion-button v-if="isItemCancelAllowed(item)" fill="clear"
                          size="small" color="danger" @click.stop="cancelSingleItem(item)">
                          {{ translate('Cancel') }}
                        </ion-button>
                      </template>
                    </OrderItemListRow>
                  </ion-list>
                </div>
              </ion-accordion>
            </template>
          </ion-accordion-group>
        </ion-list>

        <!-- Totals Card -->

        <div class="order-summary">
          <ion-card class="payment-card">
            <ion-card-header>
              <ion-card-title>{{ translate('Payment') }}</ion-card-title>
              <ion-card-subtitle v-if="order.payments.length" :color="paymentNetColor">
                {{ translate('Net') }} {{ money(paymentNetAmount, order.currency) }}
              </ion-card-subtitle>
            </ion-card-header>
            <ion-list lines="none">
              <template v-for="section in paymentSections" :key="section.statusId">
                <ion-item-divider color="light">
                  <ion-label>{{ section.label }}</ion-label>
                  <ion-label slot="end">{{ money(section.total, order.currency) }}</ion-label>
                </ion-item-divider>
                <ion-item v-for="(payment, index) in section.payments" :key="payment.id || `${payment.paymentMethodTypeId}-${index}`">
                  <ion-label>
                    <p class="overline">{{ payment.paymentMethodTypeId || payment.method }}</p>
                    {{ payment.paymentMethodTypeDesc || payment.method }}
                    <p>{{ payment.statusDesc || payment.status || payment.statusId }}</p>
                    <p v-if="payment.createdDate">{{ formatDateTime(payment.createdDate) }}</p>
                    <template v-if="canViewReturns">
                      <ion-button
                        v-for="returnId in carriedOverReturnIds(payment)"
                        :key="returnId"
                        fill="clear"
                        size="small"
                        class="payment-return-link"
                        :router-link="`/returns/${returnId}`"
                        @click.stop
                      >
                        <ion-icon slot="start" :icon="openOutline" />
                        {{ translate('Return') }} {{ returnId }}
                      </ion-button>
                    </template>
                  </ion-label>
                  <ion-label slot="end">{{ money(payment.amount, order.currency) }}</ion-label>
                </ion-item>
              </template>
              <ion-item v-if="!order.payments.length">
                <ion-label>{{ translate('No payment preference records') }}</ion-label>
              </ion-item>
            </ion-list>
          </ion-card>
          <ion-card class="totals">
            <ion-card-header>
              <ion-card-title>{{ translate('Total') }}</ion-card-title>
            </ion-card-header>
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
                <ion-label slot="end" class="ion-text-end">
                  {{ money(adjustment.amount, order.currency) }}
                  <p v-if="adjustment.isIncluded">{{ translate('Included') }}</p>
                </ion-label>
              </ion-item>
              <ion-item class="grand-total-row">
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

        <template v-else>
          <EmptyState :title="translate('No ship groups')"
            :message="translate('There are no ship groups defined for this order.')" />
        </template>
      </div>

      <div v-if="selectedSegment === 'holds'">
        <template v-if="hasOrderHoldTasks">
          <BadAddressTaskCard v-for="task in orderAddressValidationTasks" :key="task.workEffortId" :task="task"
            :countries="seed.getCountries"
            @completed="reloadHoldTasks" />
          <SwapTaskCard v-for="task in orderSwapTasks" :key="task.workEffortId" :task="task"
            @completed="reloadHoldTasks" />
          <FraudTaskCard v-for="task in orderFraudTasks" :key="task.workEffortId" :task="task"
            @completed="reloadHoldTasks" />
          <HoldTaskCard v-for="task in orderHoldTasks" :key="task.workEffortId" :task="task"
            @completed="reloadHoldTasks" />
        </template>
        <template v-else>
          <EmptyState :title="translate('No holds')" :message="translate('No holds on this order')" />
          <div class="ion-text-center ion-padding">
            <ion-button fill="outline" @click="openCreateHoldTaskModal()">{{ translate('Create hold task') }}</ion-button>
          </div>
        </template>
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
        :message="translate('Order {orderId} was not found in the database. It may have been removed, or a stale search index is still listing it.', { orderId })" />
    </ion-content>

    <ion-footer v-if="order && selectedSegment === 'items'">
      <ion-toolbar>
        <!-- The footer is one engine-driven list (OrderActionValidator.getOrderFooterActions):
             status transitions (Approve, …) on the start, lifecycle and cancel actions
             (Cancel items, Cancel order, Return) on the end. Only VALID actions are present — an
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

    <ion-footer v-if="order && selectedSegment === 'holds' && hasOrderHoldTasks">
      <ion-toolbar>
        <ion-buttons slot="end">
          <ion-button @click="openCreateHoldTaskModal()">{{ translate('Create hold task') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonAccordion, IonAccordionGroup, IonBackButton, IonBadge, IonButton, IonButtons, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonCheckbox, IonChip, IonContent, IonFab, IonFabButton, IonFooter, IonHeader, IonIcon, IonInput, IonItem, IonItemDivider, IonLabel, IonList, IonListHeader, IonMenuButton, IonModal, IonNote, IonPage, IonPopover, IonProgressBar, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonSkeletonText, IonTextarea, IonThumbnail, IonTitle, IonToolbar, alertController, modalController, onIonViewWillEnter } from '@ionic/vue';
import { DateTime } from 'luxon';
import { arrowUndoOutline, calendarOutline, checkmarkDoneOutline, chevronDown, chevronUp, closeCircleOutline, closeOutline, compassOutline, createOutline, cubeOutline, documentTextOutline, downloadOutline, ellipsisVertical, giftOutline, mailOutline, openOutline, pauseCircleOutline, pulseOutline, saveOutline, sendOutline, shieldOutline, storefrontOutline, sunnyOutline, swapHorizontalOutline, ticketOutline, timeOutline, trashOutline, warningOutline } from 'ionicons/icons';
import { useOrderDetailStore } from '@/store/orderDetail';
import { useSeedStore } from '@/store/seed';
import { useProductCacheStore } from '@/store/productCache';
import { useProductMaster } from '@/composables/useProductMaster';
import { useOrderDistances } from '@/composables/useOrderDistances';
import router from '@/router';
import EmptyState from '@/components/common/EmptyState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import AddContactModal from '@/components/AddContactModal.vue';
import OrderItemListRow from '@/components/orders/OrderItemListRow.vue';
import FacilityModal from '@/components/fulfillment/FacilityModal.vue';
import OrderItemAttributesModal from '@/components/orders/OrderItemAttributesModal.vue';
import AttributeListItem from '@/components/orders/AttributeListItem.vue';
import ManageOrderIdentificationsModal from '@/components/orders/ManageOrderIdentificationsModal.vue';
import RiskAssessmentModal from '@/components/orders/RiskAssessmentModal.vue';
import FacilityInventoryModal from '@/components/fulfillment/FacilityInventoryModal.vue';
import BadAddressTaskCard from '@/components/tasks/BadAddressTaskCard.vue';
import SwapTaskCard from '@/components/tasks/SwapTaskCard.vue';
import FraudTaskCard from '@/components/tasks/FraudTaskCard.vue';
import HoldTaskCard from '@/components/tasks/HoldTaskCard.vue';
import { useOrderActions } from '@/composables/useOrderActions';
import { api, commonUtil, DxpShopifyImg, logger, translate, useSolrSearch } from '@common';
import { escapeSolrValue, summarizeBrokeredFacilities } from '@/services/order';
import { getReturn } from '@/services/returns';
import { isInventoryTransferEligibleItem } from '@/services/inventoryTransfers';
import { showToast, isKit, riskLevelColor, sentimentCounts } from '@/utils';
import { OrderActionValidator } from '@/utils/OrderActionValidator';
import { countShipGroupHoldTasks } from '@/utils/orderHoldTasks';
import { rollUpItemStatuses, type ItemStatusBadge } from '@/utils/itemStatusBadges';
import { shipGroupItemStates as itemStatesFor } from '@/utils/shipGroupItemStates';
import { shopifyAdminOrderUrl, singleShopIdForProductStore } from '@/utils/shopifyAdmin';
import { useOrderTaskStore } from '@/store/orderTask';
import { useUserStore } from '@/store/user';
import { useProductStore } from '@/store/productStore';
import { useCustomerStore } from '@/store/customer';
import type { CustomerContactMech } from '@/types/customer';
import Actions from '@/authorization/actions';

const props = defineProps<{
  orderId: string;
}>();

const orderDetailStore = useOrderDetailStore();
const seed = useSeedStore();
const productCache = useProductCacheStore();
const customerStore = useCustomerStore();
const userStore = useUserStore();
const canViewReturns = computed(() => userStore.hasPermission(Actions.APP_ORDER_RETURN_VIEW));
const canRequestInventoryTransfer = computed(() => userStore.hasPermission(Actions.APP_INVENTORY_TRANSFER_CREATE));

const loading = computed(() => orderDetailStore.loadingById(props.orderId));
const error = computed(() => orderDetailStore.errorById(props.orderId));

const productIdentificationPref = computed(() => useProductStore().getProductIdentificationPref);
const customerPartyId = computed(() => orderDetailStore.customerPartyIdByOrderId(props.orderId));

// Shopify Admin deep-link. Primary source is the order's own shopifyShopOrder record
// (the shop it actually came from — same source CloneOrderModal uses). That endpoint
// isn't exposed by the connector yet (hotwax/mantle-shopify-connector#381), so until
// it ships we fall back to inferring the shop from the order's product store, but ONLY
// when exactly one Shopify shop maps to that store (see fallbackShopIdByProductStore) —
// an ambiguous multi-shop store or an unknown store degrades to no link, so we never
// point at the wrong store. No shop / no myshopify domain also degrades to no link. The
// URL is a computed over the seed dataset so it appears reactively even when the
// boot-time shops load finishes after the order renders.
const shopifyOrderShopId = ref('');
// Successful resolutions are memoized (the order→shop mapping is immutable): force
// reloads skip the refetch — no link flicker, and a transient refetch failure can't
// erase an already-resolved link. Not set on error, so the next loadOrder retries.
let resolvedShopifyShop = { orderId: '', shopId: '' };

const shopifyOrderId = computed(() => {
  const identifications = orderDetailStore.orderById(props.orderId)?.identifications || [];
  return identifications.find((identification: any) => identification.orderIdentificationTypeId === 'SHOPIFY_ORD_ID')?.idValue ?? '';
});

// Interim fallback until the connector exposes GET oms/orders/{id}/shopifyShopOrder
// (hotwax/mantle-shopify-connector#381): infer the shop from the order's product store,
// but ONLY when exactly one Shopify shop maps to it — 0 or >1 matches → '' (no link),
// so we never link to the wrong store. Reactive over the seed dataset so it resolves
// once the boot-time shops load completes. Skipped once the record-based id is known.
const fallbackShopIdByProductStore = computed(() => {
  if (shopifyOrderShopId.value) return '';
  const productStoreId = orderDetailStore.orderById(props.orderId)?.productStoreId;
  if (!productStoreId) return '';
  const shops = seed.shopifyShops.ids.map((id: string) => seed.shopifyShops.byId[id]);
  return singleShopIdForProductStore(shops, productStoreId);
});

const shopifyAdminUrl = computed(() => {
  if (!shopifyOrderId.value) return '';
  const shopId = shopifyOrderShopId.value || fallbackShopIdByProductStore.value;
  if (!shopId) return '';
  const shop: any = seed.shopifyShops.byId[shopId];
  return shop ? shopifyAdminOrderUrl(shop.myshopifyDomain || shop.domain, shopifyOrderId.value) : '';
});

async function resolveShopifyOrderShop(orderId: string) {
  // Stale caller: a slow loadOrder for a previously viewed order must not clobber
  // the state of the order now on screen.
  if (orderId !== props.orderId) return;
  if (resolvedShopifyShop.orderId === orderId) {
    // Already resolved — re-assert rather than trust the ref: a racing resolver for
    // another order may have cleared it before its stale response was discarded.
    shopifyOrderShopId.value = resolvedShopifyShop.shopId;
    return;
  }
  shopifyOrderShopId.value = '';
  if (!shopifyOrderId.value) return;
  seed.loadShopifyShops();
  try {
    const resp = await api({ url: `oms/orders/${orderId}/shopifyShopOrder`, method: 'GET' });
    const rows: any[] = Array.isArray(resp.data) ? resp.data : (resp.data?.docs ?? []);
    if (orderId !== props.orderId) return; // stale response after navigating to another order
    shopifyOrderShopId.value = rows.find((row: any) => row.shopId)?.shopId || '';
    resolvedShopifyShop = { orderId, shopId: shopifyOrderShopId.value };
  } catch (error: any) {
    // 404 is expected until the connector exposes this endpoint
    // (hotwax/mantle-shopify-connector#381); the product-store fallback covers the
    // link meanwhile. Only surface genuinely unexpected failures.
    if (error?.response?.status !== 404) {
      logger.error('Failed to resolve the Shopify shop for the order', error);
    }
  }
}

/**
 * View model — delegates to the enriched domain model from orderDetailStore.
 */
const order = computed(() => orderDetailStore.enrichedOrderByOrderId(props.orderId));

const customerProfile = computed(() => customerPartyId.value ? customerStore.getCustomer(customerPartyId.value) : null);

const customer = computed(() => order.value?.customer);

const billingAddress = computed(() => order.value?.customer?.billingAddress);

// Return headers hydrate lazily per returnId to name the facility a return was processed
// at (ReturnHeader.destinationFacilityId — the embedded ReturnItem rows don't carry it).
// null = header unavailable (endpoint down or return not found); timeline wording degrades
// to the facility-less variant.
const returnHeadersById = ref<Record<string, any | null>>({});

watch([() => {
  const raw = orderDetailStore.orderById(props.orderId);
  return [...new Set((raw?.returnItems || []).map((item: any) => item.returnId).filter(Boolean))] as string[];
}, canViewReturns], ([returnIds, canView]) => {
  if (!canView) return;
  returnIds.forEach(async (returnId) => {
    if (returnId in returnHeadersById.value) return;
    returnHeadersById.value = { ...returnHeadersById.value, [returnId]: null };
    try {
      const header = await getReturn(returnId);
      if (header) returnHeadersById.value = { ...returnHeadersById.value, [returnId]: header };
    } catch (error) {
      logger.debug(`Return header ${returnId} unavailable for timeline facility context`, error);
    }
  });
}, { immediate: true });

// Reverse exchange lineage: OrderItemAssoc EXCHANGE rows live only on the exchange order,
// so an original order finds its exchanges by the EXC-<orderName>-N naming convention in
// Solr, confirmed against each candidate's own itemAssocs before it may appear.
const exchangeChildrenByOrderId = ref<Record<string, Array<{
  orderId: string;
  itemCount: number;
  facilityName: string;
  value: number;
}>>>({});

watch(() => orderDetailStore.orderById(props.orderId)?.orderName, () => discoverExchangeChildren(props.orderId), { immediate: true });

async function discoverExchangeChildren(orderId: string) {
  const raw = orderDetailStore.orderById(orderId);
  if (!raw?.orderName || orderId in exchangeChildrenByOrderId.value) return;
  exchangeChildrenByOrderId.value = { ...exchangeChildrenByOrderId.value, [orderId]: [] };

  try {
    const response = await useSolrSearch().runSolrQuery({
      json: {
        params: { rows: 50, q: '*:*' },
        filter: ['docType: ORDER', `orderName: ${escapeSolrValue(`EXC-${raw.orderName}-`)}*`]
      }
    });
    const candidateIds = [...new Set(
      (response.data?.response?.docs || [])
        .map((doc: any) => String(doc.orderId || ''))
        .filter((candidateId: string) => candidateId && candidateId !== orderId)
    )] as string[];

    const children: Array<{ orderId: string; itemCount: number; facilityName: string; value: number }> = [];
    await Promise.all(candidateIds.map(async (candidateId) => {
      await orderDetailStore.fetchOrder(candidateId);
      const payload = orderDetailStore.byOrderId[candidateId]?.payload;
      const assoc = (payload?.itemAssocs || []).find(
        (row: any) => row.orderItemAssocTypeId === 'EXCHANGE' && row.toOrderId === orderId
      );
      if (!assoc) return;

      const itemCount = (payload.shipGroups || [])
        .flatMap((shipGroup: any) => shipGroup.items || [])
        .reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
      children.push({
        orderId: candidateId,
        itemCount,
        facilityName: payload.originFacilityId && payload.originFacilityId !== '_NA_'
          ? seed.facilityName(payload.originFacilityId)
          : '',
        value: timelineMillis(assoc.createdStamp) || timelineMillis(payload.orderDate) || 0
      });
    }));
    exchangeChildrenByOrderId.value = { ...exchangeChildrenByOrderId.value, [orderId]: children };
  } catch (error) {
    logger.error('Failed to discover exchange orders for timeline', error);
  }
}

// OrderFacilityChange reasons that describe where items went. Every other reason —
// the REPORT_VAR/REPORT_NO_VAR rejection reasons, damaged, inventory-not-found — is a
// rejection, and reads by where the items came from instead.
const FACILITY_CHANGE_LABELS: Record<string, string> = {
  BROKERED: 'Brokered',
  ALLOCATED: 'Allocated',
  RELEASED: 'Released',
  PARKED: 'Parked'
};

const FACILITY_CHANGE_ICONS: Record<string, string> = {
  BROKERED: compassOutline,
  ALLOCATED: compassOutline,
  RELEASED: storefrontOutline,
  PARKED: pauseCircleOutline
};

const orderTimeline = computed(() => order.value?.timeline || []);

const timelineByShipGroup = computed(() => orderDetailStore.timelineByShipGroupByOrderId(props.orderId));

/**
 * Earliest OrderFacilityChange per ship group, from the rows the events feed already
 * loads. `get#OrderFulfillmentTimeline` dates brokering off rows carrying a BROKERED
 * or RELEASED changeReasonEnumId, and only the routing engine writes those — the row
 * OMS writes when an order is first allocated carries no reason at all, so a group that
 * was never re-brokered has no date in the timeline endpoint. That row is the date.
 */
const facilityChangeDateByShipGroup = computed<Record<string, number>>(() => {
  const earliest: Record<string, number> = {};
  (orderDetailStore.facilityChangesByOrderId[props.orderId] || []).forEach((change: any) => {
    const millis = timelineMillis(change?.changeDatetime);
    if (!change?.shipGroupSeqId || millis == undefined) return;
    const current = earliest[change.shipGroupSeqId];
    if (current == undefined || millis < current) earliest[change.shipGroupSeqId] = millis;
  });
  return earliest;
});

/**
 * What the lifecycle strip and the progress bar read: the timeline endpoint's dates with
 * the brokered date resolved as above. Kept separate from `timelineByShipGroup` so the
 * action engine keeps reading the endpoint's contract verbatim.
 */
const lifecycleByShipGroup = computed<Record<string, any>>(() => {
  const index: Record<string, any> = {};
  (order.value?.shipGroups || []).forEach((shipGroup: any) => {
    index[shipGroup.id] = {
      ...(timelineByShipGroup.value[shipGroup.id] || {}),
      firstBrokeredDate: shipGroupBrokeredDate(shipGroup)
    };
  });
  return index;
});

const expandedShipGroupIds = ref<Set<string>>(new Set());
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

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

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
  }
};

function isVirtualFacility(shipGroup: any): boolean {
  if (!shipGroup.facilityId) return true;
  return (
    shipGroup.facilityParentTypeId === 'VIRTUAL_FACILITY' ||
    shipGroup.facilityTypeId === 'VIRTUAL_FACILITY'
  );
}

/**
 * A ship group sold over the counter. OMS treats POS_COMPLETED as needing no
 * fulfillment at all (`requiresFulfillment` in OrderServices get#SalesOrder), so the
 * group has no carrier, no ship-to address, and no brokering/pick/pack/ship dates —
 * the goods left with the customer.
 */
function isPosCompleted(shipGroup: any): boolean {
  return shipGroup?.shipmentMethodTypeId === 'POS_COMPLETED';
}

/** When the ship group reached its facility, or undefined if nothing recorded it. */
function shipGroupBrokeredDate(shipGroup: any): string | number | undefined {
  const tl = timelineByShipGroup.value[shipGroup.id];
  const brokered = tl?.firstBrokeredDate || tl?.firstReleasedDate;
  if (brokered) return brokered;
  // The fallback row only dates brokering for a group that reached a physical facility.
  // On a virtual one the same rows record parking, rejections and cancellations, none of
  // which are a brokering — so a parked group must not inherit a date from them.
  return isVirtualFacility(shipGroup) ? undefined : facilityChangeDateByShipGroup.value[shipGroup.id];
}

/**
 * Brokered == the items sit at a physical facility. This is the rule the action engine
 * already applies (`OrderActionValidator.isShipGroupBrokered`); the lifecycle display
 * has to apply it too, because a group can be brokered with no date to show.
 */
function isShipGroupBrokered(shipGroup: any): boolean {
  return !isVirtualFacility(shipGroup) || !!shipGroupBrokeredDate(shipGroup);
}

/** Item-derived state for this group; see utils/shipGroupItemStates for why it is the authority. */
function shipGroupItemStates(shipGroup: any) {
  return itemStatesFor(shipGroup?.items);
}

/**
 * A stopped group is read-only: its carrier, method, dates, gift message and instructions
 * all describe a shipment that is no longer going to change. Reads the same `settled` the
 * card's label uses, so the two cannot disagree.
 */
function isShipGroupReadOnly(shipGroup: any): boolean {
  return shipGroup.isReadOnly ?? shipGroupItemStates(shipGroup).settled;
}

function shipGroupProgress(shipGroup: any): number {
  return shipGroup.progress ?? 0;
}

/** A step that never got a date: still to come, or already behind us and simply not recorded. */
function lifecycleStepNote(shipGroup: any, date: any): string {
  return formatTime(date)
    || (shipGroupItemStates(shipGroup).settled ? translate('No date') : translate('Pending'));
}

/** The brokered step's time, or why there is none: not brokered yet vs. brokered untimed. */
function brokeredStepNote(shipGroup: any): string {
  return formatTime(shipGroupBrokeredDate(shipGroup))
    || (isShipGroupBrokered(shipGroup) || shipGroupItemStates(shipGroup).settled
      ? translate('No date')
      : translate('Pending'));
}

function isShipGroupExpanded(shipGroupId: string): boolean {
  return expandedShipGroupIds.value.has(shipGroupId);
}

/** Whether the item detail block is showing — always, for a counter sale with no toggle. */
function isShipGroupDetailsOpen(shipGroup: any): boolean {
  return isPosCompleted(shipGroup) || isShipGroupExpanded(shipGroup.id);
}

/** `tone` is the Ionic semantic colour name handed to the badge, not a CSS colour. */
interface IssuanceBadge { label: string; tone: string; qohBefore: number; qohAfter: number }

/**
 * Whether inventory was issued for a counter-sale line, and how completely.
 *
 * Completion and issuance are separate steps — issue#PosOrderInventory skips an order
 * whose facility is not a physical store — so an item can be ITEM_COMPLETED with no
 * inventory ever issued. That gap is the reason to show this at all, and it is why the
 * badge reads the issuance rows rather than the item status. Returns null while the
 * rows are still loading or if they failed, so an unknown never reads as "not issued".
 */
const itemIssuanceBadges = computed<Record<string, IssuanceBadge>>(() => {
  const issuanceByItem = orderDetailStore.issuanceByItemSeqIdByOrderId(props.orderId);
  if (!issuanceByItem) return {};

  const badges: Record<string, IssuanceBadge> = {};
  (order.value?.shipGroups || [])
    .filter(isPosCompleted)
    .forEach((shipGroup: any) => {
      (shipGroup.items || []).forEach((item: any) => {
        const ordered = Number(item.quantity) || 0;
        const summary = issuanceByItem[item.id];
        const issued = summary?.issued || 0;
        const stock = { qohBefore: summary?.qohBefore ?? 0, qohAfter: summary?.qohAfter ?? 0 };

        if (issued <= 0) badges[item.id] = { label: 'Inventory not issued', tone: 'warning', ...stock };
        else if (ordered && issued < ordered) badges[item.id] = { label: 'Inventory partly issued', tone: 'warning', ...stock };
        else badges[item.id] = { label: 'Inventory issued', tone: 'success', ...stock };
      });
    });
  return badges;
});

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
  return shipGroup.headerTitle || `${shipGroup.id} ${shipGroup.facilityName || translate('Facility Name')}`;
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
  const carrier = availableCarriers.value.find((party: any) => party.partyId === carrierPartyId);
  return carrier ? [carrier.firstName, carrier.lastName].filter(Boolean).join(' ') || carrier.groupName || carrier.partyId : '';
}

function shippingMethodLabel(shipmentMethodTypeId: string): string {
  return shipmentMethodTypeId ? seed.shipmentMethodDescription(shipmentMethodTypeId) : '';
}

// ── Holds segment — order-scoped task cards ───────────────────────────────────
const orderAddressValidationTasks = computed(() => orderTaskStore.getOrderAddressValidationTasksByOrderId(props.orderId));
const orderSwapTasks = computed(() => orderTaskStore.getOrderSwapTasksByOrderId(props.orderId));
const orderFraudTasks = computed(() => orderTaskStore.getOrderFraudTasksByOrderId(props.orderId));
const orderHoldTasks = computed(() => orderTaskStore.getOrderHoldTasksByOrderId(props.orderId));
const hasOrderHoldTasks = computed(() =>
  orderAddressValidationTasks.value.length > 0
  || orderSwapTasks.value.length > 0
  || orderFraudTasks.value.length > 0
  || orderHoldTasks.value.length > 0
);

const orderShipGroupHoldTasks = computed(() => [
  ...orderAddressValidationTasks.value,
  ...orderSwapTasks.value,
  ...orderFraudTasks.value,
  ...orderHoldTasks.value,
]);

function shipGroupHoldTaskCount(shipGroup: any): number {
  return countShipGroupHoldTasks(orderShipGroupHoldTasks.value, shipGroup.id);
}

function shipGroupHoldTaskLabel(shipGroup: any): string {
  const count = shipGroupHoldTaskCount(shipGroup);
  return `${count} ${translate(count === 1 ? 'hold task' : 'hold tasks')}`;
}

function showShipGroupHoldTask() {
  selectedSegment.value = 'holds';
}

function reloadHoldTasks() {
  return orderTaskStore.fetchOrderHoldTasks(props.orderId);
}

const commEvents = computed(() => (orderDetailStore.commEventsByOrderId[props.orderId] || []).map((ev: any) => ({
  id: ev.communicationEventId,
  partyIdFrom: ev.partyIdFrom,
  partyIdTo: ev.partyIdTo,
  content: ev.content,
  entryDate: ev.entryDate
})));

const selectedItemIds = ref<Set<string>>(new Set());

const groupedItems = computed(() => {
  const groups = order.value?.groupedItems || [];
  return groups.map((group: any) => {
    const items = (group.items || []).map((item: any) => ({
      ...item,
      get selected() { return selectedItemIds.value.has(item.orderItemSeqId); },
      set selected(v: boolean) { v ? selectedItemIds.value.add(item.orderItemSeqId) : selectedItemIds.value.delete(item.orderItemSeqId); }
    }));
    return {
      ...group,
      items,
      get selected() { return items.length > 0 && items.every((i: any) => selectedItemIds.value.has(i.orderItemSeqId)); },
      set selected(v: boolean) { items.forEach((i: any) => v ? selectedItemIds.value.add(i.orderItemSeqId) : selectedItemIds.value.delete(i.orderItemSeqId)); }
    };
  });
});

// Items are rolled up by external id so a product split across ship groups reads as one row. A
// group backed by a single order item has nothing to roll up, so it exposes that item and the
// row is rendered without the accordion instead of hiding one row behind a disclosure.
const itemGroups = computed(() => groupedItems.value.map((group: any) => ({
  group,
  soleItem: group.items.length === 1 ? group.items[0] : null
})));

const orderTotals = computed(() => order.value?.totals || { subtotal: 0, adjustments: {}, includedAdjustments: {}, total: 0 });

const riskAssessments = computed(() => orderDetailStore.riskAssessmentsByOrderId[props.orderId] || []);
const riskFacts = computed(() => order.value?.risk?.facts || []);
const riskCounts = computed(() => order.value?.risk?.counts || { negative: 0, positive: 0, neutral: 0 });
const riskFactCount = computed(() => order.value?.risk?.factCount || 0);

async function openRiskDetails() {
  const modal = await modalController.create({
    component: RiskAssessmentModal,
    componentProps: { risks: riskAssessments.value },
  });
  await modal.present();
}

const riskSummary = computed(() => order.value?.risk || {
  hasRiskSignal: false,
  recommendation: translate('No recommendation'),
  level: translate('No risk level'),
  facts: [],
  counts: { negative: 0, positive: 0, neutral: 0 },
  factCount: 0
});

// Only preferences that actually collected money count — refunded, cancelled and
// declined preferences would otherwise inflate this past the grand total.
const paymentReceivedTotal = computed(() => order.value?.payments?.receivedTotal || 0);

// Payment card sections: one divider per distinct preference status, in order of first
// appearance, with refunded pinned to the bottom (stable sort keeps the rest in place).
const paymentSections = computed(() => order.value?.payments?.sections || []);

// Net collected right now: approved/settled/received preferences minus refunded ones.
// Cancelled/declined/not-received preferences never contribute in either direction.
const paymentNetAmount = computed(() => order.value?.payments?.netAmount || 0);

// Every non-cancelled item fully returned (by quantity).
const allItemsReturned = computed(() => order.value?.payments?.allItemsReturned || false);

// Negative net = more refunded than collected. Positive net on a fully-returned order =
// money still held for goods that all came back — likely a refund owed.
const paymentNetColor = computed(() => order.value?.payments?.netColor);

const orderAdjustmentRows = computed(() =>
  // orderTotals.adjustments is already keyed by the resolved comment/description
  // (see adjustmentDisplayLabel in the orderDetail store) — no further lookup needed here.
  [
    ...Object.entries(orderTotals.value.adjustments).map(([label, amount]) => ({
      label,
      detail: shippingAdjustmentDetail(label),
      amount: Number(amount),
      isIncluded: false
    })),
    ...Object.entries((orderTotals.value as any).includedAdjustments || {}).map(([label, amount]) => ({
      label,
      detail: shippingAdjustmentDetail(label),
      amount: Number(amount),
      isIncluded: true
    }))
  ].filter((row) => row.amount !== 0)
);

const selectedSegment = ref('items');

watch(selectedSegment, (segment) => {
  if (!props.orderId) return;
  if (segment === 'holds') {
    orderTaskStore.fetchOrderHoldTasks(props.orderId);
    orderDetailStore.fetchRiskAssessments(props.orderId);
  }
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

const allGroupedItems = computed(() =>
  groupedItems.value.flatMap((group: any) => group.items)
);

function shipGroupById(shipGroupId: string) {
  return (order.value?.shipGroups || []).find((shipGroup: any) => shipGroup.id === shipGroupId) || null;
}

/**
 * The items a ship-group action applies to. Selection NARROWS the action;
 * with nothing checked the action covers the whole ship group, so the buttons
 * never sit disabled just because the user has not ticked a row.
 */
function actionableItemObjectsForShipGroup(shipGroup: any) {
  const items = allGroupedItems.value.filter((item: any) => item.shipGroupSeqId === shipGroup.id);
  const itemIds = new Set(selectedItemsForShipGroup(shipGroup.id));
  if (!itemIds.size) return items;
  return items.filter((item: any) => itemIds.has(item.orderItemSeqId));
}

function shipGroupActionContext(shipGroup: any) {
  return {
    isVirtual: isVirtualFacility(shipGroup),
    allItems: allGroupedItems.value
  };
}

function shipGroupActionValidation(shipGroup: any, actionId: any) {
  if (!order.value) return { allowed: false };
  return OrderActionValidator.validateShipGroupAction(
    order.value,
    shipGroup,
    actionId,
    actionableItemObjectsForShipGroup(shipGroup),
    shipGroupActionContext(shipGroup)
  );
}

function isShipGroupActionDisabled(shipGroup: any, actionId: any) {
  if (shipGroup.actions) {
    if (actionId === 'CANCEL') return !shipGroup.actions.canCancel;
    if (actionId === 'RELEASE') return !shipGroup.actions.canRelease;
    if (actionId === 'REASSIGN_FACILITY') return !shipGroup.actions.canReassignFacility;
    if (actionId === 'EDIT_SHIPPING_METHOD' || actionId === 'EDIT_CARRIER_METHOD') return !shipGroup.actions.canEditShippingMethod;
  }
  return !shipGroupActionValidation(shipGroup, actionId).allowed;
}

function isVirtualFacilityForItem(item: any) {
  const shipGroup = shipGroupById(item.shipGroupSeqId);
  return shipGroup ? isVirtualFacility(shipGroup) : !item.facilityId;
}

function inventoryTransferItem(item: any) {
  const group = groupedItems.value.find((candidate: any) =>
    candidate.items.some((groupItem: any) => groupItem.orderItemSeqId === item.orderItemSeqId));
  return {
    ...item,
    productId: group?.productId || '',
    name: group ? groupPrimaryIdentifier(group) : `${translate('Item')} ${item.orderItemSeqId}`,
    sku: group?.sku || group?.productId || '',
    imageUrl: getProduct(group?.productId)?.mainImageUrl,
  };
}

function isInventoryTransferRequestEligible(item: any) {
  return item.actions?.canTransfer ?? isInventoryTransferEligibleItem(inventoryTransferItem(item), isVirtualFacilityForItem(item));
}

function inventoryTransferItemsForShipGroup(shipGroup: any) {
  if (isVirtualFacility(shipGroup)) return [];
  return actionableItemObjectsForShipGroup(shipGroup)
    .filter((item: any) => isInventoryTransferRequestEligible(item));
}

function itemActionContext(item: any) {
  const allowedTransitions = seed.allowedTransitions(item.statusId);
  return {
    isVirtual: isVirtualFacilityForItem(item),
    itemAllowedToStatusIds: new Set(allowedTransitions.map((transition: any) => transition.toStatusId)),
    allItems: allGroupedItems.value
  };
}

function itemFacilityActionValidation(item: any) {
  if (!order.value) return { allowed: false };
  const shipGroup = shipGroupById(item.shipGroupSeqId);
  if (shipGroup && isVirtualFacility(shipGroup)) {
    return OrderActionValidator.validateShipGroupAction(
      order.value,
      shipGroup,
      'RELEASE',
      [item],
      shipGroupActionContext(shipGroup)
    );
  }

  return OrderActionValidator.validateItemAction(
    order.value,
    item,
    'REJECT_AND_RELEASE',
    itemActionContext(item)
  );
}

function isItemFacilityActionDisabled(item: any) {
  return item.actions ? !item.actions.canRejectAndRelease : !itemFacilityActionValidation(item).allowed;
}

/**
 * Whether this row may offer Cancel. A non-terminal item is not enough: the validator also
 * refuses once the ORDER is terminal, when the store's cancelAllowedWhen policy rules out the
 * ship group's phase, and when the seed transition table has no ITEM_CANCELLED edge from the
 * item's current status. Reading the same validator the action itself runs is what keeps the
 * button from offering a cancellation the backend will reject.
 */
function itemCancelValidation(item: any) {
  if (!order.value) return { allowed: false, reason: 'Order is not loaded.' };
  return OrderActionValidator.validateItemAction(order.value, item, 'CANCEL_ITEM', itemActionContext(item));
}

function isItemCancelAllowed(item: any) {
  return item.actions?.canCancel ?? itemCancelValidation(item).allowed;
}

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

// Ionic caches routed page instances: navigating /orders/A → /orders/B and back re-activates
// A's instance without re-mounting, while the store's currentOrderId still points at B. Load on
// every view activation (onIonViewWillEnter fires on first enter and on each re-enter; the store
// skips the refetch when the order is already loaded) so the page re-asserts its own order.
onIonViewWillEnter(() => loadOrder(props.orderId));
watch(() => props.orderId, (orderId) => loadOrder(orderId));

// Orders this one was exchanged from (OrderItemAssoc rows of type EXCHANGE, pointing at the
// original via toOrderId). Distinct, and never the order itself.
const exchangeSourceOrderIds = computed(() => [...new Set(
  (orderDetailStore.current?.itemAssocs || [])
    .filter((assoc: any) => assoc.orderItemAssocTypeId === 'EXCHANGE' && assoc.toOrderId && assoc.toOrderId !== orderDetailStore.current?.orderId)
    .map((assoc: any) => assoc.toOrderId as string)
)]);

// Lazily hydrate each original order (cached in the store by id) so the Source card can show
// its name and the returns that were processed as part of the exchange.
watch(exchangeSourceOrderIds, (ids) => {
  ids.forEach((id) => orderDetailStore.fetchOrder(id));
}, { immediate: true });

const exchangeSources = computed(() => exchangeSourceOrderIds.value.map((orderId) => {
  const entry = orderDetailStore.byOrderId[orderId];
  const payload = entry?.payload;
  return {
    orderId,
    loading: !entry || entry.status === 'loading' || entry.status === 'idle',
    orderName: payload?.orderName || payload?.externalId || orderId,
    returnIds: [...new Set((payload?.returnItems || []).map((item: any) => item.returnId).filter(Boolean))] as string[]
  };
}));

// Returns behind an exchange-credit/payment OPP. The returnId is NOT derivable from the OPP's
// ref numbers (they carry Shopify txn ids), so the source of truth is the original order's
// returnItems. When this order was exchanged from several originals, an OPP with a
// parentRefNum narrows to the original whose refunded OPP carries that same manualRefNum;
// otherwise every source's returns are listed rather than guessing (amount/id-adjacency
// heuristics proved unreliable against real data).
function carriedOverReturnIds(payment: any): string[] {
  if (!['EXCHANGE_CREDIT', 'EXCHANGE_PAYMENT'].includes(payment.paymentMethodTypeId)) return [];

  let sources = exchangeSources.value;
  if (payment.parentRefNum && sources.length > 1) {
    const matching = sources.filter((source) =>
      (orderDetailStore.byOrderId[source.orderId]?.payload?.paymentPreferences || []).some(
        (opp: any) => opp.manualRefNum === payment.parentRefNum
      )
    );
    if (matching.length) sources = matching;
  }
  return [...new Set(sources.flatMap((source) => source.returnIds))];
}

// Rejection reasons live under these two enum parent types and are otherwise only
// loaded when the Reject items modal opens — without them a timeline rejection reads
// as its raw id ("REJ_RSN_DAMAGED"). Loading is idempotent per enum type, so the guard
// just avoids re-listing the child types on every order.
const REJECTION_REASON_PARENT_TYPES = ['REPORT_AN_ISSUE', 'RPRT_NO_VAR_LOG'];

function loadRejectionReasonEnums() {
  REJECTION_REASON_PARENT_TYPES
    .filter((parentTypeId) => !seed.getEnumsByParentType(parentTypeId).length)
    .forEach((parentTypeId) => {
      seed.loadEnumsByParentType(parentTypeId).catch((error: any) =>
        logger.debug(`Rejection reason enums for ${parentTypeId} unavailable`, error)
      );
    });
}

async function loadOrder(orderId: string, force = false) {
  await orderDetailStore.loadOrderAggregate(orderId, { force });
  loadRejectionReasonEnums();
  resolveShopifyOrderShop(orderId);
  if (customerPartyId.value) {
    await customerStore.loadCustomerProfile(customerPartyId.value, force);
  }
}

async function openCustomerContactModal(contactMechTypeId: string, contactMechPurposeTypeId: string) {
  const partyId = customerPartyId.value;
  if (!partyId) {
    await showToast(translate('Customer is not available for this order.'));
    return;
  }

  const modal = await modalController.create({
    component: AddContactModal,
    componentProps: { contactMechTypeId, contactMechPurposeTypeId },
  });
  await modal.present();
  const { data, role } = await modal.onWillDismiss();
  if (role !== 'confirm' || !data) return;

  try {
    await (customerStore as any).addContact(partyId, contactMechTypeId, data);
    if (order.value?.id) await loadOrder(order.value.id, true);
    await showToast(translate('Customer contact updated successfully.'));
  } catch {
    await showToast(translate('Failed to update customer contact. Please try again.'));
  }
}

async function openLocalePrompt() {
  if (!order.value?.id) return;

  const alert = await alertController.create({
    header: translate('Locale'),
    inputs: [{
      name: 'localeString',
      type: 'text',
      placeholder: 'en-US',
    }],
    buttons: [
      { text: translate('Cancel'), role: 'cancel' },
      {
        text: translate('Save'),
        role: 'confirm',
        handler: (data) => {
          const localeString = String(data?.localeString || '').trim();
          if (!localeString) return false;
          saveOrderLocale(localeString);
          return true;
        },
      },
    ],
  });
  await alert.present();
}

async function saveOrderLocale(localeString: string) {
  if (!order.value?.id) return;

  try {
    await api({
      url: `oms/orders/${order.value.id}`,
      method: 'PUT',
      data: { orderId: order.value.id, localeString },
    });
    await loadOrder(order.value.id, true);
    await showToast(translate('Order locale updated successfully.'));
  } catch {
    await showToast(translate('Failed to update order locale. Please try again.'));
  }
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

const { shipGroupDistances } = useOrderDistances(() => props.orderId, order, isVirtualFacility);

const {
  showUnavailableAction,
  brokerShipGroup,
  cancelOrderItems,
  cancelSingleItem,
  rejectAndReleaseItem,
  cancelOrder,
  changeOrderStatus,
  runOrderStatusAction,
  startReturn,
  viewInventory,
  openCloneOrderModal,
  footerActions,
  runFooterAction,
  footerActionLabel,
  openAddTaskModal,
  openCreateHoldTaskModal,
  openAddItemModal,
  parkSelectedItems,
  rejectSelectedItems,
  releaseSelectedItems,
  openInventoryTransferRequestModal,
  requestInventoryTransferForItem,
  requestInventoryTransfersForShipGroup,
  saveCarrierAndMethod,
  updateShipGroup,
} = useOrderActions({
  orderId: props.orderId,
  order,
  loadOrder,
  selectedShipGroupItems,
  selectedItems,
  selectedItemIds,
  groupedItems,
  openFacilityModal,
  openFacilityInventoryModal,
  shipGroupById,
  actionableItemObjectsForShipGroup,
  shipGroupActionValidation,
  itemFacilityActionValidation,
  itemCancelValidation,
  isVirtualFacilityForItem,
  inventoryTransferItem,
  selectedSegment,
  reloadHoldTasks,
});

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

async function clearGiftMessage(shipGroup: any) {
  try {
    await updateShipGroup(shipGroup.id, { giftMessage: null });
    await showToast(translate('Gift message cleared.'));
  } catch {
    await showToast(translate('Failed to clear gift message.'));
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
  const mech = shipGroupShippingContactMech(shipGroup);
  return addressLines(mech?.postalAddress);
}

/**
 * Compact 3-line address for the ship-group card: name / street (address line 1
 * & 2) / locality (city, zip, state, country). Returns null when no address.
 */
function shippingAddressView(shipGroup: any): { name: string; street: string; locality: string } | null {
  const mech = shipGroupShippingContactMech(shipGroup);
  const addr = mech?.postalAddress;
  if (!addr) return null;
  return {
    name: addr.toName || '',
    street: [addr.address1, addr.address2].filter(Boolean).join(', '),
    locality: [addr.city, addr.postalCode, seed.geoName(addr.stateProvinceGeoId), seed.geoName(addr.countryGeoId)].filter(Boolean).join(', ')
  };
}

function shipGroupShippingContactMech(shipGroup: any) {
  return shipGroup.contactMechId
    ? orderDetailStore.contactMechsByIdByOrderId(props.orderId)[shipGroup.contactMechId]
    : orderDetailStore.contactMechsByPurposeByOrderId(props.orderId)['SHIPPING_LOCATION'];
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
  if (!order.value) return;
  const partyId = customerPartyId.value;
  if (!partyId) {
    await showToast(translate('Customer is not available for this order.'));
    return;
  }

  const contactMechId = shipGroupShippingContactMech(shipGroup)?.contactMechId || shipGroup.contactMechId;
  savingShippingAddress.value = true;
  try {
    await orderTaskStore.updateShippingInformation(order.value.id, shipGroup.id, {
      ...shippingAddressForm.value,
      partyId,
      contactMechId,
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

function formatDateTime(value: string | number | undefined) {
  const millis = timelineMillis(value);
  return millis
    ? DateTime.fromMillis(millis).toLocaleString({ hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short', year: 'numeric', hourCycle: 'h12' })
    : '';
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

type LifecycleStep = 'brokered' | 'pick' | 'pack' | 'ship';
const LIFECYCLE_STEP_ORDER: LifecycleStep[] = ['brokered', 'pick', 'pack', 'ship'];

function lifecycleStepValue(timeline: any, step: LifecycleStep) {
  if (!timeline) return undefined;
  if (step === 'brokered') return timeline.firstBrokeredDate || timeline.firstReleasedDate;
  if (step === 'pick') return timeline.picklistDate;
  if (step === 'pack') return timeline.packedDate;
  return timeline.shippedDate;
}

// Overline for a ship-group lifecycle step. The first completed step shows its age
// from now; every later completed step shows the elapsed time since the nearest
// previous completed step (a "+ 30 minutes" delta), so the timeline reads as per-step
// durations instead of repeating the same "months ago" on every step (#350). A missing
// intermediate step is skipped, so the delta is measured from the closest prior
// completed step rather than a gap.
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
  const adjs = orderDetailStore.adjustmentsByExternalId[group.externalId] || [];
  return adjs
    .map((adj) => ({ comment: adj.label, amount: Number(adj.amount), isIncluded: adj.isIncluded }))
    .filter(adj => adj.amount !== 0);
}

/**
 * A variant's selectable features as one line ("SIZE/M" -> "M"). `productFeatures` is the
 * Solr field the fulfillment app already renders this way, so the two apps agree on what a
 * variant reads as. Empty when the product is uncached or carries no features.
 */
function productFeatureLabel(productId: string): string {
  return commonUtil.getFeatures(getProduct(productId)?.productFeatures);
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

// Same location-chip semantics as the Find Orders list rows: the group's items act as the
// "docs" — the top physical facility wins the chip (+N for further splits), and virtual/parking
// facilities only label the chip when nothing is brokered. Facility type comes from the seed
// store since ship groups don't carry it.
function groupLocationLabel(group: any): string {
  const summary = summarizeBrokeredFacilities(group.items.map((item: any) => ({
    facilityId: item.facilityId,
    facilityName: seed.facilityName(item.facilityId) || item.facilityName,
    facilityTypeId: seed.facility(item.facilityId)?.facilityTypeId
  })));

  const brokered = Boolean(summary.brokeredFacilityName);
  const name = summary.brokeredFacilityName || summary.dominantVirtualFacilityName;
  if (!name) return '';
  const splitCount = brokered ? summary.brokeredFacilitySplitCount : summary.dominantVirtualFacilitySplitCount;
  return splitCount > 0 ? `${name} +${splitCount}` : name;
}

function getGroupAdjustmentRows(group: any): Array<{ label: string; amount: string }> {
  return getGroupAdjustments(group).map((adjustment) => ({
    label: adjustment.isIncluded ? `${adjustment.comment} (${translate('included')})` : adjustment.comment,
    amount: money(adjustment.amount, order.value?.currency || 'USD')
  }));
}

function getItemAdjustmentRows(item: any): Array<{ label: string; amount: string }> {
  return (item.adjustments || []).map((adjustment: any) => ({
    label: itemAdjustmentLabel(adjustment),
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
  return adj.comments
    || adj.comment
    || adj.description
    || seed.orderAdjustmentTypeDescription(adj.orderAdjustmentTypeId)
    || adj.orderAdjustmentTypeId
    || translate('Adjustment');
}

function itemAdjustmentKey(adj: any, fallbackSeqId = ""): string {
  return adj.orderAdjustmentId || [
    fallbackSeqId || adj.orderItemSeqId || "",
    adj.shipGroupSeqId || "",
    adj.orderAdjustmentTypeId || "",
    itemAdjustmentLabel(adj),
    Number(adj.amount || 0),
    Number(adj.amountAlreadyIncluded || 0)
  ].join("|");
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

async function openFacilityModal(): Promise<string | null> {
  const modal = await modalController.create({ component: FacilityModal });
  await modal.present();
  const { data: facilityId } = await modal.onWillDismiss();
  return facilityId ?? null;
}

/**
 * Order items carry no product identity of their own — the rolled up group holds it — so the
 * facility picker gets its product, name and image resolved from the owning group.
 */
function facilityInventoryItems(items: any[]) {
  return items.map((item: any) => {
    const group = groupedItems.value.find((candidate: any) =>
      candidate.items.some((groupItem: any) => groupItem.orderItemSeqId === item.orderItemSeqId));

    return {
      orderItemSeqId: item.orderItemSeqId,
      productId: group?.productId || '',
      name: group ? groupPrimaryIdentifier(group) : `${translate('Item')} ${item.orderItemSeqId}`,
      imageUrl: getProduct(group?.productId)?.mainImageUrl,
      quantity: Number(item.quantity || 1)
    };
  });
}

/**
 * One picker for both entry points. Releasing a single item from the items tab and releasing a
 * ship group's selection differ only in how many items are handed over.
 */
async function openFacilityInventoryModal(items: any[]): Promise<string | null> {
  const modal = await modalController.create({
    component: FacilityInventoryModal,
    componentProps: {
      items: facilityInventoryItems(items),
      productStoreId: orderDetailStore.orderById(props.orderId)?.productStoreId
    },
    cssClass: 'facility-inventory-modal'
  });
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
  await modal.onDidDismiss();
  if (order.value?.id) await loadOrder(order.value.id, true);
}

async function openManageIdentificationsModal() {
  const modal = await modalController.create({
    component: ManageOrderIdentificationsModal,
    componentProps: {
      orderId: order.value!.id,
      identifications: order.value!.identifications
    }
  });
  await modal.present();
  const { role } = await modal.onWillDismiss();
  if (role !== 'confirm') return;
  if (order.value?.id) await loadOrder(order.value.id, true);
}

</script>

<style scoped>
/* A variant can carry many feature values — an e-gift card lists every denomination — and the
   identity column is narrow. Keep features to one line and put the full value on hover. */
.ship-group-item-features {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

ion-card-header {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas: "title actions" "subtitle actions";
}

.sentiment-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-xs);
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
  border-left: var(--border-medium);
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

.order-summary {
  display: grid;
  align-items: start;
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
.customer-summary-card ion-card-header {
  display: flex;
  gap: var(--spacer-xs);
  justify-content: space-between;
}

.grand-total-row {
  --background: rgba(255, 255, 255, 0.06);
}

.payment-return-link {
  margin-inline-start: calc(-1 * var(--spacer-xs, 8px));
  text-transform: none;
}

/* Net amount sits across from the Payment title (the header grid's actions column). */
.payment-card ion-card-header ion-card-subtitle {
  grid-area: actions;
  align-self: center;
  margin: 0;
}
</style>
