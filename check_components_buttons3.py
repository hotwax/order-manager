import os
import re

files_to_check = [
    'src/components/AddressModal.vue',
    'src/components/AddCustomerModal.vue',
    'src/components/swaps/ReleaseSwapOrderModal.vue',
    'src/views/OrderDetail.vue',
    'src/views/Funnel.vue',
    'src/views/CreateOrder.vue'
]

for path in files_to_check:
    with open(path, 'r') as f:
        content = f.read()

    for match in re.finditer(r'<ion-button([^>]*)>(.*?)</ion-button>', content, re.DOTALL):
        attrs = match.group(1)
        inner = match.group(2)
        if ('save' in attrs.lower() or 'submit' in attrs.lower() or 'confirm' in attrs.lower() or 'save' in inner.lower() or 'submit' in inner.lower() or 'confirm' in inner.lower() or 'add' in inner.lower() or 'create' in inner.lower()):
            if '@click' in attrs:
                print(f"Potential unguarded save button in {path}:\n<ion-button{attrs}>{inner.strip()}</ion-button>")

    for match in re.finditer(r'<ion-fab-button([^>]*)>(.*?)</ion-fab-button>', content, re.DOTALL):
        attrs = match.group(1)
        inner = match.group(2)
        if ('save' in attrs.lower() or 'submit' in attrs.lower() or 'confirm' in attrs.lower() or 'save' in inner.lower() or 'submit' in inner.lower() or 'confirm' in inner.lower() or 'add' in inner.lower() or 'create' in inner.lower()):
            if '@click' in attrs:
                print(f"Potential unguarded save FAB in {path}:\n<ion-fab-button{attrs}>{inner.strip()}</ion-fab-button>")
