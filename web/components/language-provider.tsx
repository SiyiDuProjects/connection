'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import {
  defaultLanguage,
  normalizeLanguage,
  translate,
  type Language,
  type TranslationKey
} from '@/lib/i18n';

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  initialLanguage = defaultLanguage,
  children
}: {
  initialLanguage?: Language;
  children: React.ReactNode;
}) {
  const [language, setLanguageState] = useState<Language>(
    normalizeLanguage(initialLanguage)
  );

  const value = useMemo<LanguageContextValue>(() => {
    function setLanguage(nextLanguage: Language) {
      setLanguageState(nextLanguage);
      document.cookie = `language=${nextLanguage}; path=/; max-age=31536000; samesite=lax`;
    }

    return {
      language,
      setLanguage,
      t: (key, values) => translate(language, key, values)
    };
  }, [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n() {
  const value = useContext(LanguageContext);
  if (!value) {
    return {
      language: defaultLanguage,
      setLanguage: () => {},
      t: (key: TranslationKey, values?: Record<string, string | number>) =>
        translate(defaultLanguage, key, values)
    };
  }
  return value;
}
