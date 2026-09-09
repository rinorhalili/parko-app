import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'

const extra = Constants.expoConfig?.extra ?? {}
const API = String(extra.apiBaseUrl ?? 'http://localhost:4000/api/v1').replace(/\/$/, '')
let accessToken: string | null = null
export function getAccessToken() { return accessToken }

export async function restoreToken() { accessToken = await SecureStore.getItemAsync('parko.accessToken'); return accessToken }
export async function clearSession() { accessToken = null; await SecureStore.deleteItemAsync('parko.accessToken'); await SecureStore.deleteItemAsync('parko.refreshToken') }
async function saveTokens(data: { accessToken: string; refreshToken?: string }) { accessToken = data.accessToken; await SecureStore.setItemAsync('parko.accessToken', data.accessToken); if (data.refreshToken) await SecureStore.setItemAsync('parko.refreshToken', data.refreshToken) }
async function refresh() { const refreshToken = await SecureStore.getItemAsync('parko.refreshToken'); if (!refreshToken) return false; const response = await fetch(`${API}/auth/refresh`, {method:'POST',headers:{'content-type':'application/json','x-parko-client':'native'},body:JSON.stringify({refreshToken})}); if (!response.ok) return false; const body = await response.json(); await saveTokens(body.data); return true }
export async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers); headers.set('content-type','application/json'); headers.set('x-parko-client','native'); if (accessToken) headers.set('authorization',`Bearer ${accessToken}`)
  const response = await fetch(`${API}${path}`, {...init,headers})
  if (response.status === 401 && retry && await refresh()) return request<T>(path, init, false)
  const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body?.error?.message ?? 'Kërkesa dështoi')
  return body.data as T
}
export async function login(email:string,password:string) { const data=await request<{accessToken:string;refreshToken:string}>('/auth/login',{method:'POST',body:JSON.stringify({email,password})},false); await saveTokens(data); return data }
export async function register(input:{name:string;username:string;email:string;password:string}) { const data=await request<{accessToken:string;refreshToken:string}>('/auth/register',{method:'POST',body:JSON.stringify(input)},false); await saveTokens(data); return data }
export async function logout() { try { const refreshToken = await SecureStore.getItemAsync('parko.refreshToken'); await request('/auth/logout',{method:'POST',body:JSON.stringify({refreshToken})}) } finally { await clearSession() } }
export type MobilePost={id:string;title:string;content:string;createdAt:string;author?:{username:string}}
export type MobileNotification={id:string;title:string;message:string;readAt:string|null;createdAt:string}
export type MobileParking={id:string;title:string;latitude:number;longitude:number;status:string;address?:string|null;type:string}
export type MobileReservation={id:string;parkingSpotId:string;startsAt:string;expiresAt:string;cancelledAt:string|null;parkingSpot:{id:string;title:string;address:string|null;latitude:number;longitude:number;type:string}}
export function listPosts(){return request<MobilePost[]>('/posts')}
export function listNotifications(){return request<MobileNotification[]>('/notifications')}
export function registerPushDevice(token:string,platform:'android'|'ios'){return request('/notifications/devices',{method:'POST',body:JSON.stringify({token,platform})})}
export function listMyReservations(){return request<{items:MobileReservation[]}>('/reservations/me?page=0&pageSize=50')}
export function createReservation(parkingSpotId:string,startsAt:Date,expiresAt:Date){return request<MobileReservation>('/reservations',{method:'POST',body:JSON.stringify({parkingSpotId,startsAt:startsAt.toISOString(),expiresAt:expiresAt.toISOString()})})}
export function cancelReservation(id:string){return request<MobileReservation>(`/reservations/${encodeURIComponent(id)}`,{method:'DELETE'})}
