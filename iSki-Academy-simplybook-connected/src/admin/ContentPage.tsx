import { useEffect, useState, type FormEvent } from 'react'
import { ImagePlus, Newspaper, Plus, Save, Trash2, X } from 'lucide-react'
import { adminRequest, type AdminUser } from './api'

type Item = { id: number; type: 'post' | 'photo'; title: string; slug: string; body: string; imageUrl: string; category: string; published: boolean; updatedAt: string }
type Draft = Omit<Item, 'id' | 'updatedAt'>
const blank: Draft = { type: 'post', title: '', slug: '', body: '', imageUrl: '', category: 'Stories', published: false }

export default function ContentPage({ csrf, user }: { csrf: string; user: AdminUser }) {
  const [items, setItems] = useState<Item[]>([])
  const [draft, setDraft] = useState<Draft>(blank)
  const [editing, setEditing] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function refresh() { setLoading(true); try { const data = await adminRequest<{items: Item[]}>('/api/admin/content'); setItems(data.items) } catch (e) { setError(e instanceof Error ? e.message : 'Could not load content.') } finally { setLoading(false) } }
  useEffect(() => { void refresh() }, [])
  function update<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft(old => ({ ...old, [key]: value })) }
  function edit(item: Item) { setEditing(item.id); setDraft({ type: item.type, title: item.title, slug: item.slug, body: item.body, imageUrl: item.imageUrl, category: item.category, published: item.published }); setError(''); setNotice('') }
  function reset() { setEditing(null); setDraft(blank); setError(''); setNotice('') }
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); setNotice(''); try { const payload = { ...draft, slug: draft.slug || draft.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }; if (editing) await adminRequest(`/api/admin/content/${editing}`, { method: 'PUT', csrf, body: payload }); else await adminRequest('/api/admin/content', { method: 'POST', csrf, body: payload }); await refresh(); reset(); setNotice('Saved successfully.') } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this item.') } finally { setBusy(false) } }
  async function remove(item: Item) { if (!window.confirm(`Delete “${item.title}”?`)) return; setError(''); try { await adminRequest(`/api/admin/content/${item.id}`, { method: 'DELETE', csrf }); setItems(old => old.filter(x => x.id !== item.id)); if (editing === item.id) reset(); setNotice('Item deleted.') } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete item.') } }
  if (!['owner','admin'].includes(user.role)) return <section className="admin-panel"><h2>Content management</h2><p>Only the owner or an admin can edit website content.</p></section>
  return <div className="content-manager">
    <section className="admin-panel content-manager__intro"><div><p className="admin-eyebrow">WEBSITE CONTENT</p><h2>Posts & gallery</h2><p>Keep the site simple. Create a short story or add a gallery image. Publish when ready.</p></div><button className="admin-primary-button" onClick={reset}><Plus size={17}/> New item</button></section>
    {error && <div className="admin-alert admin-alert--error" role="alert">{error}</div>}{notice && <div className="admin-alert admin-alert--success" role="status">{notice}</div>}
    <div className="content-manager__layout">
      <section className="admin-panel"><div className="content-manager__heading"><h2>{editing ? 'Edit item' : 'Create content'}</h2>{editing && <button className="content-quiet-button" onClick={reset}><X size={16}/> Cancel</button>}</div>
        <form className="content-editor" onSubmit={submit}>
          <label>Content type<select value={draft.type} onChange={e=>update('type',e.target.value as Draft['type'])}><option value="post">Post / story</option><option value="photo">Gallery photo</option></select></label>
          <label>Title<input required maxLength={180} value={draft.title} onChange={e=>update('title',e.target.value)} placeholder={draft.type === 'photo' ? 'Skiing at Kopaonik' : 'A short story title'}/></label>
          <label>URL slug<input value={draft.slug} onChange={e=>update('slug',e.target.value)} placeholder="auto-created-from-title"/><small>Optional. Use simple words and hyphens.</small></label>
          <label>Category<input maxLength={80} value={draft.category} onChange={e=>update('category',e.target.value)} placeholder="Coaching, Mountain, News…"/></label>
          <label>Image URL<input type="text" inputMode="url" value={draft.imageUrl} onChange={e=>update('imageUrl',e.target.value)} placeholder="https://…"/><small>Paste a direct HTTPS image link. Direct file uploads need an image-storage service, which is not connected yet.</small></label>
          {draft.imageUrl && <img className="content-editor__preview" src={draft.imageUrl} alt="Image preview" onError={e=>{e.currentTarget.style.display='none'}} onLoad={e=>{e.currentTarget.style.display='block'}}/>}
          <label>Text / caption<textarea rows={6} maxLength={12000} value={draft.body} onChange={e=>update('body',e.target.value)} placeholder={draft.type === 'photo' ? 'A short photo caption…' : 'Write your post here…'}/></label>
          <label className="content-publish-toggle"><input type="checkbox" checked={draft.published} onChange={e=>update('published',e.target.checked)}/> Publish on website now</label>
          <div className="content-editor__actions"><button type="submit" className="admin-primary-button" disabled={busy}><Save size={16}/>{busy ? 'Saving…' : 'Save item'}</button><button type="button" className="content-quiet-button" onClick={reset}>Clear form</button></div>
        </form>
      </section>
      <section className="admin-panel"><div className="content-manager__heading"><h2>Saved items</h2><span>{items.length}</span></div>{loading ? <p>Loading content…</p> : items.length === 0 ? <div className="content-empty"><ImagePlus size={28}/><p>No posts or photos yet.</p></div> : <div className="content-item-list">{items.map(item=><article className="content-item" key={item.id}>{item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy"/> : <div className="content-item__placeholder">{item.type === 'photo' ? <ImagePlus/> : <Newspaper/>}</div>}<div className="content-item__details"><span className="content-item__meta">{item.type} · {item.published ? 'Published' : 'Draft'}</span><strong>{item.title}</strong><small>{item.category} · {item.slug}</small><p>{item.body || 'No caption yet.'}</p><div className="content-item__actions"><button onClick={()=>edit(item)}>Edit</button><button onClick={()=>void remove(item)} aria-label={`Delete ${item.title}`}><Trash2 size={14}/> Delete</button></div></div></article>)}</div>}</section>
    </div>
  </div>
}
