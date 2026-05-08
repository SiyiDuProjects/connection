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
  languageMode: 'browser' | 'manual';
  setLanguage: (language: Language) => void;
  useBrowserLanguage: () => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  initialLanguage = defaultLanguage,
  initialLanguageMode = 'browser',
  children
}: {
  initialLanguage?: Language;
  initialLanguageMode?: 'browser' | 'manual';
  children: React.ReactNode;
}) {
  const [language, setLanguageState] = useState<Language>(
    normalizeLanguage(initialLanguage)
  );
  const [languageMode, setLanguageMode] = useState<'browser' | 'manual'>(initialLanguageMode);

  useEffect(() => {
    if (hasLanguageCookie()) return;

    const browserLanguage = normalizeLanguage(window.navigator.language);
    setLanguageMode('browser');
    setLanguageState(browserLanguage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    sendExtensionBridgeMessage({
      type: 'SET_EXTENSION_LANGUAGE',
      payload: { language }
    }).catch(() => {});
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => {
    function setLanguage(nextLanguage: Language) {
      const normalizedLanguage = normalizeLanguage(nextLanguage);
      setLanguageMode('manual');
      setLanguageState(normalizedLanguage);
      document.cookie = `language=${normalizedLanguage}; path=/; max-age=31536000; samesite=lax`;
    }

    function useBrowserLanguage() {
      const browserLanguage = normalizeLanguage(window.navigator.language);
      setLanguageMode('browser');
      setLanguageState(browserLanguage);
      document.cookie = 'language=; path=/; max-age=0; samesite=lax';
    }

    return {
      language,
      languageMode,
      setLanguage,
      useBrowserLanguage,
      t: (key, values) => translate(language, key, values)
    };
  }, [language, languageMode]);

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
      languageMode: 'browser' as const,
      setLanguage: () => {},
      useBrowserLanguage: () => {},
      t: (key: TranslationKey, values?: Record<string, string | number>) =>
        translate(defaultLanguage, key, values)
    };
  }
  return value;
}

function hasLanguageCookie() {
  return document.cookie
    .split('; ')
    .some((row) => row.startsWith('language='));
}
