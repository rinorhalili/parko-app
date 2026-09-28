function goHome() {
  window.history.pushState({}, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "support@parko.app";

export default function DeleteAccountPage() {
  return (
    <div className="screen settings-screen">
      <header className="settings-header">
        <a href="/" onClick={(event) => { event.preventDefault(); goHome(); }}>
          Kthehu
        </a>
        <div>
          <small>Parko</small>
          <h1>Fshirja e llogarisë</h1>
          <p>Fshirja e llogarisë dhe të dhënave personale</p>
        </div>
      </header>
      <main className="settings-content">
        <section className="settings-section">
          <h2>Fshije nga aplikacioni</h2>
          <ol>
            <li>Hyr në Parko.</li>
            <li>Hap Profilin.</li>
            <li>Zgjidh Llogaria → Fshi llogarinë.</li>
            <li>Konfirmo kërkesën në aplikacion.</li>
          </ol>
          <p><a className="login-button" href="/profile">Hyr dhe hape Profilin</a></p>

          <h2>Çfarë fshihet</h2>
          <p>Hiqen sesionet aktive, tokenët e verifikimit dhe rivendosjes, parkingjet e ruajtura, të preferuarat, rezervimet, historiku personal, reagimet, njoftimet dhe identifikuesit e pajisjeve për njoftime. Profili çaktivizohet dhe anonimizohen të dhënat publike të profilit.</p>

          <h2>Çfarë mund të ruhet</h2>
          <p>Disa të dhëna të komunitetit ose moderimit mund të mbahen në formë anonimizuar kur nevojiten për sigurinë, parandalimin e mashtrimit, detyrimet ligjore ose integritetin e diskutimeve.</p>

          <h2>Nuk mund të hysh?</h2>
          <p>Nëse nuk mund të hysh ose llogaria jote përdor vetëm Google dhe nuk ka fjalëkalim Parko, dërgo kërkesë për fshirje nga emaili i lidhur me llogarinë te <a href={`mailto:${supportEmail}?subject=Kërkesë për fshirjen e llogarisë Parko`}>{supportEmail}</a>.</p>
          <p><a href="/privacy">Lexo Politikën e Privatësisë</a></p>
        </section>
      </main>
    </div>
  );
}
