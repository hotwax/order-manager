import os

with open('src/views/OrderDetail.vue', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'footerActions.filter' in line:
        for j in range(i, min(i+10, len(lines))):
            print(lines[j].strip())
        print("-----")
