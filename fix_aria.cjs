const fs = require('fs');

const file = 'src/views/Settings.vue';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /<ion-button fill="clear" size="small" :disabled="!!refreshing" @click="refreshAll\(\)">/g,
  '<ion-button fill="clear" size="small" :disabled="!!refreshing" @click="refreshAll()" :aria-label="translate(\'Refresh all\')">'
);

content = content.replace(
  /<ion-button slot="end" fill="clear" @click="item.refresh\(\)">/g,
  '<ion-button slot="end" fill="clear" @click="item.refresh()" :aria-label="translate(\'Refresh\') + \' \' + item.label">'
);

content = content.replace(
  /<ion-button slot="end" fill="clear" :disabled="!!refreshing" @click="refreshDomain\(domain.name\)">/g,
  '<ion-button slot="end" fill="clear" :disabled="!!refreshing" @click="refreshDomain(domain.name)" :aria-label="translate(\'Refresh\') + \' \' + translate(domain.label)">'
);

fs.writeFileSync(file, content);
