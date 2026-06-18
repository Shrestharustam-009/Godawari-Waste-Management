import React from 'react';
import { Bell, UserCircle, AlertTriangle, Info, Clock } from 'lucide-react';

export default function AlertCenter({
  alerts,
  unreadCount,
  showDropdown,
  toggleDropdown,
  dropdownRef
}) {
  // Time formatter
  const timeAgo = (dateStr) => {
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors focus:outline-none"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-in zoom-in">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-2xl border border-gray-100 z-50 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">Alert Center</h3>
            <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
              {alerts.length} Total
            </span>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm font-medium">No new notifications</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {alerts.map((alert, idx) => {
                  const isAuth = alert.type === 'LOGIN';
                  const isWarning = alert.type === 'FINANCIAL_WARNING';
                  const bgTint = isAuth ? 'bg-blue-50' : isWarning ? 'bg-red-50' : 'bg-white';

                  return (
                    <div
                      key={idx}
                      className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors flex gap-3 ${bgTint} ${
                        idx < unreadCount ? 'opacity-100' : 'opacity-80'
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {isAuth ? (
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <UserCircle className="w-5 h-5 text-blue-600" />
                          </div>
                        ) : isWarning ? (
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <Info className="w-5 h-5 text-gray-600" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider mb-0.5 text-gray-500">
                          {alert.type.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-gray-800 font-medium leading-snug">
                          {alert.message}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1.5 flex items-center">
                          <Clock className="w-3 h-3 mr-1" /> {timeAgo(alert.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
