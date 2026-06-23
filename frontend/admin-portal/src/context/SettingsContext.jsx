import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';
import { toBS } from '@zener/nepali-datepicker-react';

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({ calendarType: 'AD' });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth(); // fetch settings when user is logged in

  const fetchSettings = async () => {
    try {
      const res = await api.get('/system/settings');
      if (res.data?.success && res.data.data) {
        setSettings(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [user]);

  const refreshSettings = () => fetchSettings();

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const dateObj = new Date(dateString);
    if (isNaN(dateObj)) return dateString;

    if (settings?.calendarType === 'BS') {
      try {
        const adStr = dateObj.toISOString().split('T')[0];
        const bsObj = toBS(adStr);
        return `${bsObj.year}-${String(bsObj.month + 1).padStart(2, '0')}-${String(bsObj.date).padStart(2, '0')} (BS)`;
      } catch (e) {
        return dateObj.toLocaleDateString('en-IN');
      }
    }
    return dateObj.toLocaleDateString('en-IN');
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings, formatDate }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
