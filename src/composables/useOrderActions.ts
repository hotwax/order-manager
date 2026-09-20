import { computed, type Ref } from 'vue';
import { alertController, modalController } from '@ionic/vue';
import { api, translate } from '@common';
import { showToast } from '@/utils';
import { OrderActionValidator } from '@/utils/OrderActionValidator';
import { useOrderDetailStore } from '@/store/orderDetail';
import { useOrderTaskStore } from '@/store/orderTask';
import { useProductStore } from '@/store/productStore';
import { useSeedStore } from '@/store/seed';
import type { EnrichedOrder } from '@/types/orderDetail';

import AddOrderTaskModal from '@/components/tasks/AddOrderTaskModal.vue';
import AddItemToOrderModal from '@/components/orders/AddItemToOrderModal.vue';
import CloneOrderModal from '@/components/orders/CloneOrderModal.vue';
import ProductInventoryModal from '@/components/inventory/ProductInventoryModal.vue';
import RejectItemsModal from '@/components/orders/RejectItemsModal.vue';
import RequestInventoryTransferModal from '@/components/inventory/RequestInventoryTransferModal.vue';
import RoutingGroupModal from '@/components/fulfillment/RoutingGroupModal.vue';

export interface UseOrderActionsContext {
  orderId: string;
  order: Ref<EnrichedOrder | undefined>;
  loadOrder: (orderId: string, force?: boolean) => Promise<void>;
  selectedShipGroupItems: Ref<Record<string, Set<string>>>;
  selectedItems: Ref<any[]>;
  selectedItemIds: Ref<Set<string>>;
  groupedItems: Ref<any[]>;
  openFacilityModal: () => Promise<string | null>;
  openFacilityInventoryModal: (items: any[]) => Promise<string | null>;
  shipGroupById: (id: string) => any;
  actionableItemObjectsForShipGroup: (shipGroup: any) => any[];
  shipGroupActionValidation: (shipGroup: any, actionId: any) => any;
  itemFacilityActionValidation: (item: any) => any;
  itemCancelValidation: (item: any) => any;
  isVirtualFacilityForItem: (item: any) => boolean;
  inventoryTransferItem: (item: any) => any;
  selectedSegment: Ref<string>;
  reloadHoldTasks: () => void;
}

export function useOrderActions(ctx: UseOrderActionsContext) {
  const orderDetailStore = useOrderDetailStore();
  const orderTaskStore = useOrderTaskStore();
  const productStore = useProductStore();
  const seed = useSeedStore();

  async function showUnavailableAction(validation: any) {
    const alert = await alertController.create({
      header: translate('Action unavailable'),
      message: translate(validation.reason || 'This action is not available for this item in its current status.'),
      buttons: [translate('Dismiss')]
    });
    await alert.present();
  }

  async function brokerShipGroup(shipGroupSeqId: string) {
    const shipGroup = ctx.shipGroupById(shipGroupSeqId);
    const validation = shipGroup
      ? ctx.shipGroupActionValidation(shipGroup, 'BROKER')
      : { allowed: false, reason: 'Ship group is not available.' };
    if (!validation.allowed) {
      await showUnavailableAction(validation);
      return;
    }

    const productStoreId = productStore.getCurrentProductStore.productStoreId;
    const modal = await modalController.create({ component: RoutingGroupModal, componentProps: { productStoreId } });
    await modal.present();
    const { data: routingGroupId } = await modal.onWillDismiss();
    if (!routingGroupId) return;
    try {
      await orderTaskStore.brokerShipGroup({ routingGroupId, orderId: ctx.order.value!.id, shipGroupSeqId, productStoreId });
      await showToast(translate('Ship group brokered successfully.'));
      await ctx.loadOrder(ctx.order.value!.id, true);
    } catch {
      await showToast(translate('Failed to broker the ship group. Please try again.'));
    }
  }

  async function cancelOrderItems() {
    const raw = orderDetailStore.orderById(ctx.orderId);
    if (!raw || !ctx.selectedItems.value.length) return;
    const itemsSnapshot = [...ctx.selectedItems.value];
    const alert = await alertController.create({
      header: translate('Cancel items'),
      message: translate('Are you sure you want to cancel the {count} selected item(s)? This action cannot be undone.').replace('{count}', String(itemsSnapshot.length)),
      buttons: [
        { text: translate('Cancel'), role: 'cancel' },
        {
          text: translate('Cancel items'),
          role: 'confirm',
          handler: async () => {
            try {
              await orderTaskStore.cancelOrder(raw.orderId, itemsSnapshot.map((item: any) => ({
                orderItemSeqId: item.orderItemSeqId,
                shipGroupSeqId: item.shipGroupSeqId,
                reason: "NO_VARIANCE_LOG",
                comment: ""
              })));
              ctx.selectedItemIds.value.clear();
              await showToast(translate('Selected items cancelled successfully.'));
              await ctx.loadOrder(raw.orderId, true);
            } catch {
              await showToast(translate('Failed to cancel the selected items. Please try again.'));
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async function cancelSingleItem(item: any) {
    const raw = orderDetailStore.orderById(ctx.orderId);
    if (!raw) return;

    const validation = ctx.itemCancelValidation(item);
    if (!validation.allowed) {
      await showUnavailableAction(validation);
      return;
    }
    const alert = await alertController.create({
      header: translate('Cancel Item'),
      message: translate('Are you sure you want to cancel this item? This action cannot be undone.'),
      buttons: [
        { text: translate('Cancel'), role: 'cancel' },
        {
          text: translate('Cancel item'),
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
              await ctx.loadOrder(raw.orderId, true);
            } catch {
              await showToast(translate('Failed to cancel the item. Please try again.'));
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async function rejectAndReleaseItem(item: any) {
    const validation = ctx.itemFacilityActionValidation(item);
    if (!validation.allowed) {
      await showUnavailableAction(validation);
      return;
    }

    const orderId = ctx.order.value!.id;

    // Step 1 — pick a facility with inventory to release to
    const facilityId = await ctx.openFacilityInventoryModal([item]);
    if (!facilityId) {
      return;
    }

    if (!ctx.isVirtualFacilityForItem(item)) {
      // Step 2 (optional) — reject the item with default reason
      try {
        await api({
          url: `oms/orders/${orderId}/items/${item.orderItemSeqId}/reject`,
          method: 'POST',
          data: {
            rejectionReasonId: 'NO_VARIANCE_LOG',
          },
        });
      } catch {
        await showToast(translate('Failed to reject the item. Please try again.'));
        return;
      }
    }

    // Step 3 — release to chosen facility
    try {
      await api({
        url: `oms/orders/${orderId}/items/${item.orderItemSeqId}/allocation`,
        method: 'POST',
        data: {
          facilityId,
          orderFacilityChange: {
            changeReasonEnumId: "RELEASED"
          }
        },
      });
      await showToast(translate('Item released to facility.'));
    } catch {
      await showToast(translate('Failed to release the item. Please try again.'));
    } finally {
      await ctx.loadOrder(orderId, true);
    }
  }

  async function cancelOrder(orderId: string) {
    const items = ctx.groupedItems.value
      .flatMap((group: any) => group.items)
      .filter((item: any) => !['ITEM_CANCELLED', 'ITEM_COMPLETED'].includes(item.statusId))
      .map((item: any) => ({
        orderItemSeqId: item.orderItemSeqId,
        shipGroupSeqId: item.shipGroupSeqId,
        reason: 'NO_VARIANCE_LOG',
        comment: ''
      }));
    if (!items.length) return;
    const alert = await alertController.create({
      header: translate('Cancel order'),
      message: translate("Are you sure you want to cancel this order?"),
      buttons: [
        { text: translate('Cancel'), role: 'cancel' },
        {
          text: translate('Cancel order'),
          role: 'confirm',
          handler: async () => {
            try {
              await orderTaskStore.cancelOrder(orderId, items);
              await showToast(translate('Order cancelled successfully.'));
              await ctx.loadOrder(orderId, true);
            } catch {
              await showToast(translate('Failed to cancel the order. Please try again.'));
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async function changeOrderStatus(orderId: string, statusId: string) {
    try {
      await api({
        url: `oms/orders/${orderId}/status`,
        method: 'POST',
        data: { orderId, statusId, setItemStatus: true }
      });
      await showToast(translate('Order status updated successfully.'));
      await ctx.loadOrder(orderId, true);
    } catch {
      await showToast(translate('Failed to update the order status. Please try again.'));
    }
  }

  async function runOrderStatusAction(action: any) {
    if (!ctx.order.value) return;
    const orderId = ctx.order.value.id;
    if (action.id === 'ORDER_CANCELLED') {
      await cancelOrder(orderId);
      return;
    }
    if (action.color === 'danger') {
      const alert = await alertController.create({
        header: translate(action.label),
        message: translate("Are you sure you want to change this order's status?"),
        buttons: [
          { text: translate('Cancel'), role: 'cancel' },
          { text: translate(action.label), role: 'confirm', handler: () => { changeOrderStatus(orderId, action.toStatusId); } }
        ]
      });
      await alert.present();
      return;
    }
    await changeOrderStatus(orderId, action.toStatusId);
  }

  async function startReturn() {
    await showToast(translate('Returns are not available here yet.'));
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
  }

  const DISPATCHABLE_FOOTER_IDS = new Set(['CANCEL_ITEMS', 'ORDER_CANCELLED', 'RETURN']);

  const footerActions = computed(() => {
    if (!ctx.order.value) return [];
    const allowedTransitions = seed.allowedTransitions(ctx.order.value.statusId);
    const context = {
      allItems: ctx.groupedItems.value.flatMap((group: any) => group.items),
      orderAllowedToStatusIds: new Set(allowedTransitions.map((transition: any) => transition.toStatusId))
    };
    return OrderActionValidator
      .getOrderFooterActions(ctx.order.value, allowedTransitions, ctx.selectedItems.value, context)
      .filter((action: any) => action.kind === 'status' || DISPATCHABLE_FOOTER_IDS.has(action.id));
  });

  function runFooterAction(action: any) {
    switch (action.id) {
      case 'CLONE': return openCloneOrderModal();
      case 'CANCEL_ITEMS': return cancelOrderItems();
      case 'RETURN': return startReturn();
      default: return runOrderStatusAction(action);
    }
  }

  function footerActionLabel(action: any): string {
    if (action.id === 'CANCEL_ITEMS') {
      return translate('Cancel {count} items').replace('{count}', String(ctx.selectedItems.value.length));
    }
    return translate(action.label);
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
          orderId: ctx.order.value!.id,
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

  async function openCreateHoldTaskModal() {
    const currentOrder = ctx.order.value;
    if (!currentOrder) return;

    const shipGroups = (currentOrder.shipGroups ?? []).map((shipGroup: any) => ({
      id: shipGroup.id,
      label: shipGroup.facilityName ? `${shipGroup.id} · ${shipGroup.facilityName}` : shipGroup.id,
    }));
    if (!shipGroups.length) {
      await showToast(translate('This order has no ship groups to add a task to.'));
      return;
    }

    const modal = await modalController.create({
      component: AddOrderTaskModal,
      componentProps: {
        shipGroups,
        title: translate('Create hold task'),
        defaultWorkEffortPurposeTypeId: 'ORD_HOLD_MANUAL',
      },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role !== 'confirm' || !data) return;

    const shipGroupSeqIds: string[] = data.shipGroupSeqIds?.length
      ? data.shipGroupSeqIds
      : shipGroups.map((shipGroup) => shipGroup.id);
    const orderId = currentOrder.id;
    try {
      await api({
        url: 'oms/orders/tasks',
        method: 'POST',
        data: shipGroupSeqIds.map((shipGroupSeqId) => ({
          orderId,
          shipGroupSeqId,
          workEffortName: data.workEffortName,
          workEffortTypeId: data.workEffortTypeId,
          workEffortPurposeTypeId: data.workEffortPurposeTypeId,
          description: data.description,
          statusId: 'TASK_CREATED',
        })),
      });
      await showToast(translate('Tasks created successfully.'));
      ctx.selectedSegment.value = 'holds';
      await ctx.reloadHoldTasks();
    } catch {
      await showToast(translate('Failed to create tasks. Please try again.'));
    }
  }

  async function openAddItemModal(shipGroup: any) {
    const modal = await modalController.create({
      component: AddItemToOrderModal,
      componentProps: { orderId: ctx.order.value!.id, shipGroupSeqId: shipGroup.id, onItemAdded: () => ctx.loadOrder(ctx.order.value!.id) },
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') {
      await ctx.loadOrder(ctx.order.value!.id, true);
    }
  }

  async function parkSelectedItems(shipGroup: any) {
    const validation = ctx.shipGroupActionValidation(shipGroup, 'PARK_ITEMS');
    if (!validation.allowed) {
      await showUnavailableAction(validation);
      return;
    }

    const itemIds = ctx.actionableItemObjectsForShipGroup(shipGroup)
      .filter((item: any) => !OrderActionValidator.isItemTerminal(item))
      .map((item: any) => item.orderItemSeqId);
    if (!itemIds.length) return;
    const facilityId = await ctx.openFacilityModal();
    if (!facilityId) return;
    const orderId = ctx.order.value!.id;
    try {
      for (const orderItemSeqId of itemIds) {
        await api({
          url: `oms/orders/${orderId}/moveItemToParking`,
          method: 'POST',
          data: { orderId, orderItemSeqId, shipGroupSeqId: shipGroup.id, toFacilityId: facilityId },
        });
      }
      ctx.selectedShipGroupItems.value[shipGroup.id] = new Set();
      await showToast(translate('Items moved to parking.'));
      await ctx.loadOrder(orderId, true);
    } catch {
      await showToast(translate('Failed to park items. Please try again.'));
    }
  }

  async function rejectSelectedItems(shipGroup: any) {
    const validation = ctx.shipGroupActionValidation(shipGroup, 'PULL_BACK');
    if (!validation.allowed) {
      await showUnavailableAction(validation);
      return;
    }

    const itemIds = ctx.actionableItemObjectsForShipGroup(shipGroup)
      .filter((item: any) => !OrderActionValidator.isItemTerminal(item))
      .map((item: any) => item.orderItemSeqId);
    if (!itemIds.length) return;

    const modal = await modalController.create({ component: RejectItemsModal });
    await modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role !== 'confirm') return;

    const rejectionReasonId = data?.rejectionReasonId;
    const orderId = ctx.order.value!.id;
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
      ctx.selectedShipGroupItems.value[shipGroup.id] = new Set();
      await showToast(translate('Items rejected successfully.'));
      await ctx.loadOrder(orderId, true);
    } catch {
      await showToast(translate('Failed to reject items. Please try again.'));
    }
  }

  async function releaseSelectedItems(shipGroup: any) {
    const validation = ctx.shipGroupActionValidation(shipGroup, 'RELEASE');
    if (!validation.allowed) {
      await showUnavailableAction(validation);
      return;
    }

    const releasableItems = ctx.actionableItemObjectsForShipGroup(shipGroup)
      .filter((item: any) => OrderActionValidator.isItemPreFulfill(item));
    const itemIds = releasableItems.map((item: any) => item.orderItemSeqId);
    if (!itemIds.length) return;
    const facilityId = await ctx.openFacilityInventoryModal(releasableItems);
    if (!facilityId) return;
    const orderId = ctx.order.value!.id;
    try {
      for (const orderItemSeqId of itemIds) {
        await api({
          url: `oms/orders/${orderId}/items/${orderItemSeqId}/allocation`,
          method: 'POST',
          data: {
            facilityId,
            orderFacilityChange: {
              changeReasonEnumId: "RELEASED"
            }
          },
        });
      }
      ctx.selectedShipGroupItems.value[shipGroup.id] = new Set();
      await showToast(translate('Items released to facility.'));
      await ctx.loadOrder(orderId, true);
    } catch {
      await showToast(translate('Failed to release items. Please try again.'));
    }
  }

  async function openInventoryTransferRequestModal(shipGroup: any, items: any[]) {
    const modal = await modalController.create({
      component: RequestInventoryTransferModal,
      componentProps: {
        orderId: ctx.order.value?.id,
        shipGroupSeqId: shipGroup?.id,
        items,
      },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data && ctx.order.value?.id) {
      await ctx.loadOrder(ctx.order.value.id, true);
    }
  }

  async function requestInventoryTransferForItem(item: any) {
    const shipGroup = ctx.shipGroupById(item.shipGroupSeqId);
    await openInventoryTransferRequestModal(shipGroup, [ctx.inventoryTransferItem(item)]);
  }

  async function requestInventoryTransfersForShipGroup(shipGroup: any) {
    const items = (shipGroup?.items || [])
      .filter((item: any) => ctx.isVirtualFacilityForItem(item) ? false : OrderActionValidator.isItemPreFulfill(item))
      .map((item: any) => ctx.inventoryTransferItem(item));
    await openInventoryTransferRequestModal(shipGroup, items);
  }

  async function saveCarrierAndMethod(shipGroupSeqId: string, shipmentMethodTypeId: string, carrierPartyId: string) {
    try {
      await orderDetailStore.updateShipmentCarrierAndMethod(ctx.order.value!.id, shipGroupSeqId, shipmentMethodTypeId, carrierPartyId);
      await showToast(translate('Carrier and shipping method updated successfully.'));
      await ctx.loadOrder(ctx.order.value!.id, true);
    } catch {
      await showToast(translate('Failed to update carrier and shipping method. Please try again.'));
    }
  }

  async function updateShipGroup(shipGroupId: string, payload: Record<string, any>) {
    if (!ctx.order.value?.id) return;
    try {
      await api({
        url: `oms/orders/${ctx.order.value.id}/shipGroups/${shipGroupId}`,
        method: 'PUT',
        data: payload,
      });
      await ctx.loadOrder(ctx.order.value.id, true);
    } catch {
      await showToast(translate('Failed to update ship group. Please try again.'));
    }
  }

  return {
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
  };
}
