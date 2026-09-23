import re
with open('src/views/OrderDetail.vue', 'r') as f:
    content = f.read()

content = content.replace('async async function runFooterAction', 'async function runFooterAction')

with open('src/views/OrderDetail.vue', 'w') as f:
    f.write(content)
