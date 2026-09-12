import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { getAccessToken, SOCKET_URL } from '../api/client'
import type { SocketEventMap } from '../api/types'

type SocketOptions = {
  enabled?: boolean
  parkingSpotId?: string
  zone?: string
  onParkingUpdate?: (event: SocketEventMap['parking:updated']) => void
  onParkingReport?: (event: SocketEventMap['parking:reported']) => void
  onReservationCreated?: (event: SocketEventMap['reservation:created']) => void
  onReservationCancelled?: (event: SocketEventMap['reservation:cancelled']) => void
  onCommunityEvent?: (event: { type: 'post:new' | 'comment:new' | 'moderation:update'; payload: unknown }) => void
}

export function useSocket(options: SocketOptions = {}) {
  const [authToken, setAuthToken] = useState(getAccessToken)
  useEffect(() => { const update = () => setAuthToken(getAccessToken()); window.addEventListener('parko:auth-changed', update); return () => window.removeEventListener('parko:auth-changed', update) }, [])
  const { enabled = true, parkingSpotId, zone } = options
  const handlers = useRef(options)
  handlers.current = options
  const socketRef = useRef<Socket | null>(null)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')

  useEffect(() => {
    if (!enabled || !getAccessToken()) {
      setStatus('disconnected')
      return
    }

    const socket = io(SOCKET_URL, {
      auth: (callback: (credentials: { token: string | null }) => void) => callback({ token: getAccessToken() }),
      withCredentials: true,
      transports: ['polling'],
      reconnection: true,
      reconnectionAttempts: Infinity
    })
    socketRef.current = socket
    setStatus('connecting')
    socket.on('connect', () => {
      setStatus('connected')
      if (parkingSpotId || zone) socket.emit('parking:subscribe', { spotId: parkingSpotId, zone })
      socket.emit('community:subscribe')
    })
    socket.on('disconnect', () => setStatus('disconnected'))
    socket.on('connect_error', () => setStatus('disconnected'))
    socket.on('parking:updated', (event: SocketEventMap['parking:updated']) => handlers.current.onParkingUpdate?.(event))
    socket.on('parking:reported', (event: SocketEventMap['parking:reported']) => handlers.current.onParkingReport?.(event))
    socket.on('reservation:created', (event: SocketEventMap['reservation:created']) => handlers.current.onReservationCreated?.(event))
    socket.on('reservation:cancelled', (event: SocketEventMap['reservation:cancelled']) => handlers.current.onReservationCancelled?.(event))
    for (const event of ['post:new', 'comment:new', 'moderation:update'] as const) {
      socket.on(event, (payload: unknown) => handlers.current.onCommunityEvent?.({ type: event, payload }))
    }

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [enabled, parkingSpotId, zone, authToken])

  return { socket: socketRef.current, status, isConnected: status === 'connected' }
}
