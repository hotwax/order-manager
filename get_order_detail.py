with open('src/views/OrderDetail.vue', 'r') as f:
    lines = f.readlines()

start = -1
end = -1

for i, line in enumerate(lines):
    if 'footerActions.filter' in line and start == -1:
        start = i - 2
    if 'ion-footer' in line and start != -1 and i > start:
        end = i + 2

for i in range(start, end):
    print(lines[i], end='')
