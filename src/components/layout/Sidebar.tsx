
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  Users, 
  LogOut,
  Monitor
} from 'lucide-react';

const Sidebar = () => {
  const { user, logout, isAdmin } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, current: true },
    { name: 'Products', href: '/products', icon: Package, current: false },
    { name: 'Sales', href: '/sales', icon: ShoppingCart, current: false },
    { name: 'Reports', href: '/reports', icon: BarChart3, current: false },
    ...(isAdmin() ? [{ name: 'Users', href: '/users', icon: Users, current: false }] : []),
  ];

  return (
    <div className="flex h-full w-64 flex-col bg-white shadow-lg">
      <div className="flex h-16 shrink-0 items-center px-6 border-b">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Monitor className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Store POS</h1>
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
          
          <li className="mt-auto">
            <div className="px-3 py-4 border-t">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                </div>
              </div>
              
              <button
                onClick={logout}
                className="flex w-full items-center gap-x-3 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
