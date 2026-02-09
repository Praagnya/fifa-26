import { useState, useEffect } from 'react';

export interface TimeZoneInfo {
  timezone: string;
  offset: number;
  offsetHours: string;
  isUTC: boolean;
}

export function useTimeZone() {
  const [timeZoneInfo, setTimeZoneInfo] = useState<TimeZoneInfo>(() => {
    // Initial detection from browser
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const utcOffset = now.getTimezoneOffset();
    const offsetHours = Math.abs(utcOffset / 60);
    const offsetSign = utcOffset <= 0 ? '+' : '-';
    
    return {
      timezone: tz,
      offset: utcOffset,
      offsetHours: `${offsetSign}${offsetHours.toString().padStart(2, '0')}:00`,
      isUTC: tz === 'UTC'
    };
  });

  const [userTimeZone, setUserTimeZone] = useState<string>(() => {
    // Check localStorage first, then use browser timezone
    return localStorage.getItem('userTimezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
  });

  // Update localStorage and re-calculate when timezone changes
  const updateTimeZone = (timezone: string) => {
    localStorage.setItem('userTimezone', timezone);
    setUserTimeZone(timezone);
    
    // Recalculate offset for new timezone
    try {
      // Calculate offset
      const tempDate = new Date();
      const utcTime = tempDate.getTime();
      const tzTime = new Date(tempDate.toLocaleString("en-US", {timeZone: timezone})).getTime();
      const offset = (utcTime - tzTime) / (1000 * 60 * 60);
      const offsetSign = offset <= 0 ? '+' : '-';
      const offsetHours = Math.abs(offset).toString().padStart(2, '0');
      
      setTimeZoneInfo({
        timezone,
        offset: offset * 60, // convert back to minutes
        offsetHours: `${offsetSign}${offsetHours}:00`,
        isUTC: timezone === 'UTC'
      });
    } catch (error) {
      console.error('Error setting timezone:', error);
    }
  };

  // Detect timezone on mount
  useEffect(() => {
    updateTimeZone(userTimeZone);
  }, []);

  return {
    userTimeZone,
    timeZoneInfo,
    updateTimeZone,
    availableTimezones: [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Australia/Sydney',
      'America/Sao_Paulo',
      'America/Mexico_City',
      'Europe/Moscow',
      'Asia/Dubai',
      'Asia/Singapore',
    ]
  };
}

export function formatTimeInTimeZone(isoString: string, timeZone: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (error) {
    // Fallback to local time if timezone is invalid
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }
}

export function formatDateInTimeZone(isoString: string, timeZone: string): string {
  try {
    return new Date(isoString).toLocaleDateString('en-US', {
      timeZone,
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }
}

export function toDateKeyInTimeZone(isoString: string, timeZone: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-CA', { timeZone });
  } catch (error) {
    return new Date(isoString).toLocaleDateString('en-CA');
  }
}