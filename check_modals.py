import os
import re

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.vue'):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()

            buttons = re.finditer(r'<ion-button([^>]*)>(.*?)</ion-button>', content, re.DOTALL)
            for match in buttons:
                attrs = match.group(1)
                inner = match.group(2)

                # Check for buttons that look like save/submit buttons but lack a disabled state or spinner
                if 'disabled' not in attrs and ('save' in attrs.lower() or 'submit' in attrs.lower() or 'confirm' in attrs.lower() or 'save' in inner.lower() or 'submit' in inner.lower() or 'confirm' in inner.lower()):
                    if '@click' in attrs:
                        print(f"Potential unguarded save button in {path}: <ion-button{attrs}>{inner.strip()}</ion-button>")
