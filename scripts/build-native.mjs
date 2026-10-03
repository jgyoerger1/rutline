// Build the web app for the native shell: root base path, output in dist-native.
// Usage: node scripts/build-native.mjs
import { build } from 'vite'

process.env.VITE_BASE = '/'
process.env.VITE_NATIVE = '1'

await build({
  configFile: 'vite.config.ts',
  build: { outDir: 'dist-native', emptyOutDir: true },
})
console.log('native web bundle written to dist-native/')
