import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import en from "../locales/en.json"
import es from "../locales/es.json"
import zh from "../locales/zh.json"
import hi from "../locales/hi.json"

export const supportedLanguages = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "zh", label: "中文" },
  { code: "hi", label: "हिन्दी" },
] as const

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      zh: { translation: zh },
      hi: { translation: hi },
    },
    fallbackLng: "en",
    // Browsers report regional variants like "en-US" — strip the region so
    // it matches our plain "en"/"es"/"zh"/"hi" resource keys instead of
    // silently falling back to English for every regional variant.
    load: "languageOnly",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "glucoguide_lang",
      caches: ["localStorage"],
    },
  })

export default i18n
