import os
import re

with open('src/views/OrderDetail.vue', 'r') as f:
    content = f.read()

match = re.search(r'function runFooterAction\(.*?\)\s*{([\s\S]*?)}', content)
if match:
    print(match.group(0))
