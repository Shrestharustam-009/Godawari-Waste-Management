import React, { createContext, useContext, useState } from 'react';
import NepaliDate from 'nepali-date-converter';

import { useSettings } from './SettingsContext';
import { toBS } from '@zener/nepali-datepicker-react';

const DateContext = createContext();

export function DateProvider({ children }) {
  const { settings } = useSettings();
  const isBS = settings?.calendarType === 'BS';

  const toggleCalendarFormat = () => {
    // Left for backwards compatibility, but it should ideally call the settings API
    console.warn("toggleCalendarFormat is deprecated. Use global settings instead.");
  };

  const formatSystemDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    if (isBS) {
      try {
        const adStr = date.toISOString().split('T')[0];
        const bsObj = toBS(adStr);
        const bsDateStr = `${bsObj.year}-${String(bsObj.month + 1).padStart(2, '0')}-${String(bsObj.date).padStart(2, '0')} (BS)`;
        return bsDateStr + ' ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      } catch (err) {
        console.error('Nepali date conversion failed:', err);
        return date.toLocaleString('en-US');
      }
    }
    
    // Standard AD format
    return date.toLocaleString('en-US', { 
      year: 'numeric', month: 'short', day: 'numeric', 
      hour: 'numeric', minute: '2-digit', hour12: true 
    });
  };

  return (
    <DateContext.Provider value={{ isBS, toggleCalendarFormat, formatSystemDate }}>
      {children}
    </DateContext.Provider>
  );
}

export function useDate() {
  return useContext(DateContext);
}
