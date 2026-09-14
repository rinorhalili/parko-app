import { listPosts, type MobilePost } from "../api";

type Listener = () => void;
let posts: MobilePost[] = [];
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

export const communityStore = {
  getSnapshot: () => posts,
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  async refresh() {
    posts = await listPosts();
    notify();
  },
};
