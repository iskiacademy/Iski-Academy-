import { withConnection } from './db.mjs'
import { HttpError, cleanText } from './validation.mjs'

function map(row) {
  return { id: Number(row.id), type: row.content_type, title: row.title, slug: row.slug, body: row.body, imageUrl: row.image_url || '', category: row.category, published: Boolean(row.published), createdAt: row.created_at, updatedAt: row.updated_at }
}
function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'invalid_content', 'Check the content fields.')
  const type = body.type === 'photo' ? 'photo' : body.type === 'post' ? 'post' : null
  if (!type) throw new HttpError(400, 'invalid_type', 'Choose a post or photo.')
  const title = cleanText(body.title, 180, 'title', { required: true })
  const slug = cleanText(body.slug || title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), 200, 'slug', { required: true }).toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new HttpError(400, 'invalid_slug', 'Use letters, numbers and hyphens for the URL slug.')
  const bodyText = cleanText(body.body || '', 12000, 'body')
  const imageUrl = cleanText(body.imageUrl || '', 1000, 'image URL')
  if (imageUrl && !/^https:\/\//i.test(imageUrl) && !imageUrl.startsWith('/assets/')) throw new HttpError(400, 'invalid_image_url', 'Use an https image URL or a site asset path.')
  const category = cleanText(body.category || 'Stories', 80, 'category') || 'Stories'
  return { type, title, slug, body: bodyText, imageUrl, category, published: Boolean(body.published) }
}
export async function listPublicContent() {
  return withConnection(async (c) => {
    const [rows] = await c.execute("SELECT * FROM site_content WHERE published = 1 ORDER BY updated_at DESC, id DESC LIMIT 100")
    return rows.map(map)
  })
}
export async function listAdminContent() {
  return withConnection(async (c) => {
    const [rows] = await c.execute('SELECT * FROM site_content ORDER BY updated_at DESC, id DESC LIMIT 300')
    return rows.map(map)
  })
}
export async function saveContent(input, user, id = null) {
  const item = validate(input)
  return withConnection(async (c) => {
    try {
      if (id) {
        await c.execute('UPDATE site_content SET content_type=?, title=?, slug=?, body=?, image_url=?, category=?, published=? WHERE id=?', [item.type, item.title, item.slug, item.body, item.imageUrl || null, item.category, item.published ? 1 : 0, id])
      } else {
        await c.execute('INSERT INTO site_content (content_type,title,slug,body,image_url,category,published,created_by) VALUES (?,?,?,?,?,?,?,?)', [item.type, item.title, item.slug, item.body, item.imageUrl || null, item.category, item.published ? 1 : 0, user.id])
        id = Number((await c.query('SELECT LAST_INSERT_ID() AS id'))[0][0].id)
      }
      const [rows] = await c.execute('SELECT * FROM site_content WHERE id=?', [id])
      if (!rows.length) throw new HttpError(404, 'content_not_found', 'Content not found.')
      return map(rows[0])
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'slug_exists', 'That URL slug is already in use.')
      throw error
    }
  })
}
export async function deleteContent(id) {
  return withConnection(async (c) => {
    const [result] = await c.execute('DELETE FROM site_content WHERE id=?', [id])
    if (!result.affectedRows) throw new HttpError(404, 'content_not_found', 'Content not found.')
    return { ok: true }
  })
}
