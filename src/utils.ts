import { Booking } from './types';

/**
 * Converts a time string "HH:MM" into minutes from midnight for easy math.
 * Safely handles null, undefined, or malformed time strings.
 */
export const timeToMinutes = (timeStr?: string | null): number => {
  if (!timeStr || typeof timeStr !== 'string') return 540; // fallback to 09:00 (9 * 60)
  const parts = timeStr.split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  return (isNaN(hours) ? 9 : hours) * 60 + (isNaN(minutes) ? 0 : minutes);
};

/**
 * Formats minutes from midnight back into a "HH:MM" string
 */
export const minutesToTime = (totalMinutes?: number | null): string => {
  const safeMins = typeof totalMinutes === 'number' && !isNaN(totalMinutes) ? totalMinutes : 540;
  const hours = Math.floor(safeMins / 60) % 24;
  const minutes = Math.floor(safeMins % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Checks if two time ranges overlap on the same date
 * Range A: [startA, endA], Range B: [startB, endB]
 */
export const areTimesOverlapping = (
  startA?: string | null,
  endA?: string | null,
  startB?: string | null,
  endB?: string | null
): boolean => {
  if (!startA || !endA || !startB || !endB) return false;
  const minStartA = timeToMinutes(startA);
  const minEndA = timeToMinutes(endA);
  const minStartB = timeToMinutes(startB);
  const minEndB = timeToMinutes(endB);

  return minStartA < minEndB && minEndA > minStartB;
};

/**
 * Checks if a room has any overlapping bookings for a given date and time range,
 * optionally excluding a specific booking ID (useful when editing a booking).
 */
export const isRoomAvailable = (
  roomId?: string | null,
  date?: string | null,
  startTime?: string | null,
  endTime?: string | null,
  bookings?: Booking[],
  excludeBookingId?: string
): boolean => {
  if (!roomId || !date || !startTime || !endTime || !Array.isArray(bookings)) {
    return true;
  }
  const roomBookings = bookings.filter(
    b => b && b.roomId === roomId && b.date === date && b.id !== excludeBookingId
  );

  for (const booking of roomBookings) {
    if (areTimesOverlapping(startTime, endTime, booking.startTime, booking.endTime)) {
      return false;
    }
  }

  return true;
};

/**
 * Formats a Date object to YYYY-MM-DD string
 */
export const formatDateToISO = (date?: Date | null): string => {
  const validDate = (date instanceof Date && !isNaN(date.getTime())) ? date : new Date();
  const year = validDate.getFullYear();
  const month = String(validDate.getMonth() + 1).padStart(2, '0');
  const day = String(validDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parses YYYY-MM-DD into a Date in local time without timezone skew
 */
export const parseISODate = (dateStr?: string | null): Date => {
  if (!dateStr || typeof dateStr !== 'string') return new Date();
  const parts = dateStr.split('-');
  const year = Number(parts[0]) || new Date().getFullYear();
  const month = Number(parts[1]) || (new Date().getMonth() + 1);
  const day = Number(parts[2]) || new Date().getDate();
  return new Date(year, (month || 1) - 1, day || 1);
};

/**
 * Adds or subtracts days to a YYYY-MM-DD string
 */
export const addDaysToDate = (dateStr?: string | null, days: number = 0): string => {
  const d = parseISODate(dateStr);
  d.setDate(d.getDate() + (days || 0));
  return formatDateToISO(d);
};

/**
 * Adds or subtracts months to a YYYY-MM-DD string
 */
export const addMonthsToDate = (dateStr?: string | null, months: number = 0): string => {
  const d = parseISODate(dateStr);
  d.setMonth(d.getMonth() + (months || 0));
  return formatDateToISO(d);
};

export interface WeekDayInfo {
  dateStr: string;
  date: Date;
  dayName: string;
  shortDay: string;
  dayNum: number;
  isToday: boolean;
  isSelected: boolean;
}

/**
 * Returns the 7 days of the week containing the given date (Monday to Sunday)
 */
export const getWeekDates = (dateStr: string, selectedDateStr?: string): WeekDayInfo[] => {
  const baseDate = parseISODate(dateStr);
  const dayOfWeek = baseDate.getDay(); // 0 is Sunday, 1 is Monday, ...
  // Calculate Monday offset (if Sunday (0), offset is -6, if Mon (1) offset is 0, etc.)
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() + diffToMonday);

  const todayStr = formatDateToISO(new Date());
  const selectedStr = selectedDateStr || dateStr;

  const week: WeekDayInfo[] = [];
  for (let i = 0; i < 7; i++) {
    const current = new Date(monday);
    current.setDate(monday.getDate() + i);
    const dStr = formatDateToISO(current);
    week.push({
      dateStr: dStr,
      date: current,
      dayName: current.toLocaleDateString('en-US', { weekday: 'long' }),
      shortDay: current.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: current.getDate(),
      isToday: dStr === todayStr,
      isSelected: dStr === selectedStr,
    });
  }

  return week;
};

export interface MonthDayInfo {
  dateStr: string;
  date: Date;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

/**
 * Returns a 35 or 42 grid of days for calendar display of a month
 */
export const getMonthCalendarGrid = (dateStr: string, selectedDateStr?: string): MonthDayInfo[] => {
  const baseDate = parseISODate(dateStr);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth(); // 0-indexed

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const firstDayWeekday = firstDayOfMonth.getDay(); // 0 is Sunday
  const mondayOffset = firstDayWeekday === 0 ? -6 : 1 - firstDayWeekday;

  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(firstDayOfMonth.getDate() + mondayOffset);

  const todayStr = formatDateToISO(new Date());
  const selectedStr = selectedDateStr || dateStr;

  const grid: MonthDayInfo[] = [];
  const totalDays = 42; // 6 weeks standard grid

  for (let i = 0; i < totalDays; i++) {
    const current = new Date(startDate);
    current.setDate(startDate.getDate() + i);
    const dStr = formatDateToISO(current);
    const isCurrentMonth = current.getMonth() === month;

    grid.push({
      dateStr: dStr,
      date: current,
      dayNum: current.getDate(),
      isCurrentMonth,
      isToday: dStr === todayStr,
      isSelected: dStr === selectedStr,
    });
  }

  return grid;
};

/**
 * Formats Month and Year (e.g., "August 2026")
 */
export const formatMonthYear = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const d = parseISODate(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

/**
 * Formats a week range (e.g., "Aug 17 – Aug 23, 2026")
 */
export const formatWeekRange = (weekDays: WeekDayInfo[]): string => {
  if (!weekDays || weekDays.length === 0) return '';
  const first = weekDays[0];
  const last = weekDays[weekDays.length - 1];

  const firstMonth = first.date.toLocaleDateString('en-US', { month: 'short' });
  const lastMonth = last.date.toLocaleDateString('en-US', { month: 'short' });
  const year = last.date.getFullYear();

  if (firstMonth === lastMonth) {
    return `${firstMonth} ${first.dayNum} – ${last.dayNum}, ${year}`;
  }
  return `${firstMonth} ${first.dayNum} – ${lastMonth} ${last.dayNum}, ${year}`;
};

/**
 * Formats a date string "YYYY-MM-DD" into a friendly display format like "Thursday, Jul 2"
 */
export const formatFriendlyDate = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const date = parseISODate(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Checks if a booking is currently ongoing, in the future, or in the past
 */
export const getBookingStatus = (booking?: Booking | null): 'past' | 'ongoing' | 'upcoming' => {
  if (!booking || !booking.date) return 'past';
  const now = new Date();
  const todayStr = formatDateToISO(now);
  const currentTimeMin = now.getHours() * 60 + now.getMinutes();

  if (booking.date < todayStr) {
    return 'past';
  } else if (booking.date > todayStr) {
    return 'upcoming';
  } else {
    // Same day, check times
    const startMin = timeToMinutes(booking.startTime);
    const endMin = timeToMinutes(booking.endTime);
    if (currentTimeMin >= startMin && currentTimeMin < endMin) {
      return 'ongoing';
    } else if (currentTimeMin < startMin) {
      return 'upcoming';
    } else {
      return 'past';
    }
  }
};

// =========================================================================
// Recurring Booking Engine Utilities
// =========================================================================

export type RecurrenceFrequency = 
  | 'DAILY' 
  | 'WEEKDAYS' 
  | 'WEEKLY' 
  | 'BIWEEKLY' 
  | 'MONTHLY_DATE' 
  | 'MONTHLY_DAY' 
  | 'CUSTOM_DAYS';

export interface RecurrenceConfig {
  startDate: string; // YYYY-MM-DD
  frequency: RecurrenceFrequency;
  interval?: number; // e.g. every 1, 2, 3, 4 weeks/days
  repeatDays?: string[]; // e.g. ['Monday', 'Wednesday']
  endType: 'count' | 'until_date';
  occurrencesCount?: number; // e.g. 4, 8, 12, 24
  endDate?: string; // YYYY-MM-DD
  maxGenerated?: number;
}

/**
 * Returns ordinal information for a specific date (e.g. 3rd Thursday)
 */
export const getWeekdayOrdinalInfo = (dateStr: string): { nth: number; dayName: string; weekdayIndex: number; label: string } => {
  const d = parseISODate(dateStr);
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
  const weekdayIndex = d.getDay(); // 0 is Sunday
  const dayNum = d.getDate();
  const nth = Math.ceil(dayNum / 7);
  const nthLabels = ['1st', '2nd', '3rd', '4th', '5th'];
  const label = `${nthLabels[nth - 1] || `${nth}th`} ${dayName}`;
  return { nth, dayName, weekdayIndex, label };
};

/**
 * Returns the Nth weekday in a given year and month
 */
export const getNthWeekdayOfMonth = (year: number, month: number, targetWeekday: number, nth: number): Date => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  if (nth === -1 || nth >= 5) {
    const lastDay = new Date(year, month, daysInMonth);
    const lastDayWeekday = lastDay.getDay();
    const diff = (lastDayWeekday - targetWeekday + 7) % 7;
    return new Date(year, month, daysInMonth - diff);
  }

  const firstDay = new Date(year, month, 1);
  const firstDayWeekday = firstDay.getDay();
  const diff = (targetWeekday - firstDayWeekday + 7) % 7;
  const targetDay = 1 + diff + (nth - 1) * 7;

  if (targetDay > daysInMonth) {
    return getNthWeekdayOfMonth(year, month, targetWeekday, -1);
  }

  return new Date(year, month, targetDay);
};

/**
 * Generates an array of formatted YYYY-MM-DD dates based on a recurrence configuration
 */
export const generateRecurringDates = (config: RecurrenceConfig): string[] => {
  const {
    startDate,
    frequency,
    interval = 1,
    repeatDays = [],
    endType,
    occurrencesCount = 4,
    endDate = '',
    maxGenerated = 100,
  } = config;

  if (!startDate) return [];
  const startObj = parseISODate(startDate);
  if (isNaN(startObj.getTime())) return [];

  const endLimitDate = endType === 'until_date' && endDate ? parseISODate(endDate) : null;
  const targetCount = endType === 'count' ? Math.max(1, Math.min(occurrencesCount, maxGenerated)) : maxGenerated;

  const resultDates: string[] = [];
  const baseDayName = startObj.toLocaleDateString('en-US', { weekday: 'long' });
  const activeRepeatDays = repeatDays.length > 0 ? repeatDays : [baseDayName];
  const { nth: baseNth, weekdayIndex: baseWeekdayIndex } = getWeekdayOrdinalInfo(startDate);
  const stepInterval = Math.max(1, interval || 1);

  switch (frequency) {
    case 'DAILY': {
      let cur = new Date(startObj);
      while (resultDates.length < targetCount) {
        if (endLimitDate && cur > endLimitDate) break;
        resultDates.push(formatDateToISO(cur));
        cur.setDate(cur.getDate() + stepInterval);
      }
      break;
    }

    case 'WEEKDAYS': {
      let cur = new Date(startObj);
      let safetyCounter = 0;
      while (resultDates.length < targetCount && safetyCounter < 500) {
        safetyCounter++;
        if (endLimitDate && cur > endLimitDate) break;
        const day = cur.getDay();
        if (day !== 0 && day !== 6) { // Monday to Friday
          resultDates.push(formatDateToISO(cur));
        }
        cur.setDate(cur.getDate() + 1);
      }
      break;
    }

    case 'WEEKLY':
    case 'BIWEEKLY': {
      const stepWeeks = frequency === 'BIWEEKLY' ? (stepInterval * 2) : stepInterval;
      let curWeekStart = new Date(startObj);
      // Align to Monday of start week
      const startDayOfWeek = startObj.getDay();
      const diffToMonday = startDayOfWeek === 0 ? -6 : 1 - startDayOfWeek;
      curWeekStart.setDate(startObj.getDate() + diffToMonday);

      let safetyCounter = 0;

      while (resultDates.length < targetCount && safetyCounter < 200) {
        safetyCounter++;
        // Check days in this week window
        for (let i = 0; i < 7; i++) {
          const testDate = new Date(curWeekStart);
          testDate.setDate(curWeekStart.getDate() + i);
          
          if (testDate < startObj) continue;
          if (endLimitDate && testDate > endLimitDate) break;

          const dayName = testDate.toLocaleDateString('en-US', { weekday: 'long' });
          if (activeRepeatDays.includes(dayName)) {
            const dateStr = formatDateToISO(testDate);
            if (!resultDates.includes(dateStr)) {
              resultDates.push(dateStr);
              if (resultDates.length >= targetCount) break;
            }
          }
        }

        if (endLimitDate && curWeekStart > endLimitDate) break;
        curWeekStart.setDate(curWeekStart.getDate() + 7 * stepWeeks);
      }
      break;
    }

    case 'MONTHLY_DATE': {
      const baseDayOfMonth = startObj.getDate();
      let year = startObj.getFullYear();
      let month = startObj.getMonth();

      while (resultDates.length < targetCount) {
        const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
        const targetDay = Math.min(baseDayOfMonth, daysInCurrentMonth);
        const curDate = new Date(year, month, targetDay);

        if (curDate >= startObj) {
          if (endLimitDate && curDate > endLimitDate) break;
          resultDates.push(formatDateToISO(curDate));
        }

        month++;
        if (month > 11) {
          month = 0;
          year++;
        }
      }
      break;
    }

    case 'MONTHLY_DAY': {
      let year = startObj.getFullYear();
      let month = startObj.getMonth();

      while (resultDates.length < targetCount) {
        const curDate = getNthWeekdayOfMonth(year, month, baseWeekdayIndex, baseNth);
        if (curDate >= startObj) {
          if (endLimitDate && curDate > endLimitDate) break;
          resultDates.push(formatDateToISO(curDate));
        }

        month++;
        if (month > 11) {
          month = 0;
          year++;
        }
      }
      break;
    }

    case 'CUSTOM_DAYS':
    default: {
      let cur = new Date(startObj);
      const effectiveEnd = endLimitDate || new Date(startObj.getTime() + 30 * 24 * 60 * 60 * 1000);
      let safetyCounter = 0;

      while (cur <= effectiveEnd && resultDates.length < targetCount && safetyCounter < 500) {
        safetyCounter++;
        const dayName = cur.toLocaleDateString('en-US', { weekday: 'long' });
        if (activeRepeatDays.includes(dayName)) {
          resultDates.push(formatDateToISO(cur));
        }
        cur.setDate(cur.getDate() + 1);
      }
      break;
    }
  }

  return Array.from(new Set(resultDates)).sort();
};
