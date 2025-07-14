
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  Monitor
} from 'lucide-react';

const Sidebar = () => {
  const { t } = useLanguage();

  const navigation = [
    { name: t('dashboard'), href: '/', icon: LayoutDashboard, current: true },
    { name: t('products'), href: '/products', icon: Package, current: false },
    { name: t('sales'), href: '/sales', icon: ShoppingCart, current: false },
    { name: t('reports'), href: '/reports', icon: BarChart3, current: false },
  ];

  return (
    <div className="flex h-full w-64 flex-col bg-white shadow-lg">
      <div className="flex h-16 shrink-0 items-center px-6 border-b">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Monitor className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{t('store_pos')}</h1>
          </div>
        </div>
      </div>
      
      <nav className="flex flex-1 flex-col px-6 py-6">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {navigation.map((item) => (
                <li key={item.name}>
                  <NavLink
                    to={item.href}
                    className={({ isActive }) =>
                      cn(
                        isActive
                          ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                          : 'text-gray-700 hover:text-blue-700 hover:bg-blue-50',
                        'group flex gap-x-3 rounded-md p-3 text-sm leading-6 font-medium transition-colors'
                      )
                    }
                  >
                    <item.icon
                      className="h-5 w-5 shrink-0"
                      aria-hidden="true"
                    />
                    {item.name}
                  </NavLink>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
