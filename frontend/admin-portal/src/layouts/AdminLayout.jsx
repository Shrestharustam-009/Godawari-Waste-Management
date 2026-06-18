import React, { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { io } from 'socket.io-client';
import toast, { Toaster } from 'react-hot-toast';
import { UserCircle, AlertTriangle, Menu } from 'lucide-react';
import AlertCenter from '../components/AlertCenter';
import { DateProvider, useDate } from '../context/DateContext';

function ADBSButton() {
  const { isBS, toggleCalendarFormat } = useDate();
  return (
    <button
      onClick={toggleCalendarFormat}
      className="px-3 py-1 bg-gray-100 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors text-gray-700"
    >
      {isBS ? 'BS' : 'AD'}
    </button>
  );
}

/**
 * AdminLayout
 * 
 * The main structural shell of the application. Renders the Sidebar on the left
 * and provides a dynamic, scrolling container on the right for the main content (<Outlet />).
 * Includes the Live Notification Engine (Bell + Dropdown + Toasts).
 */
export default function AdminLayout() {
  const [alerts, setAlerts] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Socket.IO Listener for Real-time Alerts
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000', {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('[AdminLayout] Connected to Live Notification Engine');
      socket.emit('join_admin'); // Optional: Join explicit admin room if needed, or backend relies on standard emit
    });

    socket.on('system_alert', (payload) => {
      // Add to unread list
      setAlerts((prev) => [payload, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Fire a live toast
      if (payload.type === 'LOGIN') {
        toast.custom(
          (t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-xl rounded-xl pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
              <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-0.5">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <UserCircle className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-bold text-slate-900">System Login</p>
                    <p className="mt-1 text-sm text-slate-500">{payload.message}</p>
                  </div>
                </div>
              </div>
              <div className="flex border-l border-slate-200">
                <button onClick={() => toast.dismiss(t.id)} className="w-full border border-transparent rounded-none rounded-r-xl p-4 flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none">Close</button>
              </div>
            </div>
          ),
          { duration: 4000 }
        );
      } else if (payload.type === 'FINANCIAL_WARNING') {
        toast.custom(
          (t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-xl rounded-xl pointer-events-auto flex ring-1 ring-red-500 ring-opacity-20 border-l-4 border-l-red-500`}>
              <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-0.5">
                    <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-bold text-red-700">Financial Warning</p>
                    <p className="mt-1 text-sm text-red-600 font-medium">{payload.message}</p>
                  </div>
                </div>
              </div>
              <div className="flex border-l border-slate-100">
                <button onClick={() => toast.dismiss(t.id)} className="w-full border border-transparent rounded-none rounded-r-xl p-4 flex items-center justify-center text-sm font-medium text-slate-500 hover:text-slate-600 focus:outline-none">Dismiss</button>
              </div>
            </div>
          ),
          { duration: 6000 }
        );
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Handle Bell Click
  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
    if (!showDropdown) {
      // Mark as read when opening
      setUnreadCount(0);
    }
  };

  return (
    <DateProvider>
      <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
        <Toaster position="top-right" />
      
      {/* Fixed Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Global Top Header */}
        <header className="flex items-center justify-between md:justify-end px-6 py-4 bg-white shadow-sm z-20 border-b border-gray-100 shrink-0">
          
          {/* Mobile Hamburger Menu (Hidden on Desktop) */}
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg focus:outline-none"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Right-aligned Navigation Items */}
          <div className="flex items-center gap-6">
            
            {/* AD / BS Toggle */}
            <ADBSButton />

            {/* Notification Bell & Dropdown */}
            <AlertCenter 
              alerts={alerts}
              unreadCount={unreadCount}
              showDropdown={showDropdown}
              toggleDropdown={toggleDropdown}
              dropdownRef={dropdownRef}
            />

            {/* User Profile Placeholder */}
            <button className="flex items-center gap-2 focus:outline-none">
              <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                <span className="text-sm font-bold text-emerald-700">A</span>
              </div>
            </button>

          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 w-full">
          <Outlet />
        </main>
      </div>
      </div>
    </DateProvider>
  );
}
