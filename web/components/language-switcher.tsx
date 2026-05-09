'use client';

import { Languages } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/language-provider';

export function LanguageSwitcher() {
  const router = useRouter();
  const { language, setLanguage, t } = useI18n();

  function toggleLanguage() {
    setLanguage(language === 'en' ? 'zh' : 'en');
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="px-4"
      onClick={toggleLanguage}
      aria-label="Switch language"
    >
      <Languages className="h-4 w-4" />
      <span className="ml-2 text-sm">{t('language.switchTo')}</span>
    </Button>
  );
}
