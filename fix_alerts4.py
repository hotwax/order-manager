import re

with open('src/views/OrderDetail.vue', 'r') as f:
    content = f.read()

# Replace runFooterAction entirely, we know what it needs to look like
old_run = """async function runFooterAction(action: any) {
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

with open('src/views/OrderDetail.vue', 'w') as f:
    f.write(content)
