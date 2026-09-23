import re

with open('src/components/tasks/SwapTaskCard.vue', 'r') as f:
    content = f.read()

match = re.search(r'const modal = await modalController\.create\({\s*component: ReleaseSwapOrderModal,.*?\n\s*\}\);\s*await modal\.present\(\);\s*(.*?)\n\s*\}', content, re.DOTALL)
if match:
    print(match.group(1))
