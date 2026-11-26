import React, { createContext, useContext, useState } from 'react';

export type Lang = 'ne' | 'en';

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (ne: string, en: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('ne');

  const toggleLang = () => setLang((prev) => (prev === 'ne' ? 'en' : 'ne'));
  const t = (ne: string, en: string) => (lang === 'ne' ? ne : en);

  return (
    <I18nContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
