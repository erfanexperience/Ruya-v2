// useLanguage.js
// Global language state — English / Arabic + RTL management

import { useState, useEffect, useCallback } from 'react';

export function useLanguage() {
  const [language, setLanguage] = useState('en'); // 'en' | 'ar'

  const isArabic = language === 'ar';

  useEffect(() => {
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, isArabic]);

  const toggleLanguage = useCallback(() => {
    setLanguage(prev => (prev === 'en' ? 'ar' : 'en'));
  }, []);

  const t = useCallback(
    (en, ar) => (isArabic ? ar : en),
    [isArabic]
  );

  return { language, isArabic, toggleLanguage, t };
}
