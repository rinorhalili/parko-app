function goHome() {
  window.history.pushState({}, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "support@parko.app";

export default function DeleteAccountPage() {
  return (
    <div className="screen settings-screen">
      <header className="settings-header">
        <button type="button" onClick={goHome}>Back</button>
        <div>
          <small>Parko</small>
          <h1>Delete your Parko account</h1>
          <p>Permanent account and personal-data deletion</p>
        </div>
      </header>
      <main className="settings-content">
        <section className="settings-section">
          <h2>Delete in the app or web app</h2>
          <ol>
            <li>Sign in to Parko.</li>
            <li>Open Profile.</li>
            <li>Choose Account → Delete account.</li>
            <li>Confirm with your current password.</li>
          </ol>
          <p><a className="login-button" href="/profile">Sign in and open Profile</a></p>

          <h2>What is deleted</h2>
          <p>Your active sessions, verification/reset tokens, saved parking, favorites, reservations, parking history, reactions, notifications, and push-device identifiers are deleted. Your profile is deactivated and anonymized.</p>

          <h2>What may be retained</h2>
          <p>Community or moderation records may be retained in anonymized form where needed for safety, fraud prevention, legal compliance, or the integrity of discussions. They will no longer identify you publicly.</p>

          <h2>Need help?</h2>
          <p>Email <a href={`mailto:${supportEmail}?subject=Parko account deletion request`}>{supportEmail}</a> from the address registered to your Parko account.</p>
        </section>
      </main>
    </div>
  );
}
