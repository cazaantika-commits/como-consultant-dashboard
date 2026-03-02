/**
 * Internationalization utility for Replit-integrated pages
 */

import { useContext, createContext } from "react";

export type Language = "ar" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    // Default to Arabic if context not available
    return {
      language: "ar",
      setLanguage: () => {},
      isRTL: true,
    };
  }
  return context;
}

export function getLanguageContext(language: Language = "ar"): LanguageContextType {
  return {
    language,
    setLanguage: () => {},
    isRTL: language === "ar",
  };
}

/**
 * Translate a key to Arabic or English
 */
export function translate(key: string, language: Language = "ar"): string {
  const translations: Record<string, Record<Language, string>> = {
    "cash_flow": { ar: "التدفق النقدي", en: "Cash Flow" },
    "development_stages": { ar: "مراحل التطوير", en: "Development Stages" },
    "project_lifecycle": { ar: "دورة حياة المشروع", en: "Project Lifecycle" },
    "feasibility_study": { ar: "دراسة الجدوى", en: "Feasibility Study" },
  };

  return translations[key]?.[language] || key;
}
