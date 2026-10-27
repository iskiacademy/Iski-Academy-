import { createServer } from 'vite'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, 'dist')
const template = await fs.readFile(path.join(output, 'index.html'), 'utf8')
if (!template.includes('<div id="root"></div>')) {
  throw new Error('Expected the Vite HTML template to contain an empty #root mount point.')
}

const vite = await createServer({
  root,
  configFile: path.join(root, 'vite.config.ts'),
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
})

try {
  const [{ renderPage }, seo] = await Promise.all([
    vite.ssrLoadModule('/src/render.tsx'),
    vite.ssrLoadModule('/src/seo.ts'),
  ])

  const routes = Object.keys(seo.PAGE_METADATA)
  for (const route of routes) {
    const body = renderPage(route)
    const html = template
      .replace('<div id="root"></div>', `<div id="root">${body}</div>`)
      .replace(/<title>[\s\S]*?<\/title>/, '')
      .replace(/<meta name="description"[^>]*\/?\s*>/, '')
      .replace('</head>', `    ${seo.renderHeadTags(route)}\n  </head>`)
    const destination = route === '/' ? path.join(output, 'index.html') : path.join(output, route.slice(1), 'index.html')
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.writeFile(destination, html)
  }

  const notFoundBody = renderPage('/__not-found__')
  const notFoundHtml = template
    .replace('<div id="root"></div>', `<div id="root">${notFoundBody}</div>`)
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*\/?\s*>/, '')
    .replace('</head>', `    ${seo.renderHeadTags('/__not-found__')}\n  </head>`)
  await fs.writeFile(path.join(output, '404.html'), notFoundHtml)
  const adminBody = renderPage('/admin')
  const adminHtml = template
    .replace('<div id="root"></div>', `<div id="root">${adminBody}</div>`)
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*\/?\s*>/, '')
    .replace('</head>', `    ${seo.renderHeadTags('/admin')}\n  </head>`)
  const adminDestination = path.join(output, 'admin', 'index.html')
  await fs.mkdir(path.dirname(adminDestination), { recursive: true })
  await fs.writeFile(adminDestination, adminHtml)
  console.log(`Prerendered ${routes.length} public routes, an admin shell and a 404 page.`)
} finally {
  await vite.close()
}
