import re

with open('src/views/OrderDetail.vue', 'r') as f:
    content = f.read()

# Update startReturn signature
if 'async function startReturn() {' in content:
    pass
