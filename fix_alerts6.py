import re

with open('src/views/OrderDetail.vue', 'r') as f:
    content = f.read()

old_run = """async function runFooterAction(action: any) {
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
new_run = """async function runFooterAction(action: any) {
  if (performingActionId.value) return;

  switch (action.id) {
    case 'CLONE':
      performingActionId.value = action.id;
      try { await openCloneOrderModal(); } finally { performingActionId.value = null; }
      break;
    case 'CANCEL_ITEMS':
      return cancelOrderItems();
    case 'RETURN':
      performingActionId.value = action.id;
      try { await startReturn(); } finally { performingActionId.value = null; }
      break;
    default:
      return runOrderStatusAction(action); // status transitions (Approve, Cancel order, …)
  }
}"""

content = content.replace(old_run, new_run)

# I should also fix that we did `performingActionId.value = 'ORDER_CANCELLED'` but we never defined it. We did! We added it at the top.
# Let's verify it's there
if 'const performingActionId = ref<string | null>(null);' in content:
    pass

with open('src/views/OrderDetail.vue', 'w') as f:
    f.write(content)
