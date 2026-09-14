import en from "./en.json";
import sq from "./sq.json";

type Locale = "sq" | "en";
const dictionaries: Record<Locale, Record<string, string>> = { sq, en };
let activeLocale: Locale = "sq";

export function setLocale(locale: Locale) {
  activeLocale = locale;
}

export function getLocale() {
  return activeLocale;
}

export function t(key: string, values: Record<string, string | number> = {}) {
  const template = dictionaries[activeLocale][key] ?? dictionaries.en[key] ?? key;
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template,
  );
}
