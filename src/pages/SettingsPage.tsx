import { useState } from "react";
import { getLocale, setLocale } from "../i18n";
import { Layout } from "../components/Layout";
import { readStorage, writeStorage } from "../utils/storage";

export default function SettingsPage() {
  const [locale, setLocalLocale] = useState(getLocale());
  const [showDataSources, setShowDataSources] = useState(() => readStorage("parko:show-data-sources", true));

  return (
    <Layout title="Cilësimet">
      <section className="settings-section">
        <h2>Preferencat</h2>
        <label>Gjuha
          <select value={locale} onChange={(event) => { const next = event.target.value as "sq" | "en"; setLocale(next); setLocalLocale(next); }}>
            <option value="sq">Shqip</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={showDataSources}
            onChange={(event) => {
              setShowDataSources(event.target.checked);
              writeStorage("parko:show-data-sources", event.target.checked);
            }}
          />
          Shfaq burimet e të dhënave
        </label>
      </section>
    </Layout>
  );
}
