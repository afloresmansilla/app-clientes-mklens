import { createI18n } from "vue-i18n";
import es from "./es";
import en from "./en";
import pt from "./pt";
import fr from "./fr";
import it from "./it";

export const LOCALES = [
  { id: "es", short: "ES" },
  { id: "en", short: "EN" },
  { id: "pt", short: "PT" },
  { id: "fr", short: "FR" },
  { id: "it", short: "IT" },
];

const STORAGE_KEY = "mklens.locale";
const supported = LOCALES.map((item) => item.id);

function detectLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (supported.includes(saved)) return saved;
  } catch (_e) {
    /* ignore */
  }
  const nav = String(typeof navigator !== "undefined" ? navigator.language : "es")
    .slice(0, 2)
    .toLowerCase();
  return supported.includes(nav) ? nav : "es";
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: "es",
  messages: { es, en, pt, fr, it },
});

export function currentLocale() {
  return i18n.global.locale.value;
}

export function setLocale(locale) {
  if (!supported.includes(locale)) return;
  i18n.global.locale.value = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch (_e) {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
    document.title = i18n.global.t("meta.title");
  }
}

export function labelOf(t, te, prefix, value) {
  if (value == null || value === "") return "";
  const key = prefix + "." + value;
  return te(key) ? t(key) : String(value);
}

export function planNameOf(t, te, code, fallback) {
  if (!code) return fallback || "";
  const key = "plans." + code + ".name";
  return te(key) ? t(key) : fallback || String(code);
}

export function planBlurbOf(t, te, code, fallback) {
  if (!code) return fallback || "";
  const key = "plans." + code + ".blurb";
  return te(key) ? t(key) : fallback || "";
}

export function apiMessage(t, te, err, fallbackKey) {
  if (err && err.code && te("errors." + err.code)) return t("errors." + err.code);
  return t(fallbackKey || "errors.generic");
}

if (typeof document !== "undefined") {
  document.documentElement.lang = detectLocale();
  document.title = i18n.global.t("meta.title");
}
