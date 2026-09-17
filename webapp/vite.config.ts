import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base 使用相对路径，确保部署到 GitHub Pages（/仓库名/）或任意子路径都能正常加载资源。
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
})
