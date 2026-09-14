import { clearSession, getAccessToken, login, logout, register, restoreToken } from "../api";

type Listener = () => void;
let authenticated = false;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

export const authStore = {
  getSnapshot: () => ({ authenticated, accessToken: getAccessToken() }),
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  async restore() {
    authenticated = Boolean(await restoreToken());
    notify();
  },
  async login(email: string, password: string) {
    await login(email, password);
    authenticated = true;
    notify();
  },
  async register(input: { name: string; username: string; email: string; password: string }) {
    await register(input);
    authenticated = true;
    notify();
  },
  async logout() {
    await logout();
    authenticated = false;
    notify();
  },
  async clear() {
    await clearSession();
    authenticated = false;
    notify();
  },
};
