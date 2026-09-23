import re

with open('src/views/OrderDetail.vue', 'r') as f:
    content = f.read()

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
    case 'RETURN': return startReturn();
    default: return runOrderStatusAction(action); // status transitions (Approve, Cancel order, …)
  }
}"""
content = content.replace(old_run, new_run)

# I should also add ion-spinner import if it's missing, though we know it's imported in most vue files. Let's check imports.
if 'IonSpinner' not in content:
    content = content.replace('IonSegmentButton,', 'IonSegmentButton, IonSpinner,')

with open('src/views/OrderDetail.vue', 'w') as f:
    f.write(content)
