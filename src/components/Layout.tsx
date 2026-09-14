import type { ReactNode } from "react";
import { NotificationBell } from "./NotificationBell";

const links = [
  ["/", "Harta"],
  ["/community", "Komuniteti"],
  ["/favorites", "Të ruajtura"],
  ["/profile", "Profili"],
  ["/settings", "Cilësimet"],
] as const;

export function Layout({ children, title = "Parko" }: { children: ReactNode; title?: string }) {
  return (
    <div className="app-shell">
      <main className="phone-frame">
        <section className="screen saved-screen">
          <header className="saved-header">
            <div>
              <h1>{title}</h1>
              <p>Parking në Prishtinë, i ndihmuar nga komuniteti.</p>
            </div>
            <NotificationBell />
          </header>
          <div className="saved-list">{children}</div>
          <nav className="bottom-nav" aria-label="Navigimi kryesor">
            {links.map(([href, label]) => (
              <a className="bottom-nav__item" href={href} key={href}>{label}</a>
            ))}
          </nav>
        </section>
      </main>
    </div>
  );
}
