import os

with open('src/views/OrderDetail.vue', 'r') as f:
    content = f.read()

if 'isActionRunning' in content or 'isActionLoading' in content or 'performingAction' in content:
    print("Found some action state variable.")
else:
    print("No obvious action state variable found.")
