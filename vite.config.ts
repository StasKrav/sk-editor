import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    dedupe: [
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/language',
      '@codemirror/commands',
      '@codemirror/search',
      '@lezer/highlight',
      '@lezer/common',
    ],
  },
  build: {

    chunkSizeWarningLimit: 3000,
  },
})