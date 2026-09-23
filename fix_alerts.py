import re

with open('src/views/OrderDetail.vue', 'r') as f:
    content = f.read()

# Add ref for performingActionId
if 'const performingActionId = ref<string | null>(null);' not in content:
    content = content.replace('const orderDetailStore = useOrderDetailStore();',
                              'const orderDetailStore = useOrderDetailStore();\nconst performingActionId = ref<string | null>(null);')

# We don't wrap runFooterAction in the loading state, we put it around the actual operations.

# Update cancelOrderItems
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
          } catch {"""
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
          } catch {"""
content = content.replace(old_cancel_items, new_cancel_items)

old_cancel_items_catch = """            await showToast(translate('Failed to cancel the selected items. Please try again.'));
          }
        }"""
new_cancel_items_catch = """            await showToast(translate('Failed to cancel the selected items. Please try again.'));
          } finally {
            performingActionId.value = null;
          }
        }"""
content = content.replace(old_cancel_items_catch, new_cancel_items_catch)


# Update cancelOrder
old_cancel_order = """        handler: async () => {
          try {
            await orderTaskStore.cancelOrder(orderId, items);
            await showToast(translate('Order cancelled successfully.'));
            await loadOrder(orderId, true);
          } catch {"""
new_cancel_order = """        handler: async () => {
          performingActionId.value = 'ORDER_CANCELLED';
          try {
            await orderTaskStore.cancelOrder(orderId, items);
            await showToast(translate('Order cancelled successfully.'));
            await loadOrder(orderId, true);
          } catch {"""
content = content.replace(old_cancel_order, new_cancel_order)

old_cancel_order_catch = """            await showToast(translate('Failed to cancel the order. Please try again.'));
          }
        }"""
new_cancel_order_catch = """            await showToast(translate('Failed to cancel the order. Please try again.'));
          } finally {
            performingActionId.value = null;
          }
        }"""
content = content.replace(old_cancel_order_catch, new_cancel_order_catch)

# Update runOrderStatusAction alert
old_run_order_status = """{ text: translate(action.label), role: 'confirm', handler: () => { changeOrderStatus(orderId, action.toStatusId); } }"""
new_run_order_status = """{ text: translate(action.label), role: 'confirm', handler: async () => {
          performingActionId.value = action.id;
          try {
            await changeOrderStatus(orderId, action.toStatusId);
          } finally {
            performingActionId.value = null;
          }
        } }"""
content = content.replace(old_run_order_status, new_run_order_status)

# Update changeOrderStatus directly, because it can be called without alert
old_change_order_status = """async function changeOrderStatus(orderId: string, statusId: string) {
  try {
    await api({"""
new_change_order_status = """async function changeOrderStatus(orderId: string, statusId: string) {
  try {
    await api({"""
content = content.replace(old_change_order_status, new_change_order_status)

# Update runOrderStatusAction (direct execution path)
old_run_order_status_direct = """  await changeOrderStatus(orderId, action.toStatusId);
}"""
new_run_order_status_direct = """  performingActionId.value = action.id;
  try {
    await changeOrderStatus(orderId, action.toStatusId);
  } finally {
    performingActionId.value = null;
  }
}"""
content = content.replace(old_run_order_status_direct, new_run_order_status_direct)


# Update template buttons
old_buttons = """        <ion-buttons slot="start">
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
        </ion-buttons>"""
new_buttons = """        <ion-buttons slot="start">
          <ion-button v-for="action in footerActions.filter(a => a.kind === 'status')" :key="action.id"
            :color="action.color" :fill="action.fill" :disabled="!!performingActionId" @click="runFooterAction(action)">
            <ion-spinner v-if="performingActionId === action.id" name="crescent" slot="start" />
            {{ footerActionLabel(action) }}
          </ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button v-for="action in footerActions.filter(a => a.kind === 'footer')" :key="action.id"
            :color="action.color" :fill="action.fill" :disabled="!!performingActionId" @click="runFooterAction(action)">
            <ion-spinner v-if="performingActionId === action.id" name="crescent" slot="start" />
            {{ footerActionLabel(action) }}
          </ion-button>
        </ion-buttons>"""
content = content.replace(old_buttons, new_buttons)

with open('src/views/OrderDetail.vue', 'w') as f:
    f.write(content)
