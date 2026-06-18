import React, { createContext, useContext, useState } from 'react';
import NepaliDate from 'nepali-date-converter';

const DateContext = createContext();

export function DateProvider({ children }) {
  const [isBS, setIsBS] = useState(false);

  const toggleCalendarFormat = () => setIsBS((prev) => !prev);

  const formatSystemDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    if (isBS) {
      try {
        const bsDate = new NepaliDate(date);
        // Returns e.g. "2083-03-04 15:42"
        return bsDate.format('YYYY-MM-DD') + ' ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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
