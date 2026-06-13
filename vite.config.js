/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { ideTraceVue } from 'chrome-ide-trace/vite'
import { defineConfig } from 'vite'
import { versionInfoUtil } from '../../common/utils/versionInfoUtil'
import { localApiServerDiscoveryPlugin } from '../../common/vite/localApiServerDiscoveryPlugin'
import pkg from './package.json'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    ideTraceVue(),
    vue(),
    legacy(),
    localApiServerDiscoveryPlugin()
  ],
  define: {
    'import.meta.env.VITE_VERSION_INFO': JSON.stringify(JSON.stringify(versionInfoUtil.getVersionInfo(pkg.version)))
  },
  resolve: {
    dedupe: ['vue', 'pinia'],
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.mts', '.jsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@common': path.resolve(__dirname, '../../common')
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', '.claude']
  }
})
