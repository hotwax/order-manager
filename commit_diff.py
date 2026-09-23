import re

with open('src/views/OrderDetail.vue', 'r') as f:
    content = f.read()

# Add ref for performingActionId
if 'const performingActionId = ref<string | null>(null);' not in content:
    content = content.replace('const orderDetailStore = useOrderDetailStore();',
                              'const orderDetailStore = useOrderDetailStore();\nconst performingActionId = ref<string | null>(null);')

# Update runFooterAction
old_run = """function runFooterAction(action: any) {
  // Dispatch by id (not kind) — the cancel button rides on the start as
  // kind 'status' in both modes, but CANCEL_ITEMS has its own handler.
  switch (action.id) {
    case 'CLONE': return openCloneOrderModal();
    case 'CANCEL_ITEMS': return cancelOrderItems();
    case 'RETURN': return startReturn();
    default: return runOrderStatusAction(action); // status transitions (Approve, Cancel order, …)
  }
}"""
new_run = """async function runFooterAction(action: any) {
  if (performingActionId.value) return;

  switch (action.id) {
    case 'CLONE':
      performingActionId.value = action.id;
      try { await openCloneOrderModal(); } finally { performingActionId.value = null; }
      break;
    case 'CANCEL_ITEMS': return cancelOrderItems();
    case 'RETURN':
      performingActionId.value = action.id;
      try { await startReturn(); } finally { performingActionId.value = null; }
      break;
    default: return runOrderStatusAction(action); // status transitions (Approve, Cancel order, …)
  }
}"""
content = content.replace(old_run, new_run)

# Update cancelOrderItems
old_cancel_items = """        handler: async () => {
          try {
            await orderTaskStore.cancelOrder(raw.orderId, itemsSnapshot.map((item: any) => ({"""
new_cancel_items = """        handler: async () => {
          performingActionId.value = 'CANCEL_ITEMS';
          try {
            await orderTaskStore.cancelOrder(raw.orderId, itemsSnapshot.map((item: any) => ({"""
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
            await orderTaskStore.cancelOrder(orderId, items);"""
new_cancel_order = """        handler: async () => {
          performingActionId.value = 'ORDER_CANCELLED';
          try {
            await orderTaskStore.cancelOrder(orderId, items);"""
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

# Update runOrderStatusAction
old_status = """async function runOrderStatusAction(action: any) {
  if (!order.value) return;
  const orderId = order.value.id;
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
}"""

new_status = """async function runOrderStatusAction(action: any) {
  if (!order.value) return;
  const orderId = order.value.id;
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
        { text: translate(action.label), role: 'confirm', handler: async () => {
          performingActionId.value = action.id;
          try {
            await changeOrderStatus(orderId, action.toStatusId);
          } finally {
            performingActionId.value = null;
          }
        } }
      ]
    });
    await alert.present();
    return;
  }
  performingActionId.value = action.id;
  try {
    await changeOrderStatus(orderId, action.toStatusId);
  } finally {
    performingActionId.value = null;
  }
}"""
content = content.replace(old_status, new_status)


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
