function goHome() {
  window.history.pushState({}, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "support@parko.app";

export default function PrivacyPolicy() {
  return (
    <div className="screen settings-screen">
      <header className="settings-header">
        <a href="/" onClick={(event) => { event.preventDefault(); goHome(); }}>
          Kthehu
        </a>
        <div>
          <small>Parko</small>
          <h1>Politika e Privatësisë</h1>
          <p><em>Përditësuar më: 28 shtator 2026</em></p>
        </div>
      </header>
      <main className="settings-content">
        <section className="settings-section">
          <p>
            Kjo politikë shpjegon si Parko mbledh, përdor, ruan dhe ndan të dhënat kur kërkon parking, përdor hartën ose krijon përmbajtje në komunitet. Parko është shërbim për gjetjen dhe raportimin e parkingut në Prishtinë.
          </p>

          <h2>1. Të dhënat që përpunojmë</h2>
          <ul>
            <li><strong>Llogaria:</strong> emri, emri i përdoruesit dhe emaili. Për hyrjen me fjalëkalim ruajmë vetëm hash-in e fjalëkalimit, jo fjalëkalimin në tekst të lexueshëm.</li>
            <li><strong>Hyrja me Google:</strong> kur zgjedh Google, marrim identifikuesin unik të llogarisë Google, emailin e verifikuar, emrin dhe fotografinë e profilit nëse Google i ofron. Kredenciali i përkohshëm i Google verifikohet nga serveri ynë dhe nuk ruhet si token hyrjeje.</li>
            <li><strong>Profili dhe komuniteti:</strong> fotografia ose biografia që shton vetë, postimet, komentet, reagimet, fotografitë që ngarkon dhe raportimet e parkingut. Për raportimet mund të përpunohen koordinatat, gjendja, shënimi dhe koha; përmbajtja që publikon mund të shihet nga përdoruesit e tjerë.</li>
            <li><strong>Veprimet e llogarisë:</strong> parkingjet e ruajtura, të preferuarat, rezervimet dhe historiku i parkingut që zgjedh të përdorësh.</li>
            <li><strong>Lokacioni:</strong> vetëm pasi lejon lokacionin, pajisja mund ta përdorë vendndodhjen aktuale për hartën dhe udhëzimet. Koordinatat nuk dërgohen si raport pa veprimin tënd; kur kërkon rrugë, kërkimi mund t’i dërgojë ofruesit e hartës koordinatat e nisjes dhe destinacionit.</li>
            <li><strong>Siguria dhe pajisja:</strong> IP-ja dhe identifikuesi i shfletuesit/pajisjes mund të regjistrohen me sesionin për siguri dhe parandalim abuzimi. Nëse aktivizon njoftimet push, ruajmë tokenin teknik të pajisjes për dërgimin e tyre.</li>
            <li><strong>Diagnostika:</strong> aplikacioni mund të dërgojë llojin e gabimit, kohën, faqen dhe sinjale teknike të kufizuara. Ngjarjet e diagnostikës nuk përfshijnë koordinatat GPS apo tekstin që shkruan në kërkim; shfletuesi mund të ruajë përkohësisht radhën lokale të ngjarjeve.</li>
          </ul>

          <h2>2. Si i përdorim</h2>
          <ul>
            <li>Për të krijuar e mbrojtur llogarinë dhe për të ofruar hyrjen me email ose Google.</li>
            <li>Për të shfaqur parkingjet, për të trajtuar raportimet dhe për të mundësuar veçoritë e komunitetit që zgjedh.</li>
            <li>Për të ruajtur preferencat, rezervimet dhe historikun që kërkon.</li>
            <li>Për të dërguar njoftimet që aktivizon, për t’iu përgjigjur kërkesave dhe për të zgjidhur probleme teknike ose abuzime.</li>
          </ul>
          <p>Parko nuk shet të dhëna personale dhe nuk i përdor për reklama të personalizuara.</p>

          <h2>3. Shërbimet e tjera</h2>
          <p>Për funksionet përkatëse, pajisja ose serveri mund të komunikojë me këta ofrues. Kërkesat në internet zakonisht përmbajnë IP-në; kërkesat për hartë, kërkim ose rrugë mund të përmbajnë edhe vendin, tekstin ose koordinatat e nevojshme.</p>
          <ul>
            <li><strong>Google Identity Services:</strong> shfaq dhe përpunon hyrjen me Google. Google trajton të dhënat sipas <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Politikës së Privatësisë së Google</a>.</li>
            <li><strong>MapTiler, OpenStreetMap dhe CARTO:</strong> furnizojnë stilet, hartat ose pllakat e hartës, varësisht nga shtresa dhe konfigurimi.</li>
            <li><strong>Nominatim/Photon dhe OpenStreetMap:</strong> mund të përdoren për kërkimin ose kthimin e adresave.</li>
            <li><strong>OSRM dhe Valhalla:</strong> mund të përdoren për llogaritjen e rrugës dhe kohës së udhëtimit.</li>
            <li><strong>Ofruesit e hostimit dhe njoftimeve:</strong> përpunojnë kërkesat e serverit, bazën e të dhënave dhe njoftimet, vetëm për funksionimin e Parko-s.</li>
          </ul>
          <p>Këto shërbime nuk marrin fjalëkalimin e Parko-s. Të dhënat u dërgohen vetëm kur kërkohet funksioni përkatës.</p>

          <h2>4. Sesionet dhe ruajtja</h2>
          <p>Në web, sesioni përdor cookie HTTP-only për rifreskimin e hyrjes; në aplikacionin Android tokeni i rifreskimit ruhet në hapësirë të sigurt të pajisjes. Të dhënat ruhen sa kohë llogaria është aktive ose sa nevojiten për funksionimin, sigurinë dhe detyrimet ligjore. Raportet e disponueshmërisë mund të skadojnë automatikisht sepse gjendja e parkingut ndryshon.</p>

          <h2>5. Zgjedhjet dhe të drejtat e tua</h2>
          <ul>
            <li><strong>Lokacioni:</strong> mund ta refuzosh ose çaktivizosh nga cilësimet e pajisjes; harta mund të përdoret edhe pa GPS.</li>
            <li><strong>Njoftimet:</strong> mund t’i çaktivizosh nga cilësimet e shfletuesit ose pajisjes.</li>
            <li><strong>Qasja dhe korrigjimi:</strong> të dhënat e profilit mund t’i shohësh dhe përditësosh te Profili. Eksportin ose ndihmën për të dhënat mund ta kërkosh në adresën e kontaktit më poshtë.</li>
            <li><strong>Fshirja:</strong> mund ta nisësh nga Profili → Llogaria → Fshi llogarinë ose nga <a href="/delete-account">faqja e fshirjes së llogarisë</a>. Nëse nuk mund të hysh ose ke llogari vetëm me Google pa fjalëkalim Parko, na shkruaj nga emaili i regjistruar.</li>
          </ul>
          <p>Pas kërkesës së fshirjes, profili çaktivizohet dhe anonimizohen të dhënat e profilit; sesionet, të preferuarat dhe të dhënat e tjera të lidhura me llogarinë hiqen. Përmbajtje e komunitetit mund të mbahet në formë të anonimizuar kur nevojitet për sigurinë, moderimin ose detyrimet ligjore.</p>

          <h2>6. Fëmijët</h2>
          <p>Parko nuk synon fëmijët nën 13 vjeç dhe nuk mbledh me vetëdije të dhëna prej tyre. Nëse beson se një fëmijë ka krijuar llogari, kontakto adresën më poshtë.</p>

          <h2>7. Ndryshimet dhe kontakti</h2>
          <p>Kur ndryshon kjo politikë, përditësojmë datën e mësipërme. Për pyetje, kërkesa për qasje, korrigjim ose fshirje, kontakto: <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p>
        </section>
      </main>
    </div>
  );
}
