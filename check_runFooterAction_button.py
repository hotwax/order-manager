import os

with open('src/views/OrderDetail.vue', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'footerActions.filter' in line:
        for j in range(i-2, min(i+15, len(lines))):
            print(lines[j], end='')
        print("\n-----")
        break
