
import React from 'react';
import { useStore } from '@/contexts/StoreContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Bell, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import LanguageSwitcher from './LanguageSwitcher';

const Header = () => {
  const { getLowStockProducts } = useStore();
  const { t } = useLanguage();
  
  const lowStockProducts = getLowStockProducts();
  const currentTime = new Date().toLocaleString();

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {t('welcome')} {t('store_pos')}!
            </h2>
            <p className="text-sm text-gray-500">{currentTime}</p>
          </div>
          
          <div className="flex items-center gap-4">
            {lowStockProducts.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-800">
                  {lowStockProducts.length} {t('items_low_stock')}
                </span>
                <Badge variant="secondary" className="bg-amber-200 text-amber-800">
                  {lowStockProducts.length}
                </Badge>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-gray-500" />
              {lowStockProducts.length > 0 && (
                <Badge className="bg-red-500">
                  {lowStockProducts.length}
                </Badge>
              )}
            </div>
            
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
