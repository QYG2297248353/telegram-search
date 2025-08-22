import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/node/index.ts',
    'src/utils/*.ts',
  ],
  dts: true,
  sourcemap: true,
  unused: true,
  fixedExtension: true,
})
