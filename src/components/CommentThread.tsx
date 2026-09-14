import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createComment, listComments } from "../api/communityService";
import type { CommunityComment } from "../api/types";
import { relativeTime } from "../utils/date";
import { EmptyState } from "./EmptyState";

export function CommentThread({ postId }: { postId: string }) {
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [content, setContent] = useState("");

  useEffect(() => {
    void listComments(postId).then(setComments).catch(() => setComments([]));
  }, [postId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const comment = await createComment(postId, content);
    setComments((current) => [...current, comment]);
    setContent("");
  }

  return (
    <section>
      {comments.length === 0 ? <EmptyState title="Ende pa komente" /> : comments.map((comment) => (
        <article className="parking-card" key={comment.id}>
          <div className="parking-card__content">
            <strong>{comment.author?.username ?? "Përdorues"}</strong>
            <small>{relativeTime(comment.createdAt)}</small>
            <p>{comment.content}</p>
          </div>
        </article>
      ))}
      <form className="profile-form" onSubmit={submit}>
        <label>Koment<textarea value={content} onChange={(event) => setContent(event.target.value)} required /></label>
        <button>Komento</button>
      </form>
    </section>
  );
}
