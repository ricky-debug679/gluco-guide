import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import en from "../locales/en.json"
import es from "../locales/es.json"
import zh from "../locales/zh.json"
import hi from "../locales/hi.json"

// Everything but `englishName` is written in the language itself, so the
// first-launch picker is readable before anyone has chosen a language.
export const supportedLanguages = [
  { code: "en", label: "English", englishName: "English", hello: "Hello", welcome: "Welcome", choose: "Choose your language", suggested: "Suggested" },
  { code: "es", label: "Español", englishName: "Spanish", hello: "Hola", welcome: "Bienvenido", choose: "Elige tu idioma", suggested: "Sugerido" },
  { code: "zh", label: "中文", englishName: "Chinese", hello: "你好", welcome: "欢迎", choose: "选择你的语言", suggested: "推荐" },
  { code: "hi", label: "हिन्दी", englishName: "Hindi", hello: "नमस्ते", welcome: "स्वागत है", choose: "अपनी भाषा चुनें", suggested: "सुझाव" },
] as const

// Set once a person picks a language themselves; the detector's own cache
// can't tell a real choice from the phone's guess.
const LANGUAGE_CHOSEN_KEY = "glucoguide_lang_chosen"

export function hasChosenLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_CHOSEN_KEY) === "1"
  } catch {
    return true
  }
}

export function chooseLanguage(code: string) {
  void i18n.changeLanguage(code)
  try {
    localStorage.setItem(LANGUAGE_CHOSEN_KEY, "1")
  } catch {
    // Storage blocked: the language still applies for this visit.
  }
}

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
