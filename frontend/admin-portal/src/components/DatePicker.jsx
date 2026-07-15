import React from 'react';
import NepaliDatePicker, { toBS, toAD } from '@zener/nepali-datepicker-react';
import '@zener/nepali-datepicker-react/index.css';
import { useSettings } from '../context/SettingsContext';

/**
 * A unified DatePicker that renders either an HTML5 date input (AD)
 * or a Nepali Date Picker (BS) based on global settings.
 * 
 * @param {string} value - The date string in AD format (YYYY-MM-DD).
 * @param {function} onChange - Standard onChange handler expecting an event: `e.target.value`.
 * @param {string} name - Name attribute for the input.
 * @param {string} className - Tailwind CSS classes for styling.
 * @param {boolean} required - HTML5 required attribute.
 */
export default function DatePicker({ value, onChange, name, className, required }) {
  const { settings } = useSettings();
  const isBS = settings?.calendarType === 'BS';

  if (!isBS) {
    // AD Mode: Standard HTML5 Input
    return (
      <input
        type="date"
        name={name}
        value={value || ''}
        onChange={onChange}
        className={`${className} bg-transparent text-slate-900 dark:text-white`}
        required={required}
      />
    );
  }

  // BS Mode: Convert AD value to BS string
  let bsValue = '';
  if (value) {
    try {
      const bsObj = toBS(value); // expects YYYY-MM-DD AD string
      bsValue = `${bsObj.year}-${String(bsObj.month + 1).padStart(2, '0')}-${String(bsObj.date).padStart(2, '0')}`;
    } catch (e) {
      console.warn("Invalid AD date passed to toBS:", value);
    }
  }

  const nepaliToEnglish = (str) => {
    const ne = ['०','१','२','३','४','५','६','७','८','९'];
    let res = '';
    for (let char of str) {
      const i = ne.indexOf(char);
      res += (i !== -1) ? i : char;
    }
    return res;
  };

  const handleBSChange = (newBsValue) => {
    // newBsValue is e.g. "2078-10-15" or "२०७८-१०-१५"
    if (!newBsValue) {
      onChange({ target: { name, value: '' } });
      return;
    }
    try {
      const englishBsValue = nepaliToEnglish(newBsValue);
      const adObj = toAD(englishBsValue);
      const adStr = `${adObj.year}-${String(adObj.month + 1).padStart(2, '0')}-${String(adObj.date).padStart(2, '0')}`;
      onChange({ target: { name, value: adStr } });
    } catch (e) {
      console.warn("Invalid BS date passed to toAD:", newBsValue);
    }
  };

  return (
    <div className={`relative ${className} p-0 flex items-center z-10`}>
      <NepaliDatePicker
        value={bsValue}
        onChange={handleBSChange}
        options={{
          calenderLocale: 'ne',
          valueLocale: 'en'
        }}
        className="w-full h-full outline-none bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-white"
      />
    </div>
  );
}
