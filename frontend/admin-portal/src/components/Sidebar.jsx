import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Banknote, 
  Map, 
  Settings, 
  LogOut,
  Leaf,
  ChevronDown,
  ChevronRight,
  PieChart,
  TrendingUp,
  TrendingDown,
  Truck,
  UserCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Sidebar Navigation
 * 
 * A fixed-width vertical navigation column with a sleek dark mode theme.
 * Uses react-router-dom's NavLink to automatically handle active states.
 */
export default function Sidebar({ isOpen, onClose }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [isAccountingOpen, setIsAccountingOpen] = React.useState(true);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Customers', path: '/customers', icon: Users },
  ];

  const accountingSubItems = [
    { name: 'Analysis', path: '/accounting/analysis', icon: PieChart },
    { name: 'Income Ledger', path: '/accounting/income', icon: TrendingUp },
    { name: 'Expense Ledger', path: '/accounting/expense', icon: TrendingDown },
    { name: 'Vehicle Expenses', path: '/accounting/vehicle-expenses', icon: Truck },
    { name: 'Staff Salary', path: '/accounting/staff-salary', icon: UserCircle },
    { name: 'Bonus Fees', path: '/accounting/bonus-fees', icon: Banknote },
  ];

  const bottomNavItems = [
    { name: 'Fleet Map', path: '/fleet', icon: Map },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 z-30 md:hidden" 
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 h-screen border-r border-slate-800 text-slate-300 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 flex flex-col`}>
      
      {/* Brand Header */}
      <div className="flex items-center justify-center h-20 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-brand-500 p-2 rounded-lg">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold tracking-wider text-lg leading-tight">GODAWARI</h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-widest uppercase">Waste Mgmt</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-brand-600/10 text-brand-500 border border-brand-500/20'
                  : 'hover:bg-slate-800 hover:text-white border border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon 
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-brand-500' : 'text-slate-400 group-hover:text-white'
                  }`} 
                />
                {item.name}
              </>
            )}
          </NavLink>
        ))}

        {/* Accounting Accordion */}
        <div className="pt-2">
          <button
            onClick={() => setIsAccountingOpen(!isAccountingOpen)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <Banknote className="w-5 h-5" />
              Accounting
            </div>
            {isAccountingOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          
          {isAccountingOpen && (
            <div className="mt-2 space-y-1 pl-4 border-l-2 border-slate-800 ml-6">
              {accountingSubItems.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                      isActive
                        ? 'bg-brand-600/10 text-brand-500'
                        : 'hover:bg-slate-800 hover:text-white text-slate-400'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={`w-4 h-4 ${isActive ? 'text-brand-500' : 'text-slate-500 group-hover:text-slate-300'}`} />
                      {item.name}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {bottomNavItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-brand-600/10 text-brand-500 border border-brand-500/20'
                  : 'hover:bg-slate-800 hover:text-white border border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon 
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-brand-500' : 'text-slate-400 group-hover:text-white'
                  }`} 
                />
                {item.name}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* User Info & Logout (Bottom pinned) */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-sm">
            {user?.name?.charAt(0) || user?.username?.charAt(0) || 'A'}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{user?.name || user?.username}</p>
            <p className="text-xs text-slate-500 truncate capitalize">{user?.role?.toLowerCase() || 'Admin'}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-red-500/10 hover:text-red-500 text-slate-400 rounded-lg transition-colors border border-transparent hover:border-red-500/20 text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
    </>
  );
}
