import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // 发布目标是 GitHub Pages 的项目站点 https://wwog.github.io/react/，生产构建的
  // 资源必须带 /react 前缀；本地 `npm run dev` 仍从根路径提供，`npm run preview`
  // 会按生产模式在 /react/ 下预览，与线上地址一致。
  base: mode === 'production' ? '/react/' : '/',
  plugins: [react()],
}))
