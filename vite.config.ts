import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'path'

// The size in bytes of every file /portfolio's loader waits on (the models
// under public/models/portfolio-* and jongwoo), by URL, as the module
// 'virtual:model-sizes'. Its percentage counts the bytes in against them
// (src/portfolio/room/loadProgress.ts): the server sends them compressed,
// with no length to read.
function modelSizes(): Plugin {
  const id = 'virtual:model-sizes'
  return {
    name: 'model-sizes',
    resolveId: (source) => (source === id ? '\0' + id : undefined),
    load(resolved) {
      if (resolved !== '\0' + id) return
      const pub = path.resolve(__dirname, 'public'),
        sizes: Record<string, number> = {}
      const walk = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const file = path.join(dir, e.name)
          if (e.isDirectory()) walk(file)
          else sizes['/' + path.relative(pub, file).split(path.sep).join('/')] = fs.statSync(file).size
        }
      }
      for (const e of fs.readdirSync(path.join(pub, 'models')))
        if (e.startsWith('portfolio-') || e === 'jongwoo') walk(path.join(pub, 'models', e))
      return `export default ${JSON.stringify(sizes)}`
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), modelSizes()],
  // Two pages of the one app: index.html, and portfolio.html for
  // sheem.ai/portfolio, its own title and link preview (vercel.json).
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        portfolio: path.resolve(__dirname, 'portfolio.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@lib': path.resolve(__dirname, './src/lib'),
    },
  },
})
