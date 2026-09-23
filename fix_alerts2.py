import re

with open('src/views/OrderDetail.vue', 'r') as f:
    content = f.read()

# I need to simplify `runFooterAction`. The cancelOrderItems and runOrderStatusAction now set the spinner themselves
# inside their alert confirmation handlers (and runOrderStatusAction direct path).
# However, if we click 'Cancel order', it calls `cancelOrder` which ALSO opens an alert and sets the spinner in the handler.
# If I wrap `runOrderStatusAction` in `performingActionId.value = action.id`, the spinner will show while the alert is OPEN!
# We do NOT want that. We only want the spinner when the action is actually saving.

old_run = """async function runFooterAction(action: any) {
  if (performingActionId.value) return;

  // cancelOrderItems and runOrderStatusAction handle the spinner directly because they open alerts first.
  if (action.id === 'CANCEL_ITEMS' || action.id === 'ORDER_CANCELLED' || action.kind === 'status') {
    switch (action.id) {
      case 'CANCEL_ITEMS': return cancelOrderItems();
      case 'RETURN': return startReturn();
      default: return runOrderStatusAction(action); // status transitions (Approve, Cancel order, …)
    }
  }

  performingActionId.value = action.id;
  try {
    switch (action.id) {
      case 'CLONE': await openCloneOrderModal(); break;
      case 'RETURN': await startReturn(); break;
      default: await runOrderStatusAction(action); break;
    }
  } finally {
    performingActionId.value = null;
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
    case 'RETURN': return startReturn();
    default: return runOrderStatusAction(action); // status transitions (Approve, Cancel order, …)
  }
}"""
content = content.replace(old_run, new_run)

# Now double check runOrderStatusAction
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

# Wait, `runOrderStatusAction` was modified earlier. Let's make sure it matches.
# If it doesn't match, we will just use regex to replace it entirely.
content = re.sub(r'async function runOrderStatusAction\(action: any\) {.*?^}', old_status, content, flags=re.MULTILINE | re.DOTALL)


with open('src/views/OrderDetail.vue', 'w') as f:
    f.write(content)
