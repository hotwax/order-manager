import re

with open('src/views/OrderDetail.vue', 'r') as f:
    content = f.read()

# Add ref for performingActionId
if 'const performingActionId = ref<string | null>(null);' not in content:
    content = content.replace('const orderDetailStore = useOrderDetailStore();',
                              'const orderDetailStore = useOrderDetailStore();\nconst performingActionId = ref<string | null>(null);')

# Update runFooterAction
old_func = """function runFooterAction(action: any) {
  // Dispatch by id (not kind) — the cancel button rides on the start as
  // kind 'status' in both modes, but CANCEL_ITEMS has its own handler.
  switch (action.id) {
    case 'CLONE': return openCloneOrderModal();
    case 'CANCEL_ITEMS': return cancelOrderItems();
    case 'RETURN': return startReturn();
    default: return runOrderStatusAction(action); // status transitions (Approve, Cancel order, …)
  }
}"""

new_func = """async function runFooterAction(action: any) {
  if (performingActionId.value) return;
  performingActionId.value = action.id;
  try {
    switch (action.id) {
      case 'CLONE': await openCloneOrderModal(); break;
      case 'CANCEL_ITEMS': await cancelOrderItems(); break;
      case 'RETURN': await startReturn(); break;
      default: await runOrderStatusAction(action); break; // status transitions (Approve, Cancel order, …)
    }
  } finally {
    performingActionId.value = null;
  }
}"""
content = content.replace(old_func, new_func)

# We need to make sure the alert dialogs inside runOrderStatusAction and cancelOrderItems don't leave it loading if cancelled.
# Actually, if they show an alert, the `await` on the alert isn't the end of the action, the handler is...
# Oh wait!
# The alerts are handled asynchronously: `await alert.present();`
# The `alert.present()` resolves when the alert is SHOWN. So `runFooterAction` will finish and `finally` will set `performingActionId.value = null`.
# Then the button clicks inside the alert will trigger asynchronously without `performingActionId`!
# This is a bit tricky. We should show the spinner AFTER the user confirms the alert, not while the alert is visible.
