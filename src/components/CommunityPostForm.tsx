import { useState } from "react";
import type { FormEvent } from "react";
import { createPost } from "../api/communityService";
import type { CommunityPost } from "../api/types";

export function CommunityPostForm({ onCreated }: { onCreated?: (post: CommunityPost) => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const post = await createPost({ title, content });
      setTitle("");
      setContent("");
      onCreated?.(post);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="profile-form" onSubmit={submit}>
      <label>Titulli<input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} /></label>
      <label>Përmbajtja<textarea value={content} onChange={(event) => setContent(event.target.value)} required minLength={3} /></label>
      <button disabled={submitting}>{submitting ? "Duke postuar..." : "Posto"}</button>
    </form>
  );
}
