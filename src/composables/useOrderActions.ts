import { computed, type Ref } from 'vue';
import { alertController, modalController } from '@ionic/vue';
import { api, translate } from '@common';
import { showToast } from '@/utils';
import { OrderActionValidator, type ShipGroupActionId } from '@/utils/OrderActionValidator';
import { inventoryTransferOpenQuantity, isInventoryTransferEligibleItem } from '@/services/inventoryTransfers';
import { useProductIdentity } from '@/composables/useProductIdentity';
import { useCustomerStore } from '@/store/customer';
import { useOrderDetailStore } from '@/store/orderDetail';
import { useOrderTaskStore } from '@/store/orderTask';
import { useProductStore } from '@/store/productStore';
import { useSeedStore } from '@/store/seed';
import type { EnrichedOrder, EnrichedOrderItem, EnrichedShipGroup } from '@/types/orderDetail';

import AddContactModal from '@/components/AddContactModal.vue';
import AddItemToOrderModal from '@/components/orders/AddItemToOrderModal.vue';
import AddOrderTaskModal from '@/components/tasks/AddOrderTaskModal.vue';
import CloneOrderModal from '@/components/orders/CloneOrderModal.vue';
import FacilityInventoryModal from '@/components/fulfillment/FacilityInventoryModal.vue';
import FacilityModal from '@/components/fulfillment/FacilityModal.vue';
import ManageOrderIdentificationsModal from '@/components/orders/ManageOrderIdentificationsModal.vue';
import OrderItemAttributesModal from '@/components/orders/OrderItemAttributesModal.vue';
import ProductInventoryModal from '@/components/inventory/ProductInventoryModal.vue';
import RejectItemsModal from '@/components/orders/RejectItemsModal.vue';
import RequestInventoryTransferModal from '@/components/inventory/RequestInventoryTransferModal.vue';
import RiskAssessmentModal from '@/components/orders/RiskAssessmentModal.vue';
import RoutingGroupModal from '@/components/fulfillment/RoutingGroupModal.vue';

export interface UseOrderActionsOptions {
  order: Ref<EnrichedOrder | null>;
  loadOrder: (orderId: string, force?: boolean) => Promise<void>;
  /** Items checked on the Items tab; they drive "Cancel items". */
  selectedItemIds: Ref<Set<string>>;
  /** Items checked on each ship group card, keyed by ship group id. */
  selectedShipGroupItems: Ref<Record<string, string[]>>;
  selectedSegment: Ref<string>;
}

const FOOTER_TERMINAL_ITEM_STATUSES = ['ITEM_CANCELLED', 'ITEM_COMPLETED'];
/**
 * The footer renders only the actions the engine reports as valid AND that have a handler here
 * (Appeasement/Reship are modelled but excluded until their backend lands).
 */
const DISPATCHABLE_FOOTER_IDS = new Set(['CANCEL_ITEMS', 'ORDER_CANCELLED', 'RETURN']);

/**
 * The order page's actions and the one validator path that gates them. A button's enabled state
 * and its click handler both ask the same question, so a button never offers what the handler
 * then refuses.
 */
export function useOrderActions({ order, loadOrder, selectedItemIds, selectedShipGroupItems, selectedSegment }: UseOrderActionsOptions) {
  const orderDetailStore = useOrderDetailStore();
  const orderTaskStore = useOrderTaskStore();
  const customerStore = useCustomerStore();
  const seed = useSeedStore();
  const { getProduct, primaryIdentifier } = useProductIdentity();

  const allItems = computed(() => (order.value?.groupedItems || []).flatMap((group) => group.items));
  const selectedItems = computed(() => allItems.value.filter((item) => selectedItemIds.value.has(item.orderItemSeqId)));
  const shipGroupById = (shipGroupId: string) => order.value?.shipGroups.find((shipGroup) => shipGroup.id === shipGroupId) || null;
  const isVirtualForItem = (item: EnrichedOrderItem) => shipGroupById(item.shipGroupSeqId)?.isVirtual ?? !item.facilityId;

  /* ── Gating ───────────────────────────────────────────────────────────── */

  /** Selection NARROWS a ship group action; with nothing checked it covers the whole group. */
  function actionableItems(shipGroup: EnrichedShipGroup) {
    const items = allItems.value.filter((item) => item.shipGroupSeqId === shipGroup.id);
    const selected = new Set(selectedShipGroupItems.value[shipGroup.id] || []);
    return selected.size ? items.filter((item) => selected.has(item.orderItemSeqId)) : items;
  }

  function shipGroupActionValidation(shipGroup: EnrichedShipGroup, actionId: ShipGroupActionId) {
    if (!order.value) return { allowed: false };
    return OrderActionValidator.validateShipGroupAction(order.value, shipGroup, actionId, actionableItems(shipGroup), {
      isVirtual: shipGroup.isVirtual,
      allItems: allItems.value
    });
  }

  const isShipGroupActionDisabled = (shipGroup: EnrichedShipGroup, actionId: ShipGroupActionId) =>
    !shipGroupActionValidation(shipGroup, actionId).allowed;

  function itemActionContext(item: EnrichedOrderItem) {
    return {
      isVirtual: isVirtualForItem(item),
      itemAllowedToStatusIds: new Set<string>(seed.allowedTransitions(item.statusId).map((transition: any) => transition.toStatusId)),
      allItems: allItems.value
    };
  }

  /** The facility chip: release from a virtual facility, reject-and-release from a physical one. */
  function itemFacilityActionValidation(item: EnrichedOrderItem) {
    if (!order.value) return { allowed: false };
    const shipGroup = shipGroupById(item.shipGroupSeqId);
    if (shipGroup?.isVirtual) {
      return OrderActionValidator.validateShipGroupAction(order.value, shipGroup, 'RELEASE', [item], { isVirtual: true, allItems: allItems.value });
    }
    return OrderActionValidator.validateItemAction(order.value, item, 'REJECT_AND_RELEASE', itemActionContext(item));
  }

  /**
   * Whether this row may offer Cancel. A non-terminal item is not enough: the validator also
   * refuses once the ORDER is terminal, and when the seed transition table has no
   * ITEM_CANCELLED edge from the item's current status.
   */
  function itemCancelValidation(item: EnrichedOrderItem) {
    if (!order.value) return { allowed: false, reason: 'Order is not loaded.' };
    return OrderActionValidator.validateItemAction(order.value, item, 'CANCEL_ITEM', itemActionContext(item));
  }

  /** What the transfer modal and the facility picker show for an item. */
  const itemName = (item: EnrichedOrderItem) => primaryIdentifier(item.productId) || item.name || item.externalId;
  const transferItem = (item: EnrichedOrderItem) => ({
    ...item,
    name: itemName(item),
    sku: item.sku || item.productId || '',
    imageUrl: getProduct(item.productId)?.mainImageUrl
  });

  const isInventoryTransferRequestEligible = (item: EnrichedOrderItem) =>
    isInventoryTransferEligibleItem(transferItem(item), isVirtualForItem(item));

  const inventoryTransferItemsForShipGroup = (shipGroup: EnrichedShipGroup) =>
    shipGroup.isVirtual ? [] : actionableItems(shipGroup).filter(isInventoryTransferRequestEligible);

  async function showUnavailableAction(validation: any) {
    await showToast(translate(validation?.reason || 'Action is not available.'));
  }

  /* ── Modals shared by several actions ─────────────────────────────────── */

  async function openFacilityModal(): Promise<string | null> {
    const modal = await modalController.create({ component: FacilityModal });
    await modal.present();
    const { data: facilityId } = await modal.onWillDismiss();
    return facilityId ?? null;
  }

  /**
   * One picker for both entry points: releasing a single item from the Items tab and releasing a
   * ship group's selection differ only in how many items are handed over.
   */
  async function openFacilityInventoryModal(items: EnrichedOrderItem[]): Promise<string | null> {
    const modal = await modalController.create({
      component: FacilityInventoryModal,
      componentProps: {
        items: items.map((item) => ({
          orderItemSeqId: item.orderItemSeqId,
          productId: item.productId || '',
          name: itemName(item),
          imageUrl: getProduct(item.productId)?.mainImageUrl,
          quantity: Number(item.quantity || 1)
        })),
        productStoreId: order.value?.productStoreId
      },
      cssClass: 'facility-inventory-modal'
    });
    await modal.present();
    const { data: facilityId } = await modal.onWillDismiss();
    return facilityId ?? null;
  }

  async function openInventoryTransferRequestModal(shipGroup: EnrichedShipGroup, items: EnrichedOrderItem[]) {
    const modal = await modalController.create({
      component: RequestInventoryTransferModal,
      componentProps: {
        orderId: order.value!.id,
        productStoreId: order.value!.productStoreId,
        destinationFacilityId: shipGroup.facilityId,
        items: items.map((item) => {
          const requested = transferItem(item);
          return { ...requested, quantity: inventoryTransferOpenQuantity(requested) };
        }),
      },
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') await showToast(translate('Inventory transfer requested.'));
  }

  /* ── Ship group actions ───────────────────────────────────────────────── */

  async function brokerShipGroup(shipGroup: EnrichedShipGroup) {
    const validation = shipGroupActionValidation(shipGroup, 'BROKER');
    if (!validation.allowed) return showUnavailableAction(validation);

    const productStoreId = useProductStore().getCurrentProductStore.productStoreId;
    const modal = await modalController.create({ component: RoutingGroupModal, componentProps: { productStoreId } });
    await modal.present();
    const { data: routingGroupId } = await modal.onWillDismiss();
    if (!routingGroupId) return;
    try {
      await orderTaskStore.brokerShipGroup({ routingGroupId, orderId: order.value!.id, shipGroupSeqId: shipGroup.id, productStoreId });
      await showToast(translate('Ship group brokered successfully.'));
      await loadOrder(order.value!.id, true);
    } catch {
      await showToast(translate('Failed to broker the ship group. Please try again.'));
    }
  }

  async function parkSelectedItems(shipGroup: EnrichedShipGroup) {
    const validation = shipGroupActionValidation(shipGroup, 'PARK_ITEMS');
    if (!validation.allowed) return showUnavailableAction(validation);

    const itemIds = actionableItems(shipGroup)
      .filter((item) => !OrderActionValidator.isItemTerminal(item))
      .map((item) => item.orderItemSeqId);
    if (!itemIds.length) return;
    const facilityId = await openFacilityModal();
    if (!facilityId) return;
    const orderId = order.value!.id;
    try {
      for (const orderItemSeqId of itemIds) {
        await api({
          url: `oms/orders/${orderId}/moveItemToParking`,
          method: 'POST',
          data: { orderId, orderItemSeqId, shipGroupSeqId: shipGroup.id, toFacilityId: facilityId },
        });
      }
      selectedShipGroupItems.value[shipGroup.id] = [];
      await showToast(translate('Items moved to parking.'));
      await loadOrder(orderId, true);
    } catch {
      await showToast(translate('Failed to park items. Please try again.'));
    }
  }

  async function rejectSelectedItems(shipGroup: EnrichedShipGroup) {
    const validation = shipGroupActionValidation(shipGroup, 'PULL_BACK');
    if (!validation.allowed) return showUnavailableAction(validation);

    const itemIds = actionableItems(shipGroup)
      .filter((item) => !OrderActionValidator.isItemTerminal(item))
      .map((item) => item.orderItemSeqId);
    if (!itemIds.length) return;

    const modal = await modalController.create({ component: RejectItemsModal });
    await modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role !== 'confirm') return;

    const orderId = order.value!.id;
    try {
      await api({
        url: `oms/orders/${orderId}/reject`,
        method: 'POST',
        data: {
          orderId,
          items: itemIds.map((orderItemSeqId) => ({ orderItemSeqId, quantity: '1', rejectionReasonId: data?.rejectionReasonId })),
        },
      });
      selectedShipGroupItems.value[shipGroup.id] = [];
      await showToast(translate('Items rejected successfully.'));
      await loadOrder(orderId, true);
    } catch {
      await showToast(translate('Failed to reject items. Please try again.'));
    }
  }

  async function releaseSelectedItems(shipGroup: EnrichedShipGroup) {
    const validation = shipGroupActionValidation(shipGroup, 'RELEASE');
    if (!validation.allowed) return showUnavailableAction(validation);

    const releasableItems = actionableItems(shipGroup).filter((item) => OrderActionValidator.isItemPreFulfill(item));
    if (!releasableItems.length) return;
    const facilityId = await openFacilityInventoryModal(releasableItems);
    if (!facilityId) return;
    const orderId = order.value!.id;
    try {
      for (const { orderItemSeqId } of releasableItems) {
        await api({
          url: `oms/orders/${orderId}/items/${orderItemSeqId}/allocation`,
          method: 'POST',
          data: { facilityId, orderFacilityChange: { changeReasonEnumId: 'RELEASED' } },
        });
      }
      selectedShipGroupItems.value[shipGroup.id] = [];
      await showToast(translate('Items released to facility.'));
      await loadOrder(orderId, true);
    } catch {
      await showToast(translate('Failed to release items. Please try again.'));
    }
  }

  async function requestInventoryTransfersForShipGroup(shipGroup: EnrichedShipGroup) {
    const items = inventoryTransferItemsForShipGroup(shipGroup);
    if (items.length) await openInventoryTransferRequestModal(shipGroup, items);
  }

  async function openAddTaskModal(shipGroup: EnrichedShipGroup) {
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

  async function openAddItemModal(shipGroup: EnrichedShipGroup) {
    const orderId = order.value!.id;
    const modal = await modalController.create({
      component: AddItemToOrderModal,
      componentProps: { orderId, shipGroupSeqId: shipGroup.id, onItemAdded: () => loadOrder(orderId) },
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') await loadOrder(orderId, true);
  }

  async function viewInventory(productId: string) {
    const modal = await modalController.create({ component: ProductInventoryModal, componentProps: { productId } });
    await modal.present();
  }

  async function saveCarrierAndMethod(shipGroup: EnrichedShipGroup, carrierPartyId: string, shipmentMethodTypeId: string) {
    try {
      await orderDetailStore.updateShipmentCarrierAndMethod(order.value!.id, shipGroup.id, shipmentMethodTypeId, carrierPartyId);
      await showToast(translate('Carrier and shipping method updated successfully.'));
      await loadOrder(order.value!.id, true);
    } catch {
      await showToast(translate('Failed to update carrier and shipping method. Please try again.'));
    }
  }

  /* ── Item actions ─────────────────────────────────────────────────────── */

  async function rejectAndReleaseItem(item: EnrichedOrderItem) {
    const validation = itemFacilityActionValidation(item);
    if (!validation.allowed) return showUnavailableAction(validation);

    const orderId = order.value!.id;
    const facilityId = await openFacilityInventoryModal([item]);
    if (!facilityId) return;

    if (!isVirtualForItem(item)) {
      try {
        await api({ url: `oms/orders/${orderId}/items/${item.orderItemSeqId}/reject`, method: 'POST', data: { rejectionReasonId: 'NO_VARIANCE_LOG' } });
      } catch {
        await showToast(translate('Failed to reject the item. Please try again.'));
        return;
      }
    }

    try {
      await api({
        url: `oms/orders/${orderId}/items/${item.orderItemSeqId}/allocation`,
        method: 'POST',
        data: { facilityId, orderFacilityChange: { changeReasonEnumId: 'RELEASED' } },
      });
      await showToast(translate('Item released to facility.'));
    } catch {
      await showToast(translate('Failed to release the item. Please try again.'));
    } finally {
      await loadOrder(orderId, true);
    }
  }

  async function requestInventoryTransferForItem(item: EnrichedOrderItem) {
    const shipGroup = shipGroupById(item.shipGroupSeqId);
    if (!shipGroup || !isInventoryTransferRequestEligible(item)) return;
    await openInventoryTransferRequestModal(shipGroup, [item]);
  }

  function cancelItems(orderId: string, items: EnrichedOrderItem[]) {
    return orderTaskStore.cancelOrder(orderId, items.map((item) => ({
      orderItemSeqId: item.orderItemSeqId,
      shipGroupSeqId: item.shipGroupSeqId,
      reason: 'NO_VARIANCE_LOG',
      comment: ''
    })));
  }

  async function confirmAlert(header: string, message: string, confirmText: string, onConfirm: () => Promise<void> | void) {
    const alert = await alertController.create({
      header,
      message,
      buttons: [
        { text: translate('Cancel'), role: 'cancel' },
        { text: confirmText, role: 'confirm', handler: () => { onConfirm(); } }
      ]
    });
    await alert.present();
  }

  async function cancelSingleItem(item: EnrichedOrderItem) {
    if (!order.value) return;
    // The row can have been rendered before a refresh moved the item or the order on, so the
    // handler asks the validator again rather than trusting the button that called it.
    const validation = itemCancelValidation(item);
    if (!validation.allowed) return showUnavailableAction(validation);

    const orderId = order.value.id;
    await confirmAlert(translate('Cancel Item'), translate('Are you sure you want to cancel this item? This action cannot be undone.'), translate('Cancel item'), async () => {
      try {
        await cancelItems(orderId, [item]);
        await showToast(translate('Item cancelled successfully.'));
        await loadOrder(orderId, true);
      } catch {
        await showToast(translate('Failed to cancel the item. Please try again.'));
      }
    });
  }

  async function openItemAttributesModal(item: EnrichedOrderItem) {
    const orderId = order.value!.id;
    const modal = await modalController.create({
      component: OrderItemAttributesModal,
      componentProps: { orderId, orderItemSeqId: item.orderItemSeqId, attributes: item.attributes }
    });
    await modal.present();
    await modal.onDidDismiss();
    await loadOrder(orderId, true);
  }

  /** Items tab "Add items": straight to the only ship group, or ask which one. */
  async function openAddItemFromItemsSegment() {
    const shipGroups = order.value?.shipGroups || [];
    if (!shipGroups.length) return showToast(translate('No ship groups are available for this order.'));
    if (shipGroups.length === 1) return openAddItemModal(shipGroups[0]);

    let selectedShipGroup: EnrichedShipGroup | null = null;
    const alert = await alertController.create({
      header: translate('Select ship group'),
      buttons: [
        ...shipGroups.map((shipGroup) => ({
          text: `${shipGroup.id} ${shipGroup.facilityName || translate('Facility Name')}`,
          handler: () => { selectedShipGroup = shipGroup; }
        })),
        { text: translate('Cancel'), role: 'cancel' }
      ]
    });
    await alert.present();
    await alert.onDidDismiss();
    if (selectedShipGroup) await openAddItemModal(selectedShipGroup);
  }

  /* ── Order (footer) actions ───────────────────────────────────────────── */

  async function cancelOrderItems() {
    if (!order.value || !selectedItems.value.length) return;
    const orderId = order.value.id;
    const itemsSnapshot = [...selectedItems.value];
    const message = translate('Are you sure you want to cancel the {count} selected item(s)? This action cannot be undone.').replace('{count}', String(itemsSnapshot.length));
    await confirmAlert(translate('Cancel items'), message, translate('Cancel items'), async () => {
      try {
        await cancelItems(orderId, itemsSnapshot);
        selectedItemIds.value.clear();
        await showToast(translate('Selected items cancelled successfully.'));
        await loadOrder(orderId, true);
      } catch {
        await showToast(translate('Failed to cancel the selected items. Please try again.'));
      }
    });
  }

  async function cancelOrder(orderId: string) {
    const items = allItems.value.filter((item) => !FOOTER_TERMINAL_ITEM_STATUSES.includes(item.statusId));
    if (!items.length) return;
    await confirmAlert(translate('Cancel order'), translate('Are you sure you want to cancel this order?'), translate('Cancel order'), async () => {
      try {
        await cancelItems(orderId, items);
        await showToast(translate('Order cancelled successfully.'));
        await loadOrder(orderId, true);
      } catch {
        await showToast(translate('Failed to cancel the order. Please try again.'));
      }
    });
  }

  async function changeOrderStatus(orderId: string, statusId: string) {
    try {
      await api({ url: `oms/orders/${orderId}/status`, method: 'POST', data: { orderId, statusId, setItemStatus: true } });
      await showToast(translate('Order status updated successfully.'));
      await loadOrder(orderId, true);
    } catch {
      await showToast(translate('Failed to update the order status. Please try again.'));
    }
  }

  async function runOrderStatusAction(action: any) {
    if (!order.value) return;
    const orderId = order.value.id;
    if (action.id === 'ORDER_CANCELLED') return cancelOrder(orderId);
    if (action.color === 'danger') {
      return confirmAlert(translate(action.label), translate("Are you sure you want to change this order's status?"), translate(action.label),
        () => changeOrderStatus(orderId, action.toStatusId));
    }
    await changeOrderStatus(orderId, action.toStatusId);
  }

  async function startReturn() {
    // Returns are a separate workstream (docs/ReturnsMigrationExecution.md); this button only
    // appears once the order has a completed (returnable) item.
    await showToast(translate('Returns are not available here yet.'));
  }

  async function openCloneOrderModal() {
    const modal = await modalController.create({ component: CloneOrderModal });
    await modal.present();
    // Success feedback (toast with the new Shopify order name) is shown by the modal. No reload —
    // the cloned order lives in Shopify until the bridge syncs it back.
    await modal.onWillDismiss();
  }

  /** The footer's valid-only action set: status transitions plus lifecycle actions. */
  const footerActions = computed(() => {
    if (!order.value) return [];
    const allowedTransitions = seed.allowedTransitions(order.value.statusId);
    const context = {
      allItems: allItems.value,
      orderAllowedToStatusIds: new Set<string>(allowedTransitions.map((transition: any) => transition.toStatusId))
    };
    return OrderActionValidator
      .getOrderFooterActions(order.value, allowedTransitions, selectedItems.value, context)
      .filter((action: any) => action.kind === 'status' || DISPATCHABLE_FOOTER_IDS.has(action.id));
  });

  function runFooterAction(action: any) {
    // Dispatch by id (not kind) — the cancel button rides on the start as kind 'status' in both
    // modes, but CANCEL_ITEMS has its own handler.
    switch (action.id) {
      case 'CLONE': return openCloneOrderModal();
      case 'CANCEL_ITEMS': return cancelOrderItems();
      case 'RETURN': return startReturn();
      default: return runOrderStatusAction(action);
    }
  }

  /** The morphing cancel shows its live selection count; everything else is a static label. */
  function footerActionLabel(action: any): string {
    if (action.id === 'CANCEL_ITEMS') return translate('Cancel {count} items').replace('{count}', String(selectedItems.value.length));
    return translate(action.label);
  }

  /* ── Header and Holds actions ─────────────────────────────────────────── */

  async function openCustomerContactModal(contactMechTypeId: string, contactMechPurposeTypeId: string) {
    const partyId = order.value?.customer.partyId;
    if (!partyId) return showToast(translate('Customer is not available for this order.'));

    const modal = await modalController.create({ component: AddContactModal, componentProps: { contactMechTypeId, contactMechPurposeTypeId } });
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

  async function saveOrderLocale(localeString: string) {
    if (!order.value?.id) return;
    try {
      await api({ url: `oms/orders/${order.value.id}`, method: 'PUT', data: { orderId: order.value.id, localeString } });
      await loadOrder(order.value.id, true);
      await showToast(translate('Order locale updated successfully.'));
    } catch {
      await showToast(translate('Failed to update order locale. Please try again.'));
    }
  }

  async function openLocalePrompt() {
    if (!order.value?.id) return;
    const alert = await alertController.create({
      header: translate('Locale'),
      inputs: [{ name: 'localeString', type: 'text', placeholder: 'en-US' }],
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

  async function openManageIdentificationsModal() {
    const orderId = order.value!.id;
    const modal = await modalController.create({
      component: ManageOrderIdentificationsModal,
      componentProps: { orderId, identifications: order.value!.identifications }
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') await loadOrder(orderId, true);
  }

  async function openRiskDetails() {
    const modal = await modalController.create({
      component: RiskAssessmentModal,
      componentProps: { risks: orderDetailStore.riskAssessmentsByOrderId[order.value!.id] || [] },
    });
    await modal.present();
  }

  const reloadHoldTasks = () => orderTaskStore.fetchOrderHoldTasks(order.value!.id);

  /**
   * Create one or more hold tasks from the Holds tab. Single-ship-group orders default
   * automatically; multi-ship-group orders let the user pick which groups to add the task to.
   */
  async function openCreateHoldTaskModal() {
    const currentOrder = order.value;
    if (!currentOrder) return;

    const shipGroups = currentOrder.shipGroups.map((shipGroup) => ({
      id: shipGroup.id,
      label: shipGroup.facilityName ? `${shipGroup.id} ${shipGroup.facilityName}` : shipGroup.id,
    }));
    if (!shipGroups.length) return showToast(translate('This order has no ship groups to add a task to.'));

    const modal = await modalController.create({
      component: AddOrderTaskModal,
      componentProps: { shipGroups, title: translate('Create hold task'), defaultWorkEffortPurposeTypeId: 'ORD_HOLD_MANUAL' },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role !== 'confirm' || !data) return;

    const shipGroupSeqIds: string[] = data.shipGroupSeqIds?.length ? data.shipGroupSeqIds : shipGroups.map((shipGroup) => shipGroup.id);
    try {
      await api({
        url: 'oms/orders/tasks',
        method: 'POST',
        data: shipGroupSeqIds.map((shipGroupSeqId) => ({
          orderId: currentOrder.id,
          shipGroupSeqId,
          workEffortName: data.workEffortName,
          workEffortTypeId: data.workEffortTypeId,
          workEffortPurposeTypeId: data.workEffortPurposeTypeId,
          description: data.description,
          statusId: 'TASK_CREATED',
        })),
      });
      await showToast(translate('Tasks created successfully.'));
      selectedSegment.value = 'holds';
      await reloadHoldTasks();
    } catch {
      await showToast(translate('Failed to create tasks. Please try again.'));
    }
  }

  return {
    // gating
    isShipGroupActionDisabled,
    isItemFacilityActionDisabled: (item: EnrichedOrderItem) => !itemFacilityActionValidation(item).allowed,
    isItemCancelAllowed: (item: EnrichedOrderItem) => itemCancelValidation(item).allowed,
    isInventoryTransferRequestEligible,
    inventoryTransferItemsForShipGroup,
    // ship group
    brokerShipGroup,
    parkSelectedItems,
    rejectSelectedItems,
    releaseSelectedItems,
    requestInventoryTransfersForShipGroup,
    openAddTaskModal,
    openAddItemModal,
    viewInventory,
    saveCarrierAndMethod,
    // items
    rejectAndReleaseItem,
    requestInventoryTransferForItem,
    cancelSingleItem,
    openItemAttributesModal,
    openAddItemFromItemsSegment,
    // footer
    footerActions,
    runFooterAction,
    footerActionLabel,
    // header and holds
    openCustomerContactModal,
    openLocalePrompt,
    openManageIdentificationsModal,
    openRiskDetails,
    openCreateHoldTaskModal,
    reloadHoldTasks,
  };
}
