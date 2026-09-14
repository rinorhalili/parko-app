import { useEffect, useState } from "react";
import { listPosts } from "../api/communityService";
import type { CommunityPost } from "../api/types";
import { CommentThread } from "../components/CommentThread";
import { CommunityPostForm } from "../components/CommunityPostForm";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { relativeTime } from "../utils/date";

export default function CommunityFeedPage() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void listPosts()
      .then(setPosts)
      .catch((next) => setError(next instanceof Error ? next.message : "Postimet nuk u ngarkuan."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout title="Komuniteti">
      <CommunityPostForm onCreated={(post) => setPosts((current) => [post, ...current])} />
      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && posts.length === 0 && <EmptyState title="Ende pa postime" />}
      {posts.map((post) => (
        <article className="parking-card" key={post.id}>
          <div className="parking-card__content">
            <strong>{post.title}</strong>
            <small>{post.author?.username ?? "Komuniteti"} • {relativeTime(post.createdAt)}</small>
            <p>{post.content}</p>
          </div>
          <button className="button button--secondary" onClick={() => setActivePostId(activePostId === post.id ? null : post.id)}>
            Komente
          </button>
          {activePostId === post.id && <CommentThread postId={post.id} />}
        </article>
      ))}
    </Layout>
  );
}
