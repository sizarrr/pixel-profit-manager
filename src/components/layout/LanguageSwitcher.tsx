
import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';

const LanguageSwitcher = () => {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ku' : 'en');
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-2"
    >
      <Languages className="w-4 h-4" />
      <span className="text-sm font-medium">
        {language === 'en' ? 'کوردی' : 'English'}
      </span>
    </Button>
  );
};

export default LanguageSwitcher;
