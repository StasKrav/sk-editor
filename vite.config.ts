import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    // Твой редактор тащит CodeMirror + Prettier + Babel + PostCSS
    // в один бандл (~2.8 MB), это нормально для такого приложения.
    // Поднимаем лимит предупреждения, чтобы не шумело при сборке.
    chunkSizeWarningLimit: 3000,
  },
})
