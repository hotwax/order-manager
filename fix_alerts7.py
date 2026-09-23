import re

with open('src/views/OrderDetail.vue', 'r') as f:
    content = f.read()

# Try again with more robust matching for status
match = re.search(r'async function runOrderStatusAction\(action: any\) {.*?^}', content, flags=re.MULTILINE | re.DOTALL)
if match:
    old_status = match.group(0)
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
    print("Replaced runOrderStatusAction")

# Let's ensure performingActionId was added
if 'const performingActionId = ref<string | null>(null);' not in content:
    content = content.replace('const orderDetailStore = useOrderDetailStore();',
                              'const orderDetailStore = useOrderDetailStore();\nconst performingActionId = ref<string | null>(null);')
    print("Added performingActionId")

# Check runFooterAction
match = re.search(r'function runFooterAction\(action: any\) {.*?^}', content, flags=re.MULTILINE | re.DOTALL)
if match:
    old_run = match.group(0)
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
    print("Replaced runFooterAction")

# Update cancelOrderItems
match = re.search(r'        handler: async \(\) => {\n          try {\n            await orderTaskStore\.cancelOrder\(raw\.orderId, itemsSnapshot.*?^        }', content, flags=re.MULTILINE | re.DOTALL)
if match:
    old_cancel_items = match.group(0)
    new_cancel_items = old_cancel_items.replace('handler: async () => {\n          try {', "handler: async () => {\n          performingActionId.value = 'CANCEL_ITEMS';\n          try {")
    new_cancel_items = new_cancel_items.replace('          }\n        }', '          } finally {\n            performingActionId.value = null;\n          }\n        }')
    content = content.replace(old_cancel_items, new_cancel_items)
    print("Replaced cancelOrderItems")

# Update cancelOrder
match = re.search(r'        handler: async \(\) => {\n          try {\n            await orderTaskStore\.cancelOrder\(orderId, items\);.*?^        }', content, flags=re.MULTILINE | re.DOTALL)
if match:
    old_cancel_order = match.group(0)
    new_cancel_order = old_cancel_order.replace('handler: async () => {\n          try {', "handler: async () => {\n          performingActionId.value = 'ORDER_CANCELLED';\n          try {")
    new_cancel_order = new_cancel_order.replace('          }\n        }', '          } finally {\n            performingActionId.value = null;\n          }\n        }')
    content = content.replace(old_cancel_order, new_cancel_order)
    print("Replaced cancelOrder")


# Update template buttons
match = re.search(r'<ion-buttons slot="start">\n          <ion-button v-for="action in footerActions.filter\(a => a.kind === \'status\'\)".*?</ion-buttons>', content, flags=re.MULTILINE | re.DOTALL)
if match:
    old_buttons = match.group(0)
    new_buttons = """<ion-buttons slot="start">
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
    # actually it matches until the FIRST </ion-buttons>, so we need to grab both.

match = re.search(r'<ion-buttons slot="start">\n          <ion-button v-for="action in footerActions.*?<ion-buttons slot="end">\n          <ion-button v-for="action in footerActions.*?</ion-buttons>', content, flags=re.MULTILINE | re.DOTALL)
if match:
    old_buttons = match.group(0)
    new_buttons = """<ion-buttons slot="start">
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
    print("Replaced template buttons")


with open('src/views/OrderDetail.vue', 'w') as f:
    f.write(content)
