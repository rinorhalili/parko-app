const webOrigin = (import.meta.env.VITE_WEB_ORIGIN || "").replace(/\/$/, "");

/**
 * The browser build can use same-origin proxy paths. The installed Android app
 * runs from https://localhost, so those paths must point at the hosted Parko web
 * service instead.
 */
export function proxyUrl(path: string) {
  if (!path.startsWith("/")) throw new Error("Proxy paths must start with '/'.");
  return webOrigin ? `${webOrigin}${path}` : path;
}
