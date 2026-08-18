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
 * Formats a date string "YYYY-MM-DD" into a friendly display format like "Thursday, Jul 2"
 */
export const formatFriendlyDate = (dateStr: string): string => {
  const date = new Date(dateStr);
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
