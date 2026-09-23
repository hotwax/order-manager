import re

with open('src/views/OrderDetail.vue', 'r') as f:
    content = f.read()

match = re.search(r'async function openCloneOrderModal\(\).*?}', content, re.DOTALL)
if match:
    print(match.group(0))
