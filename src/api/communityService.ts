import { apiRequest } from './client'
import type { CommunityComment, CommunityPost, CreatePostInput } from './types'

export function listPosts() { return apiRequest<CommunityPost[]>('/posts') }

export function getPost(id: string) { return apiRequest<CommunityPost>(`/posts/${encodeURIComponent(id)}`) }

export function createPost(input: CreatePostInput) {
  return apiRequest<CommunityPost>('/posts', { method: 'POST', body: JSON.stringify(input) })
}

export function listComments(postId: string) {
  return apiRequest<CommunityComment[]>(`/posts/${encodeURIComponent(postId)}/comments`)
}

export function createComment(postId: string, content: string) {
  return apiRequest<CommunityComment>(`/posts/${encodeURIComponent(postId)}/comments`, {
    method: 'POST', body: JSON.stringify({ content })
  })
}

export function deletePost(id: string) {
  return apiRequest<void>(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
