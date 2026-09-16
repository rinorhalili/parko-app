export type Role = 'USER' | 'MODERATOR' | 'ADMIN'
export type ParkingStatus = 'AVAILABLE' | 'OCCUPIED' | 'UNKNOWN' | 'RESERVED' | 'TEMPORARILY_UNAVAILABLE'
export type ParkingType = 'STREET' | 'GARAGE' | 'LOT' | 'PRIVATE' | 'ACCESSIBLE'

export interface ApiResponse<T> {
  success: boolean
  data: T
  meta?: Record<string, unknown>
}

export interface ApiErrorBody {
  success: false
  error: { code: string; message: string }
}

export interface User {
  id: string
  name: string
  username: string
  email: string
  role: Role
  reputationScore: number
  avatar: string | null
  bio: string | null
  isVerified: boolean
}

export interface AuthTokens {
  user: User
  accessToken: string
  refreshToken?: string
}

export interface LoginInput {
  email: string
  password: string
  turnstileToken?: string
}

export interface RegisterInput extends LoginInput {
  name: string
  username: string
}

export interface ParkingSpot {
  id: string
  ownerId: string | null
  title: string
  description: string | null
  latitude: number
  longitude: number
  address: string | null
  zone: string | null
  status: ParkingStatus
  type: ParkingType
  capacity: number | null
  pricePerHour: number | null
  reportedAt: string | null
  verifiedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface NearbyParkingSpot extends Pick<ParkingSpot, 'id' | 'title' | 'latitude' | 'longitude' | 'address' | 'zone' | 'status' | 'type' | 'updatedAt'> {
  distance: number
}

export interface CreateParkingInput {
  title: string
  description?: string
  latitude: number
  longitude: number
  address?: string
  zone?: string
  type?: ParkingType
  capacity?: number
}

export interface ParkingReport {
  id: string
  reporterId: string
  parkingSpotId: string
  status: ParkingStatus
  latitude: number
  longitude: number
  description: string | null
  confidence: number
  payment: 'FREE' | 'PAID' | null
  policeRisk: boolean | null
  media: Array<{ url: string; type: 'image' }> | null
  expiresAt: string
  createdAt: string
  parkingSpot?: ParkingSpot
  reporter?: Pick<User, 'id' | 'username' | 'reputationScore'>
}

export interface CreateParkingReportInput {
  parkingSpotId: string
  status: Extract<ParkingStatus, 'AVAILABLE' | 'OCCUPIED' | 'UNKNOWN'>
  latitude: number
  longitude: number
  description?: string
  confidence?: number
  payment?: 'FREE' | 'PAID'
  policeRisk?: boolean
  media?: Array<{ url: string; type: 'image' }>
}

export interface CommunityPost {
  id: string
  authorId: string
  parkingSpotId: string | null
  title: string
  content: string
  latitude: number | null
  longitude: number | null
  media: Array<{ url: string; type: string }> | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  author?: Pick<User, 'id' | 'username' | 'reputationScore'>
  _count?: { comments: number; reactions: number }
}

export interface CreatePostInput {
  title: string
  content: string
  parkingSpotId?: string
  latitude?: number
  longitude?: number
  media?: Array<{ url: string; type: string }>
}

export interface CommunityComment {
  id: string
  authorId: string
  postId: string
  parentCommentId: string | null
  content: string
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  author?: Pick<User, 'id' | 'username'>
}

export interface ParkingUpdatedEvent {
  parkingSpotId: string
  status: ParkingStatus
}

export interface ReservationEvent {
  id: string
  parkingSpotId: string
  userId: string
  startsAt: string
  expiresAt: string
  cancelledAt: string | null
  createdAt: string
}

export type SocketEventMap = {
  'parking:updated': ParkingUpdatedEvent
  'reservation:created': ReservationEvent
  'reservation:cancelled': { reservationId: string }
  'parking:reported': ParkingReport
  'post:new': CommunityPost
  'comment:new': CommunityComment
  'moderation:update': unknown
}
