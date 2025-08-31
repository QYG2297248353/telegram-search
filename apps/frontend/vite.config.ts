import { env } from 'node:process'

import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import Unused from 'unplugin-unused/vite'
import VueMacros from 'unplugin-vue-macros/vite'
import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig } from 'vite'
import Inspect from 'vite-plugin-inspect'
import Devtools from 'vite-plugin-vue-devtools'
import Layouts from 'vite-plugin-vue-layouts'
import { nodePolyfills } from 'vite-plugin-node-polyfills'


export default defineConfig({
  plugins: [
    Inspect(),

    Unused(),

    Devtools(),

    // https://github.com/posva/unplugin-vue-router
    VueRouter({
      routesFolder: '../../packages/stage-ui/src/pages',
    }),

    Layouts({
      layoutsDirs: '../../packages/stage-ui/src/layouts',
    }),

    VueMacros({
      defineOptions: false,
      defineModels: false,
      plugins: {
        vue: Vue({
          script: {
            propsDestructure: true,
            defineModel: true,
          },
        }),
      },
    }),

    // https://github.com/antfu/unocss
    // see uno.config.ts for config
    UnoCSS(),
    nodePolyfills({
      // 启用所有必要的 polyfill
      include: [
        'crypto', 
        'buffer', 
        'util', 
        'process', 
        'path', 
        'os',
        'events'
      ],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  
  resolve:{
    mainFields:['browser','module','main'],
    alias:{
      
    }
  },
  optimizeDeps: {
    exclude: ['@electric-sql/pglite'], // 排除有问题的包
  },
  // Proxy API requests to local development server
  server: {
    proxy: {
      '/api': {
        target: env.BACKEND_URL ?? 'http://localhost:3000',
        changeOrigin: true,
        // Remove /api prefix when forwarding to target
        rewrite: path => path.replace(/^\/api/, ''),
      },
      '/ws': {
        target: env.BACKEND_URL ?? 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
