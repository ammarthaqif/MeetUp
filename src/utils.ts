import { Booking } from './types';

/**
 * Converts a time string "HH:MM" into minutes from midnight for easy math
 */
export const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Formats minutes from midnight back into a "HH:MM" string
 */
export const minutesToTime = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Checks if two time ranges overlap on the same date
 * Range A: [startA, endA], Range B: [startB, endB]
 */
export const areTimesOverlapping = (
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean => {
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
  roomId: string,
  date: string,
  startTime: string,
  endTime: string,
  bookings: Booking[],
  excludeBookingId?: string
): boolean => {
  const roomBookings = bookings.filter(
    b => b.roomId === roomId && b.date === date && b.id !== excludeBookingId
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
export const formatDateToISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parses YYYY-MM-DD into a Date in local time without timezone skew
 */
export const parseISODate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

/**
 * Adds or subtracts days to a YYYY-MM-DD string
 */
export const addDaysToDate = (dateStr: string, days: number): string => {
  const d = parseISODate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDateToISO(d);
};

/**
 * Adds or subtracts months to a YYYY-MM-DD string
 */
export const addMonthsToDate = (dateStr: string, months: number): string => {
  const d = parseISODate(dateStr);
  d.setMonth(d.getMonth() + months);
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
export const formatMonthYear = (dateStr: string): string => {
  const d = parseISODate(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

/**
 * Formats a week range (e.g., "Aug 17 – Aug 23, 2026")
 */
export const formatWeekRange = (weekDays: WeekDayInfo[]): string => {
  if (weekDays.length === 0) return '';
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
export const formatFriendlyDate = (dateStr: string): string => {
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
export const getBookingStatus = (booking: Booking): 'past' | 'ongoing' | 'upcoming' => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
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
