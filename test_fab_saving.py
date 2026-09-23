import re
with open('src/views/OrderDetail.vue', 'r') as f:
    content = f.read()

# find saving properties
print(re.findall(r'const saving[a-zA-Z0-9]* = ref\(.*?\);', content))
