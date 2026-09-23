import re

with open('src/views/OrderDetail.vue', 'r') as f:
    content = f.read()

# Let's check startReturn
match = re.search(r'async function startReturn\(\).*?}', content, re.DOTALL)
if match:
    print(match.group(0))
