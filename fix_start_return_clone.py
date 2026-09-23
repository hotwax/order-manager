import re

with open('src/views/OrderDetail.vue', 'r') as f:
    content = f.read()

# Update startReturn and openCloneOrderModal since they are called from runFooterAction
old_run = """async function runFooterAction(action: any) {
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
new_run = """async function runFooterAction(action: any) {
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
content = content.replace(old_run, new_run)
with open('src/views/OrderDetail.vue', 'w') as f:
    f.write(content)
