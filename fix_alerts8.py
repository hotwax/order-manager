import re

with open('src/views/OrderDetail.vue', 'r') as f:
    content = f.read()

# I missed updating the alerts for cancelOrderItems and cancelOrder. Let's do it exactly.
old_cancel_items = """        handler: async () => {
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
        }"""
new_cancel_items = """        handler: async () => {
          performingActionId.value = 'CANCEL_ITEMS';
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
          } finally {
            performingActionId.value = null;
          }
        }"""
content = content.replace(old_cancel_items, new_cancel_items)


old_cancel_order = """        handler: async () => {
          try {
            await orderTaskStore.cancelOrder(orderId, items);
            await showToast(translate('Order cancelled successfully.'));
            await loadOrder(orderId, true);
          } catch {
            await showToast(translate('Failed to cancel the order. Please try again.'));
          }
        }"""
new_cancel_order = """        handler: async () => {
          performingActionId.value = 'ORDER_CANCELLED';
          try {
            await orderTaskStore.cancelOrder(orderId, items);
            await showToast(translate('Order cancelled successfully.'));
            await loadOrder(orderId, true);
          } catch {
            await showToast(translate('Failed to cancel the order. Please try again.'));
          } finally {
            performingActionId.value = null;
          }
        }"""
content = content.replace(old_cancel_order, new_cancel_order)

with open('src/views/OrderDetail.vue', 'w') as f:
    f.write(content)
