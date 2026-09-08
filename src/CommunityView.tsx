import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ApiError, getAccessToken } from './api/client'
import { createPost, listPosts } from './api/communityService'
import { listNotifications, markAllNotificationsRead, markNotificationRead, type Notification } from './api/notificationService'
import type { CommunityPost } from './api/types'
import { useSocket } from './hooks/useSocket'

type Props = { onBack: () => void; onLogin: () => void }

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('sq-AL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export default function CommunityView({ onBack, onLogin }: Props) {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const authenticated = Boolean(getAccessToken())

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [nextPosts, nextNotifications] = await Promise.all([
        listPosts(),
        authenticated ? listNotifications() : Promise.resolve([]),
      ])
      setPosts(nextPosts); setNotifications(nextNotifications)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Të dhënat e komunitetit nuk u ngarkuan.')
    } finally { setLoading(false) }
  }, [authenticated])

  useEffect(() => { void load() }, [load])
  useSocket({ onCommunityEvent: ({ type, payload }) => {
    if (type !== 'post:new') return
    const post = payload as CommunityPost
    setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])
  } })

  const publish = async (event: FormEvent) => {
    event.preventDefault()
    if (!authenticated) { onLogin(); return }
    setSubmitting(true); setError('')
    try {
      const post = await createPost({ title: title.trim(), content: content.trim() })
      setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])
      setTitle(''); setContent('')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Postimi nuk u publikua.')
    } finally { setSubmitting(false) }
  }

  const read = async (id: string) => {
    try {
      const updated = await markNotificationRead(id)
      setNotifications((current) => current.map((item) => item.id === id ? updated : item))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Njoftimi nuk u përditësua.') }
  }

  return <div className="screen settings-screen">
    <StatusBarLike />
    <header className="settings-header"><div><small>Parko</small><h1>Komuniteti</h1><p>Raportime dhe njoftime nga API-ja Parko.</p></div><button onClick={onBack}>Harta</button></header>
    <main className="settings-content">
      {error && <div className="app-feedback" role="alert"><span>{error}</span><button onClick={() => void load()}>Provo përsëri</button></div>}
      <section className="settings-section">
        <div className="settings-section__heading"><span><small>Diskutim</small><h2>Postime</h2></span></div>
        <form className="login-form" onSubmit={(event) => void publish(event)}>
          <input className="form-input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Titulli" required disabled={submitting} />
          <textarea className="form-input" value={content} onChange={(event) => setContent(event.target.value)} maxLength={5000} placeholder="Ndaj një përditësim për parkingun" required disabled={submitting} />
          <button className="login-button" disabled={submitting}>{authenticated ? (submitting ? 'Duke publikuar…' : 'Publiko') : 'Hyr për të publikuar'}</button>
        </form>
        {loading ? <p role="status">Duke ngarkuar postimet…</p> : posts.length === 0 ? <p>Nuk ka ende postime. Bëhu i pari që ndan një përditësim.</p> : <div className="queue-list">{posts.map((post) => <article className="queue-card" key={post.id}><b>{post.title}</b><small>{post.author?.username ?? 'Përdorues Parko'} · {dateLabel(post.createdAt)}</small><p>{post.content}</p><small>{post._count?.comments ?? 0} komente · {post._count?.reactions ?? 0} reagime</small></article>)}</div>}
      </section>
      {authenticated && <section className="settings-section">
        <div className="settings-section__heading"><span><small>Llogaria</small><h2>Njoftimet</h2></span>{notifications.some((item) => !item.readAt) && <button onClick={() => void markAllNotificationsRead()}>Shëno të gjitha</button>}</div>
        {loading ? <p role="status">Duke ngarkuar njoftimet…</p> : notifications.length === 0 ? <p>Nuk ke njoftime.</p> : <div className="queue-list">{notifications.map((item) => <button className="queue-card" key={item.id} onClick={() => { if (!item.readAt) void read(item.id) }}><b>{item.title}</b><small>{item.message} · {dateLabel(item.createdAt)}{item.readAt ? '' : ' · e re'}</small></button>)}</div>}
      </section>}
    </main>
  </div>
}

function StatusBarLike() { return <div className="status-bar" aria-hidden="true"><span>Parko</span></div> }
