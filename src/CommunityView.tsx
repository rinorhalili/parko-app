import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ApiError, getAccessToken } from './api/client'
import { createPost, listPosts } from './api/communityService'
import { listNotifications, markAllNotificationsRead, markNotificationRead, type Notification } from './api/notificationService'
import { listFavorites, listZoneAlerts, removePostFavorite, removeZoneAlert, savePostFavorite, subscribeZoneAlert, type ZoneAlert } from './api/favoritesService'
import type { CommunityPost } from './api/types'
import { useSocket } from './hooks/useSocket'
import { prepareImageAttachment } from './imageAttachment'

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
  const [photoUrl, setPhotoUrl] = useState('')
  const [favoritePostIds, setFavoritePostIds] = useState<string[]>([])
  const [zoneAlerts, setZoneAlerts] = useState<ZoneAlert[]>([])
  const [zone, setZone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const authenticated = Boolean(getAccessToken())

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [nextPosts, nextNotifications, favorites, alerts] = await Promise.all([
        listPosts(),
        authenticated ? listNotifications() : Promise.resolve([]),
        authenticated ? listFavorites() : Promise.resolve({ parkingIds: [], postIds: [] }),
        authenticated ? listZoneAlerts() : Promise.resolve([]),
      ])
      setPosts(nextPosts); setNotifications(nextNotifications)
      setFavoritePostIds(favorites.postIds); setZoneAlerts(alerts)
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
    if (!title.trim() || !content.trim()) {
      setError('Titulli dhe përmbajtja nuk mund të jenë vetëm hapësira.')
      return
    }
    setSubmitting(true); setError('')
    try {
      const media = photoUrl.trim() ? [{ url: photoUrl.trim(), type: 'image' as const }] : undefined
      const post = await createPost({ title: title.trim(), content: content.trim(), media })
      setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])
      setTitle(''); setContent(''); setPhotoUrl('')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Postimi nuk u publikua.')
    } finally { setSubmitting(false) }
  }

  const choosePhoto = async (file?: File) => {
    if (!file) return
    try { setPhotoUrl((await prepareImageAttachment(file)).url) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Fotoja nuk u përgatit.') }
  }

  const toggleFavorite = async (postId: string) => {
    if (!authenticated) { onLogin(); return }
    const saved = favoritePostIds.includes(postId)
    try {
      if (saved) { await removePostFavorite(postId); setFavoritePostIds((current) => current.filter((id) => id !== postId)) }
      else { await savePostFavorite(postId); setFavoritePostIds((current) => [...current, postId]) }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Postimi nuk u ruajt.') }
  }

  const addZoneAlert = async (event: FormEvent) => {
    event.preventDefault(); if (!authenticated) { onLogin(); return }
    const normalizedZone = zone.trim()
    if (!normalizedZone) { setError('Zona nuk mund të përmbajë vetëm hapësira.'); return }
    setError('')
    try { const alert = await subscribeZoneAlert(normalizedZone); setZoneAlerts((current) => [...current.filter((item) => item.zone !== alert.zone), alert]); setZone('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Alerti nuk u ruajt.') }
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
          <label className="image-attachment-control">📷 <span>{photoUrl ? 'Foto e bashkëngjitur' : 'Shto foto'}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void choosePhoto(file) }} disabled={submitting} /></label>
          {photoUrl && <><img className="community-post-photo" src={photoUrl} alt="Pamja paraprake e fotos" /><button type="button" className="text-button" onClick={() => setPhotoUrl('')}>Hiq foton</button></>}
          <button className="login-button" disabled={submitting}>{authenticated ? (submitting ? 'Duke publikuar…' : 'Publiko') : 'Hyr për të publikuar'}</button>
        </form>
        {loading ? <p role="status">Duke ngarkuar postimet…</p> : posts.length === 0 ? <p>Nuk ka ende postime. Bëhu i pari që ndan një përditësim.</p> : <div className="queue-list">{posts.map((post) => <article className="queue-card" key={post.id}><b>{post.title}</b><small>{post.author?.username ?? 'Përdorues Parko'} · {dateLabel(post.createdAt)}</small><p>{post.content}</p>{post.media?.map((item) => <img className="community-post-photo" key={item.url} src={item.url} alt={`Foto nga ${post.title}`} loading="lazy" />)}<div className="queue-card__footer"><small>{post._count?.comments ?? 0} komente · {post._count?.reactions ?? 0} reagime</small><button type="button" onClick={() => void toggleFavorite(post.id)} aria-pressed={favoritePostIds.includes(post.id)}>{favoritePostIds.includes(post.id) ? '★ Ruajtur' : '☆ Ruaj'}</button></div></article>)}</div>}
      </section>
      {authenticated && <section className="settings-section">
        <div className="settings-section__heading"><span><small>Alertet</small><h2>Zona të ruajtura</h2></span></div>
        <p>Do të njoftohesh kur komuniteti raporton vende të lira në zonën e zgjedhur.</p>
        <form className="login-form" onSubmit={(event) => void addZoneAlert(event)}><input className="form-input" value={zone} onChange={(event) => setZone(event.target.value)} maxLength={80} placeholder="p.sh. Qendër, Dardani" required /><button className="login-button">Shto alert</button></form>
        <div className="queue-list">{zoneAlerts.map((alert) => <div className="queue-card" key={alert.id}><b>{alert.zone}</b><button type="button" onClick={() => void removeZoneAlert(alert.zone).then(() => setZoneAlerts((current) => current.filter((item) => item.id !== alert.id))).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Alerti nuk u hoq.'))}>Hiq</button></div>)}</div>
      </section>}
      {authenticated && <section className="settings-section">
        <div className="settings-section__heading"><span><small>Llogaria</small><h2>Njoftimet</h2></span>{notifications.some((item) => !item.readAt) && <button onClick={() => void markAllNotificationsRead()}>Shëno të gjitha</button>}</div>
        {loading ? <p role="status">Duke ngarkuar njoftimet…</p> : notifications.length === 0 ? <p>Nuk ke njoftime.</p> : <div className="queue-list">{notifications.map((item) => <button className="queue-card" key={item.id} onClick={() => { if (!item.readAt) void read(item.id) }}><b>{item.title}</b><small>{item.message} · {dateLabel(item.createdAt)}{item.readAt ? '' : ' · e re'}</small></button>)}</div>}
      </section>}
    </main>
  </div>
}

function StatusBarLike() { return <div className="status-bar" aria-hidden="true"><span>Parko</span></div> }
