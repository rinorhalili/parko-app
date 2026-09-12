function goHome() {
  window.history.pushState({}, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function NotFound() {
  return (
    <div className="screen settings-screen">
      <header className="settings-header">
        <a
          href="/"
          onClick={(event) => {
            event.preventDefault();
            goHome();
          }}
        >
          Kthehu te harta
        </a>
        <div>
          <small>Parko</small>
          <h1>Faqja nuk u gjet</h1>
          <p>Adresa që kërkove nuk ekziston ose është zhvendosur.</p>
        </div>
      </header>
      <main className="settings-content">
        <section className="settings-section">
          <p>
            Mund të kthehesh te harta për të vazhduar kërkimin për parking në
            Prishtinë.
          </p>
          <button
            type="button"
            className="settings-login-button"
            onClick={goHome}
          >
            Shko te harta
          </button>
        </section>
      </main>
    </div>
  );
}
