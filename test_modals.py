import os
import re

files_to_check = [
    'src/components/orders/OrderItemAttributesModal.vue',
    'src/components/orders/CreateIdentificationTypeModal.vue',
    'src/components/orders/ManageOrderIdentificationsModal.vue',
    'src/components/orders/RiskAssessmentModal.vue',
    'src/components/orders/RejectItemsModal.vue',
    'src/components/swaps/SubstituteRelationshipModal.vue',
    'src/components/swaps/CustomSwapModal.vue',
    'src/components/tasks/AddOrderTaskModal.vue',
    'src/components/fulfillment/RoutingGroupModal.vue',
    'src/components/fulfillment/EditShippingMethodModal.vue',
    'src/components/fulfillment/FacilityModal.vue',
    'src/components/fulfillment/FacilityInventoryModal.vue'
]

for path in files_to_check:
    with open(path, 'r') as f:
        content = f.read()

    print(f"Checking {path}")
    buttons = re.finditer(r'<(ion-button|ion-fab-button)([^>]*)>(.*?)</\1>', content, re.DOTALL)
    for match in buttons:
        attrs = match.group(2)
        inner = match.group(3)
        if ('save' in attrs.lower() or 'submit' in attrs.lower() or 'confirm' in attrs.lower() or 'save' in inner.lower() or 'submit' in inner.lower() or 'confirm' in inner.lower() or 'add' in inner.lower() or 'create' in inner.lower()):
            if '@click' in attrs:
                print(f"  <ion-button{attrs}>{inner.strip()}</ion-button>")
