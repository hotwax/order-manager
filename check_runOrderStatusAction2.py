import re

with open('src/views/OrderDetail.vue', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'async function runOrderStatusAction' in line:
        for j in range(i, min(i+15, len(lines))):
            print(lines[j], end='')
        print("-----")
