'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { sendExtensionBridgeMessage } from '@/components/extension-session-bridge';
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

  useEffect(() => {
    sendExtensionBridgeMessage({
      type: 'SET_EXTENSION_LANGUAGE',
      payload: { language }
    }).catch(() => {});
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => {
    function setLanguage(nextLanguage: Language) {
      const normalizedLanguage = normalizeLanguage(nextLanguage);
      setLanguageState(normalizedLanguage);
      document.cookie = `language=${normalizedLanguage}; path=/; max-age=31536000; samesite=lax`;
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
