function goHome() {
  window.history.pushState({}, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "support@parko.app";

export default function Terms() {
  return (
    <div className="screen settings-screen">
      <header className="settings-header">
        <a href="/" onClick={(event) => { event.preventDefault(); goHome(); }}>
          Kthehu
        </a>
        <div>
          <small>Parko</small>
          <h1>Kushtet e Përdorimit</h1>
          <p><em>Përditësuar më: 28 shtator 2026</em></p>
        </div>
      </header>
      <main className="settings-content">
        <section className="settings-section">
          <p>Këto kushte rregullojnë përdorimin e Parko-s, shërbimit që ndihmon në gjetjen dhe raportimin e parkingjeve në Prishtinë.</p>

          <h2>1. Pranimi i kushteve</h2>
          <p>Duke hyrë ose përdorur Parko-n, pajtohesh me këto kushte dhe me <a href="/privacy">Politikën e Privatësisë</a>. Nëse nuk pajtohesh, mos e përdor shërbimin.</p>

          <h2>2. Shërbimi Parko</h2>
          <p>Parko shfaq informacione për parkingjet, përfshirë raportime nga komuniteti. Informacioni është ndihmës dhe mund të jetë i pasaktë ose i vjetruar. Parko nuk garanton se një vendparkim do të jetë i lirë, i ligjshëm për përdorim ose i përshtatshëm kur të mbërrish. Veçoritë e rezervimit, kur ofrohen, vlejnë vetëm sipas konfirmimit dhe kushteve të paraqitura për atë vend.</p>

          <h2>3. Llogaria dhe siguria</h2>
          <p>Jep të dhëna të sakta dhe ruaji të sigurta kredencialet e llogarisë. Je përgjegjës për veprimet e kryera përmes llogarisë sate. Na njofto nëse dyshon se dikush e ka përdorur pa leje.</p>

          <h2>4. Përmbajtja e komunitetit</h2>
          <p>Je përgjegjës për raportimet, fotografitë, postimet, komentet dhe përmbajtjet e tjera që publikon. Përmbajtja duhet të jetë e ligjshme, e saktë dhe respektuese. Mos publiko ngacmime, kërcënime, gjuhë urrejtjeje, mashtrime, spam, imitim të personave të tjerë ose të dhëna personale pa leje.</p>
          <p>Parko mund të shqyrtojë, kufizojë ose heqë përmbajtjen që shkel këto kushte. Shkeljet e përsëritura ose serioze mund të çojnë në pezullimin e llogarisë. Përdor funksionet Raporto dhe Blloko kur has përmbajtje ose sjellje të papërshtatshme.</p>

          <h2>5. Përdorimi i ndaluar</h2>
          <p>Nuk lejohet keqpërdorimi i shërbimit, ndërhyrja në funksionimin e tij, qasja e paautorizuar, mbledhja automatike e të dhënave pa leje, mbingarkimi i sistemit, imitimi i një personi tjetër ose përdorimi për veprimtari të paligjshme.</p>

          <h2>6. Vendimet për parkim</h2>
          <p>Para parkimit, kontrollo vetë tabelat, rregullat lokale, tarifat, kufizimet e qasjes dhe sigurinë. Ti je përgjegjës për vendimin ku parkon dhe për pasojat që lidhen me të. Mos u mbështet vetëm në disponueshmërinë e raportuar në Parko.</p>

          <h2>7. Disponueshmëria dhe garancitë</h2>
          <p>Parko ofrohet sipas gjendjes së momentit dhe mund të ndërpritet ose të përmbajë gabime. Në masën e lejuar nga ligji, nuk garantojmë që informacioni të jetë i plotë, i saktë, aktual ose pa ndërprerje.</p>

          <h2>8. Përgjegjësia</h2>
          <p>Në masën e lejuar nga ligji, Parko nuk mban përgjegjësi për dëme të tërthorta ose pasojat e vendimeve të parkimit të marra duke u bazuar në informacionin e shërbimit.</p>

          <h2>9. Ligji i zbatueshëm</h2>
          <p>Këto kushte interpretohen sipas ligjeve të Kosovës. Mosmarrëveshjet trajtohen nga gjykatat kompetente të Kosovës.</p>

          <h2>10. Ndryshimet dhe kontakti</h2>
          <p>Mund t’i përditësojmë këto kushte; versioni aktual do të shfaqë datën e përditësimit. Për pyetje, na shkruaj në <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p>
        </section>
      </main>
    </div>
  );
}
