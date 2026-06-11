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
          <ion-label>
            {{ order.orderName || 'Order' }}
            <p>{{ order.id }}</p>
          </ion-label>
          <ion-badge slot="end" :color="commonUtil.getStatusColor(order.statusId)">{{ order.status }}</ion-badge>
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
        <ion-segment-button value="comms">
          <ion-label>{{ translate('Comms') }}</ion-label>
        </ion-segment-button>
      </ion-segment>

      <div v-if="selectedSegment === 'items'">

        <ion-list>
          <ion-list-header>
            <ion-label>{{ translate('Items') }}</ion-label>
          </ion-list-header>
          <ion-item lines="full" buttonDetail="false" button>
            <ion-checkbox :checked="areAllSelected" justify="start" label-placement="end" @ionChange="toggleSelectAll($event.detail.checked)">{{ translate('Select all') }}</ion-checkbox>
          </ion-item>
          <ion-accordion-group>
            <ion-accordion v-for="group in groupedItems" :key="group.externalId" :value="group.externalId">
              <div slot="header" class="list-item order-item-rollup">
                <ion-item class="item-key-header" lines="none">
                  <ion-checkbox slot="start" v-model="group.selected" @click.stop />
                  <ion-thumbnail slot="start" v-image-preview="getProduct(group.productId)" :key="getProduct(group.productId)?.mainImageUrl">
                    <DxpShopifyImg :src="getProduct(group.productId)?.mainImageUrl" :key="getProduct(group.productId)?.mainImageUrl" size="small" />
                  </ion-thumbnail>
                  <ion-label>
                    <p class="overline">{{ commonUtil.getProductIdentificationValue(productIdentificationPref.secondaryId, getProduct(group.productId) || {}) }}</p>
                    <div>
                      {{ commonUtil.getProductIdentificationValue(productIdentificationPref.primaryId, getProduct(group.productId) || {}) || group.name }}
                      <ion-badge class="kit-badge" color="dark" v-if="isKit(group)">{{ translate("Kit") }}</ion-badge>
                    </div>
                    <p>{{ group.externalId }}</p>
                  </ion-label>
                </ion-item>
                
                <ion-label class="tablet">
                  {{ group.totalQty }} {{ translate('units') }}
                  <p>{{ translate('Qty') }}</p>
                </ion-label>

                <!--<ion-label class="tablet">
                  <ion-badge :color="commonUtil.getStatusColor(group.statusId)">{{ group.status }}</ion-badge>
                  <p>{{ translate('Status') }}</p>
                </ion-label>-->
                
                <ion-label class="ion-text-end">
                  {{ money(group.totalPrice, order.currency) }}
                  <p v-for="adj in getGroupAdjustments(group)" :key="adj.comment">
                    {{ adj.comment }}: {{ money(adj.amount, order.currency) }}
                  </p>
                </ion-label>
              </div>
              <div slot="content">
                <ion-list lines="none">
                  <div v-for="item in group.items" :key="item.orderItemSeqId" class="list-item order-item-row">
                    <ion-item lines="none">
                      <ion-checkbox v-model="item.selected" justify="start" label-placement="end">
                        <ion-label>
                          {{ item.orderItemSeqId }}
                          <p>{{ translate('#') }}{{ item.shipGroupSeqId }}</p>
                        </ion-label>
                      </ion-checkbox>
                    </ion-item>
                    
                    <ion-chip class="tablet" outline :disabled="['ITEM_CANCELLED', 'ITEM_COMPLETED'].includes(item.statusId)" @click.stop="rejectAndReleaseItem(item, group.productId)">
                      <ion-icon :icon="businessOutline"></ion-icon>
                      <ion-label>{{ item.facilityName }}</ion-label>
                    </ion-chip>

                    <ion-chip v-if="item.attributeCount" class="tablet" outline @click.stop="openItemAttributesModal(item)">
                      <ion-icon :icon="gitBranchOutline"></ion-icon>
                      <ion-label>{{ item.attributeCount }}</ion-label>
                    </ion-chip>
                    
                    <ion-badge class="tablet" :color="commonUtil.getStatusColor(item.statusId)">{{ item.status }}</ion-badge>

                    <ion-buttons>
                      <ion-button v-if="!['ITEM_CANCELLED', 'ITEM_COMPLETED'].includes(item.statusId)" fill="clear" size="small" color="danger" @click.stop="cancelSingleItem(item)">
                        {{ translate('Cancel') }}
                      </ion-button>
                    </ion-buttons>
                  </div>
                </ion-list>
              </div>
            </ion-accordion>
          </ion-accordion-group>
        </ion-list>

        <!-- Totals Card -->
        
        <div class="order-summary">
          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ translate('Order payment preference') }}</ion-card-title>
            </ion-card-header>
            <ion-list lines="none">
              <ion-item v-for="payment in order.payments" :key="payment.id">
                <ion-label>
                  <p>{{ payment.paymentMethodTypeDesc || payment.method }}</p>
                  {{ money(payment.amount, order.currency) }}
                </ion-label>
                <ion-note slot="end">{{ payment.statusDesc || payment.status }}</ion-note>
              </ion-item>
              <ion-item v-if="!order.payments?.length">
                <ion-label>{{ translate('No payment preference records') }}</ion-label>
              </ion-item>
            </ion-list>
          </ion-card>
          <ion-card class="totals">
            <ion-card-header>
              <ion-card-title>{{ translate('Totals') }}</ion-card-title>
            </ion-card-header>
            <ion-list lines="none">
              <ion-item>
                <ion-label>{{ translate('Subtotal') }}</ion-label>
                <ion-label slot="end">{{ money(orderTotals.subtotal, order.currency) }}</ion-label>
              </ion-item>
              <ion-item v-for="(amount, typeId) in orderTotals.adjustments" :key="typeId">
                <ion-label>{{ seed.orderAdjustmentTypeDescription(typeId) }}</ion-label>
                <ion-label slot="end">{{ money(amount, order.currency) }}</ion-label>
              </ion-item>
            </ion-list>
            <ion-item class="total-item">
              <ion-label>{{ translate('Grand Total') }}</ion-label>
              <ion-label slot="end" color="dark">{{ money(orderTotals.total, order.currency) }}</ion-label>
            </ion-item>
          </ion-card>
        </div>
      </div>
      <div v-if="selectedSegment === 'ship-groups'">
        <!-- Loop through ship groups or show mock card if empty -->
        <template v-if="order.shipGroups && order.shipGroups.length">
          <ion-card v-for="shipGroup in order.shipGroups.filter((sg: any) => sg.items?.length)" :key="shipGroup.id">
            <div class="shipgroup">
              <ion-item lines="none">
                <ion-label>
                  {{ translate('Ship Group #') }}{{ shipGroup.id }}
                  <p>{{ shipGroup.facilityName || translate('Facility Name') }}</p>
                  <p>{{ shipGroup.itemSummary }}</p>
                </ion-label>
                <ion-label slot="end">
                  {{ isVirtualFacility(shipGroup) ? translate('Not Brokered') : translate('Brokered') }}
                </ion-label>
                <ion-icon slot="end" :icon="chevronDown" />
              </ion-item>
            </div>

            <ion-progress-bar :value="shipGroupProgress(shipGroup)" :color="shipGroupProgress(shipGroup) === 1 ? 'success' : 'primary'" />

            <!-- Inactive chips row: only shown when the attribute is NOT set -->
            <div class="selectable-attributes ion-padding-horizontal ion-padding-top">
              <ion-chip v-if="shipGroup.maySplit !== 'Y'" outline @click="confirmToggleSplit(shipGroup, true)">{{ translate('Allow split') }}</ion-chip>
              <ion-chip v-if="!shipGroup.giftMessage" outline @click="openGiftModal(shipGroup)">{{ translate('Gift options') }}</ion-chip>
              <ion-chip v-if="!shipGroup.shipAfterDate && !shipGroup.shipByDate" outline @click="openShippingDatesModal(shipGroup)">{{ translate('Shipping dates') }}</ion-chip>
              <ion-chip v-if="!shipGroup.estimatedShipDate && !shipGroup.estimatedDeliveryDate" outline @click="openDeliveryDatesModal(shipGroup)">{{ translate('Delivery dates') }}</ion-chip>
              <ion-chip v-if="!shipGroup.shippingInstructions" outline @click="openInstructionModal(shipGroup)">{{ translate('Instruction') }}</ion-chip>
            </div>

            <div class="edit-selectable-attributes ion-padding-horizontal ion-padding-top">
              <ion-item lines="none" v-if="shipGroup.maySplit === 'Y'" @click="confirmToggleSplit(shipGroup, false)">
                <ion-label>
                  {{ translate("Split allowed") }}
                </ion-label>
              </ion-item>
              <ion-item lines="none" v-if="shipGroup.giftMessage" @click="openGiftModal(shipGroup)">
                <ion-label>
                  <p>{{ translate('Gift message') }}</p>
                  {{ shipGroup.giftMessage }}
                </ion-label>
              </ion-item>
              <ion-item lines="none" v-if="shipGroup.shipAfterDate || shipGroup.shipByDate" @click="openShippingDatesModal(shipGroup)">
                <ion-label>
                  <p class="outline">{{ translate('Ship after') }}</p>
                  {{ formatDate(shipGroup.shipAfterDate) }}
                </ion-label>
                <ion-label>
                  <p class="outline">{{ translate('Ship by') }}</p>
                    {{ formatDate(shipGroup.shipByDate) }}
                </ion-label>
              </ion-item>
              <ion-item lines="none" v-if="shipGroup.estimatedShipDate || shipGroup.estimatedDeliveryDate" @click="openDeliveryDatesModal(shipGroup)">
                <ion-label>
                  <p class="outline">{{ translate('Estimated ship date') }}</p>
                  {{ formatDate(shipGroup.estimatedShipDate) }}
                </ion-label>
                <ion-label>
                  <p class="outline">{{ translate('Estimated delivery date') }}</p>
                  {{ formatDate(shipGroup.estimatedDeliveryDate) }}
                </ion-label>
              </ion-item>
              <ion-item lines="none" v-if="shipGroup.shippingInstructions" @click="openInstructionModal(shipGroup)">
                <ion-label>
                  <p class="outline">{{ translate('Instructions') }}</p>
                  {{ shipGroup.shippingInstructions }}
                </ion-label>
              </ion-item>
            </div>

            <!-- Gift message modal -->
            <ion-modal :is-open="giftModalShipGroupId === shipGroup.id" @didDismiss="giftModalShipGroupId = null">
              <ion-header>
                <ion-toolbar>
                  <ion-buttons slot="start"><ion-button @click="giftModalShipGroupId = null"><ion-icon slot="icon-only" :icon="closeOutline" /></ion-button></ion-buttons>
                  <ion-title>{{ translate('Gift message') }}</ion-title>
                </ion-toolbar>
              </ion-header>
              <ion-content class="ion-padding">
                <ion-item>
                  <ion-textarea :label="translate('Gift message')" label-placement="stacked" :rows="4" :placeholder="translate('Enter gift message')" v-model="giftMessageDraft" />
                </ion-item>
                <ion-fab vertical="bottom" horizontal="end" slot="fixed">
                  <ion-fab-button @click="saveGiftMessage(shipGroup)">
                    <ion-icon :icon="saveOutline" />
                  </ion-fab-button>
                </ion-fab>
              </ion-content>
            </ion-modal>

            <!-- Shipping dates modal -->
            <ion-modal :is-open="shippingDatesModalShipGroupId === shipGroup.id" @didDismiss="shippingDatesModalShipGroupId = null">
              <ion-header>
                <ion-toolbar>
                  <ion-buttons slot="start"><ion-button @click="shippingDatesModalShipGroupId = null"><ion-icon slot="icon-only" :icon="closeOutline" /></ion-button></ion-buttons>
                  <ion-title>{{ translate('Shipping dates') }}</ion-title>
                </ion-toolbar>
              </ion-header>
              <ion-content class="ion-padding">
                <ion-item>
                  <ion-input :label="translate('Ship after')" label-placement="stacked" type="date" v-model="shippingDatesDraft.shipAfterDate" />
                </ion-item>
                <ion-item>
                  <ion-input :label="translate('Ship by')" label-placement="stacked" type="date" v-model="shippingDatesDraft.shipByDate" />
                </ion-item>
                <ion-fab vertical="bottom" horizontal="end" slot="fixed">
                  <ion-fab-button @click="saveShippingDates(shipGroup)">
                    <ion-icon :icon="saveOutline" />
                  </ion-fab-button>
                </ion-fab>
              </ion-content>
            </ion-modal>

            <!-- Delivery dates modal -->
            <ion-modal :is-open="deliveryDatesModalShipGroupId === shipGroup.id" @didDismiss="deliveryDatesModalShipGroupId = null">
              <ion-header>
                <ion-toolbar>
                  <ion-buttons slot="start"><ion-button @click="deliveryDatesModalShipGroupId = null"><ion-icon slot="icon-only" :icon="closeOutline" /></ion-button></ion-buttons>
                  <ion-title>{{ translate('Delivery dates') }}</ion-title>
                </ion-toolbar>
              </ion-header>
              <ion-content class="ion-padding">
                <ion-item>
                  <ion-input :label="translate('Estimated ship date')" label-placement="stacked" type="date" v-model="deliveryDatesDraft.estimatedShipDate" />
                </ion-item>
                <ion-item>
                  <ion-input :label="translate('Estimated delivery date')" label-placement="stacked" type="date" v-model="deliveryDatesDraft.estimatedDeliveryDate" />
                </ion-item>
                <ion-fab vertical="bottom" horizontal="end" slot="fixed">
                  <ion-fab-button @click="saveDeliveryDates(shipGroup)">
                    <ion-icon :icon="saveOutline" />
                  </ion-fab-button>
                </ion-fab>
              </ion-content>
            </ion-modal>

            <!-- Instruction modal -->
            <ion-modal :is-open="instructionModalShipGroupId === shipGroup.id" @didDismiss="instructionModalShipGroupId = null">
              <ion-header>
                <ion-toolbar>
                  <ion-buttons slot="start"><ion-button @click="instructionModalShipGroupId = null"><ion-icon slot="icon-only" :icon="closeOutline" /></ion-button></ion-buttons>
                  <ion-title>{{ translate('Shipping instructions') }}</ion-title>
                </ion-toolbar>
              </ion-header>
              <ion-content class="ion-padding">
                <ion-item>
                  <ion-textarea :label="translate('Instructions')" label-placement="stacked" :rows="4" :placeholder="translate('Enter shipping instructions')" v-model="instructionDraft" />
                </ion-item>
                <ion-fab vertical="bottom" horizontal="end" slot="fixed">
                  <ion-fab-button @click="saveInstruction(shipGroup)">
                    <ion-icon :icon="saveOutline" />
                  </ion-fab-button>
                </ion-fab>
              </ion-content>
            </ion-modal>

            <div class="lifecycle list-item">
              <ion-item lines="none">
                <ion-label>
                  <p class="overline" v-if="timelineByShipGroup[shipGroup.id]?.firstBrokeredDate">{{ commonUtil.getRelativeTime(timelineByShipGroup[shipGroup.id]?.firstBrokeredDate) }}</p>
                  {{ translate('Brokered') }}
                </ion-label>
                <ion-note slot="end">{{ formatTime(timelineByShipGroup[shipGroup.id]?.firstBrokeredDate) || translate('Pending') }}</ion-note>
              </ion-item>
              <ion-item lines="none">
                <ion-label>
                  <p class="overline" v-if="timelineByShipGroup[shipGroup.id]?.picklistDate">{{ commonUtil.getRelativeTime(timelineByShipGroup[shipGroup.id]?.picklistDate) }}</p>
                  {{ translate('Pick') }}
                </ion-label>
                <ion-note slot="end">{{ formatTime(timelineByShipGroup[shipGroup.id]?.picklistDate) || translate('Pending') }}</ion-note>
              </ion-item>
              <ion-item lines="none">
                <ion-label>
                  <p class="overline" v-if="timelineByShipGroup[shipGroup.id]?.packedDate">{{ commonUtil.getRelativeTime(timelineByShipGroup[shipGroup.id]?.packedDate) }}</p>
                  {{ translate('Pack') }}
                </ion-label>
                <ion-note slot="end">{{ formatTime(timelineByShipGroup[shipGroup.id]?.packedDate) || translate('Pending') }}</ion-note>
              </ion-item>
              <ion-item lines="none">
                <ion-label>
                  <p class="overline" v-if="timelineByShipGroup[shipGroup.id]?.shippedDate">{{ commonUtil.getRelativeTime(timelineByShipGroup[shipGroup.id]?.shippedDate) }}</p>
                  {{ translate('Ship') }}
                </ion-label>
                <ion-note slot="end">{{ formatTime(timelineByShipGroup[shipGroup.id]?.shippedDate) || translate('Pending') }}</ion-note>
              </ion-item>
            </div>


            <div class="ship-group-items-shipping-columns">
            <div class="shipgroup-items">
              <ion-list-header>
                <ion-label>{{ translate('Items in Ship Group') }}</ion-label>
              </ion-list-header>
              <ion-item v-for="item in shipGroup.items" :key="item.id">
                <ion-checkbox slot="start" :checked="isItemSelected(shipGroup.id, item.id)" @ionChange="toggleItemSelection(shipGroup.id, item.id, $event.detail.checked)" />
                <ion-thumbnail slot="start" v-image-preview="getProduct(item.productId)" :key="getProduct(item.productId)?.mainImageUrl">
                    <DxpShopifyImg :src="item?.imageUrl" :key="getProduct(item.productId)?.mainImageUrl" size="small" />
                </ion-thumbnail>
                <ion-label>
                  <p class="overline">{{ commonUtil.getProductIdentificationValue(productIdentificationPref.secondaryId, getProduct(item.productId)) }}</p>
                  <div>
                    {{ commonUtil.getProductIdentificationValue(productIdentificationPref.primaryId, getProduct(item.productId)) ? commonUtil.getProductIdentificationValue(productIdentificationPref.primaryId, getProduct(item.productId)) : item.productId }}
                    <ion-badge class="kit-badge" color="dark" v-if="isKit(item)">{{ translate("Kit") }}</ion-badge>
                  </div>
                </ion-label>
                
                <ion-button slot="end" color="medium" fill="clear" size="small" @click.stop="viewInventory(item.productId)">
                  <ion-icon slot="icon-only" :icon="cubeOutline" />
                </ion-button>
              </ion-item>
            </div>

            <ion-list class="fulfillment">
              <ion-list-header>
                <ion-label>{{ translate('Fulfillment') }}</ion-label>
              </ion-list-header>
              <ion-item>
                <ion-select :label="translate('Carrier')" interface="popover" :placeholder="translate('Select Carrier')" :value="getSelection(shipGroup.id, shipGroup).carrierId" @ionChange="onCarrierChange(shipGroup.id, $event.detail.value)">
                  <ion-select-option v-for="carrier in availableCarriers" :key="carrier.partyId" :value="carrier.partyId">
                    {{ [carrier.firstName, carrier.lastName].filter(Boolean).join(' ') || carrier.groupName || carrier.partyId }}
                  </ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item>
                <ion-select :label="translate('Shipping method')" interface="popover" :placeholder="translate('Select Shipping Method')" :value="getSelection(shipGroup.id, shipGroup).methodId || undefined" @ionChange="onMethodChange(shipGroup.id, $event.detail.value)">
                  <ion-select-option v-for="method in methodsForCarrier(getSelection(shipGroup.id, shipGroup).carrierId)" :key="method.shipmentMethodTypeId" :value="method.shipmentMethodTypeId">
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
                <ion-label slot="end" class="ion-text-end">
                  <p>{{ translate('Shipping information') }}</p>
                  <ion-button fill="clear" size="small" :id="'shipping-opt-trigger-' + shipGroup.id">
                    <ion-icon slot="icon-only" :icon="ellipsisVertical" />
                  </ion-button>
                  <ion-popover :trigger="'shipping-opt-trigger-' + shipGroup.id" dismiss-on-select show-backdrop="false">
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
                </ion-label>
              </ion-item>

              <!-- Edit shipping address modal -->
              <ion-modal :is-open="editingShipGroupId === shipGroup.id" @didDismiss="closeEditShippingAddress">
                <ion-header>
                  <ion-toolbar>
                    <ion-buttons slot="start">
                      <ion-button @click="closeEditShippingAddress"><ion-icon slot="icon-only" :icon="closeOutline" /></ion-button>
                    </ion-buttons>
                    <ion-title>{{ translate('Edit Shipping Address') }}</ion-title>
                    <ion-buttons slot="end">
                    </ion-buttons>
                  </ion-toolbar>
                </ion-header>
                <ion-content class="ion-padding">
                  <ion-list>
                    <ion-item>
                      <ion-input :label="translate('Address line 1')" label-placement="stacked" :placeholder="translate('Street address')" v-model="shippingAddressForm.address1" />
                    </ion-item>
                    <ion-item>
                      <ion-input :label="translate('Address line 2')" label-placement="stacked" :placeholder="translate('Apt, suite, etc.')" v-model="shippingAddressForm.address2" />
                    </ion-item>
                    <ion-item>
                      <ion-input :label="translate('City')" label-placement="stacked" :placeholder="translate('City')" v-model="shippingAddressForm.city" />
                    </ion-item>
                    <ion-item>
                      <ion-input :label="translate('Postal code')" label-placement="stacked" :placeholder="translate('Postal code')" v-model="shippingAddressForm.postalCode" />
                    </ion-item>
                    <ion-item>
                      <ion-select
                        :label="translate('Country')"
                        label-placement="stacked"
                        interface="popover"
                        :placeholder="translate('Select Country')"
                        v-model="shippingAddressForm.countryGeoId"
                        @ionChange="shippingAddressForm.stateProvinceGeoId = ''"
                      >
                        <ion-select-option v-for="country in seed.getCountries" :key="country.geoId" :value="country.geoId">
                          {{ country.geoName }}
                        </ion-select-option>
                      </ion-select>
                    </ion-item>
                    <ion-item>
                      <ion-select
                        :label="translate('State / Province')"
                        label-placement="stacked"
                        interface="popover"
                        :placeholder="translate('Select State / Province')"
                        :disabled="!shippingAddressForm.countryGeoId"
                        v-model="shippingAddressForm.stateProvinceGeoId"
                      >
                        <ion-select-option v-for="state in statesForCountry" :key="state.geoId" :value="state.geoId">
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

            <div class="actions ion-padding-horizontal ion-padding-bottom">
              <ion-button v-if="isVirtualFacility(shipGroup)" fill="clear" @click="brokerShipGroup(shipGroup.id)">{{ translate('Broker ship group') }}</ion-button>
              <ion-button fill="clear" :disabled="!selectedItemsForShipGroup(shipGroup.id).length" @click="isVirtualFacility(shipGroup) ? parkSelectedItems(shipGroup) : rejectSelectedItems(shipGroup)">{{ isVirtualFacility(shipGroup) ? translate('Park Items') : translate('Pull back') }}</ion-button>
              <ion-button v-if="isVirtualFacility(shipGroup)" fill="clear" :disabled="!selectedItemsForShipGroup(shipGroup.id).length" @click="releaseSelectedItems(shipGroup)">{{ translate('Release') }}</ion-button>
              <ion-button fill="clear" @click="openAddTaskModal(shipGroup)">{{ translate('Add Task') }}</ion-button>
              <ion-button fill="clear" @click="openAddItemModal(shipGroup)">{{ translate('Add Items') }}</ion-button>
            </div>
          </ion-card>
        </template>

        <template v-else>
          <EmptyState
            :title="translate('No ship groups')"
            :message="translate('There are no ship groups defined for this order.')"
          />
        </template>
      </div>

      <div v-if="selectedSegment === 'holds'">
        <div v-if="openHolds.length">
          <div class="list-item work-effort-row" v-for="hold in openHolds" :key="hold.id">
            <ion-item lines="none">
              <ion-label>
                {{ hold.id }}
                <p>{{ translate("ID") }}</p>
              </ion-label>
            </ion-item>
            <div class="tablet">
              <ion-label class="ion-text-center">
                {{ seed.enumDescription(hold.purposeTypeId) || hold.purposeTypeId || '-' }}
                <p>{{ translate("purpose") }}</p>
              </ion-label>
            </div>
            <div class="tablet">
              <ion-label class="ion-text-center">
                {{ hold.description || '-' }}
                <p>{{ translate("description") }}</p>
              </ion-label>
            </div>
            <div class="tablet">
              <ion-label class="ion-text-center">
                <ion-badge :color="commonUtil.getStatusColor(hold.statusId)">{{ seed.statusDescription(hold.statusId) }}</ion-badge>
                <p>{{ translate("status") }}</p>
              </ion-label>
            </div>
          </div>
        </div>
        <ion-list v-if="!openHolds.length">
          <ion-item lines="none">
            <ion-label>{{ translate("No holds on this order") }}</ion-label>
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
      <ErrorState
        :title="translate('Order failed to load')"
        :message="error"
      />
    </ion-content>

    <ion-content v-else>
      <EmptyState
        :title="translate('Order not found')"
        :message="translate('The selected order is not available in this workspace.')"
      />
    </ion-content>

    <ion-footer v-if="order && selectedSegment === 'items'">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button fill="outline" color="danger" v-if="!['ORDER_CANCELLED', 'ORDER_COMPLETED'].includes(order.statusId)" :disabled="!selectedItems.length" @click="cancelOrderItems">{{ translate('Cancel') }}</ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button fill="solid" color="warning">{{ translate('Return') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { IonAccordion, IonAccordionGroup, IonBackButton, IonBadge, IonButton, IonButtons, IonCard, IonCardHeader, IonCardTitle, IonCheckbox, IonChip, IonContent, IonFab, IonFabButton, IonFooter, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonMenuButton, IonModal, IonNote, IonPage, IonPopover, IonProgressBar, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonTextarea, IonThumbnail, IonTitle, IonToolbar, alertController, modalController } from '@ionic/vue';
import { storeToRefs } from 'pinia';
import { DateTime } from 'luxon';
import { businessOutline, chevronDown, closeOutline, createOutline, cubeOutline, ellipsisVertical, gitBranchOutline, saveOutline, sendOutline } from 'ionicons/icons';
import { useOrderDetailStore } from '@/store/orderDetail';
import { useSeedStore } from '@/store/seed';
import { useProductCacheStore } from '@/store/productCache';
import { useProductMaster } from '@/composables/useProductMaster';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import AddItemToOrderModal from '@/components/AddItemToOrderModal.vue';
import RejectItemsModal from '@/components/RejectItemsModal.vue';
import ProductInventoryModal from '@/components/ProductInventoryModal.vue';
import FacilityModal from '@/components/FacilityModal.vue';
import PhysicalFacilityModal from '@/components/PhysicalFacilityModal.vue';
import RoutingGroupModal from '@/components/RoutingGroupModal.vue';
import OrderItemAttributesModal from '@/components/OrderItemAttributesModal.vue';
import ItemFacilityInventoryModal from '@/components/ItemFacilityInventoryModal.vue';
import AddOrderTaskModal from '@/components/AddOrderTaskModal.vue';
import { api, commonUtil, DxpShopifyImg, translate } from '@common';
import { showToast, isKit } from '@/utils';
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
      paymentMethodTypeDesc: seed.paymentMethodDescription(payment.paymentMethodTypeId),
      amount: payment.maxAmount ?? payment.presentmentAmount,
      statusDesc: seed.statusDescription(payment.statusId)
    })),
    shipGroups: (raw.shipGroups || []).map((shipGroup: any) => ({
      id: shipGroup.shipGroupSeqId,
      facilityId: shipGroup.facilityId,
      facilityTypeId: seed.facility(shipGroup.facilityId)?.facilityTypeId,
      facilityParentTypeId: seed.facilityType(seed.facility(shipGroup.facilityId)?.facilityTypeId)?.parentTypeId,
      facilityName: seed.facilityName(shipGroup.facilityId),
      itemSummary: shipGroupItemSummary(shipGroup),
      maySplit: shipGroup.maySplit,
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

const openHolds = computed(() => orderDetailStore.orderHeaderWorkEfforts.map((link: any) => {
  const we = link['org.apache.ofbiz.workeffort.workeffort.WorkEffort'] || link;
  return {
    id: link.workEffortId,
    purposeTypeId: we.workEffortPurposeTypeId || '',
    statusId: we.statusId || '',
    description: we.description || ''
  };
}));

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
        attributeCount: rawItem?.orderItemAttributes?.length || rawItem?.attributes?.length || rawItem?.orderItemAttributeList?.length || 0
      });
    });
  });

  return Object.values(groups);
});

const orderTotals = computed(() => orderDetailStore.totals);

const selectedSegment = ref('items');

watch(selectedSegment, (segment) => {
  if (!props.orderId) return;
  if (segment === 'holds') {
    orderDetailStore.fetchOrderHeaderWorkEfforts(props.orderId);
    seed.loadEnumsByParentType('WorkEffortPurposeType');
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

// 1. Allow Split
async function confirmToggleSplit(shipGroup: any, enable: boolean) {
  const alert = await alertController.create({
    header: translate('Allow split'),
    message: enable
      ? translate('Are you sure you want to allow split?')
      : translate('Are you sure you want to disable splitting for this order?'),
    buttons: [
      { text: translate('Cancel'), role: 'cancel' },
      {
        text: translate('Yes'),
        handler: async () => {
          try {
            await updateShipGroup(shipGroup.id, { maySplit: enable ? 'Y' : 'N' });
            await showToast(translate(enable ? 'Split allowed.' : 'Split disabled.'));
          } catch {
            await showToast(translate('Failed to update split setting.'));
          }
        },
      },
    ],
  });
  await alert.present();
}

// 2. Gift message
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
    .map(([comment, amount]) => ({ comment, amount }))
    .filter(adj => adj.amount !== 0);
}

const orderTaskStore = useOrderTaskStore();
const userStore = useUserStore();

async function openFacilityModal(): Promise<string | null> {
  const modal = await modalController.create({ component: FacilityModal });
  await modal.present();
  const { data: facilityId } = await modal.onWillDismiss();
  return facilityId ?? null;
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
    componentProps: { productId }
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
              comment:""
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

ion-card-header  ion-card-title {
  grid-area: title;
}

ion-card-header  ion-card-subtitle {
  grid-area: subtitle;
}

ion-card-header  ion-note,
ion-card-header  ion-button,
ion-card-header  ion-buttons {
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

.order-item-rollup {
  --columns-desktop: 4;
  --columns-tablet: 4;
  padding-inline-end: var(--spacer-base);
}

.order-item-row {
  --columns-desktop: 5;
  --columns-tablet: 5;
}

.work-effort-row {
  --columns-desktop: 4;
  --columns-tablet: 4;
}

.work-effort-row > ion-item {
  width: 100%;
}

.comm-event-row {
  --columns-desktop: 5;
  --columns-tablet: 5;
}

.comm-event-row > ion-item {
  width: 100%;
}

.selectable-attributes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.edit-selectable-attributes {
  display: grid;
  gap: var(--spacer-base);
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}

.edit-selectable-attributes > ion-item {
  border: var(--border-medium);
  border-radius: 10px;
}

.ship-group-items-shipping-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.lifecycle {
  --columns-desktop: 4;
}
.order-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
</style>
