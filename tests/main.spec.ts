import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('app theme setup', () => {
  it('loads the Ionic system dark palette', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8');

    expect(source).toContain("import '@ionic/vue/css/palettes/dark.system.css';");
  });
});
