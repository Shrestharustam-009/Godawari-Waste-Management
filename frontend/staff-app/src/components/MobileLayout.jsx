import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Search, List, User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MobileLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItemClass = ({ isActive }) => 
    `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
      isActive ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
    }`;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-xs font-black text-white tracking-tighter">GW</span>
          </div>
          <span className="font-bold text-slate-900">Godawari Waste</span>
        </div>
        <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 pb-16 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 px-6 pb-safe z-20">
        <div className="flex justify-between h-full max-w-md mx-auto">
          <NavLink to="/" className={navItemClass}>
            <Search className="w-6 h-6" />
            <span className="text-[10px] font-semibold">Search</span>
          </NavLink>
          <NavLink to="/recent" className={navItemClass}>
            <List className="w-6 h-6" />
            <span className="text-[10px] font-semibold">Recent</span>
          </NavLink>
          <NavLink to="/profile" className={navItemClass}>
            <User className="w-6 h-6" />
            <span className="text-[10px] font-semibold">Profile</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
