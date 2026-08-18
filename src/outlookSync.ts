import { Booking, Room } from './types';

// Helper to format Date objects or Date strings into ICS format: YYYYMMDDTHHMMSS
const formatToIcsDate = (dateStr: string, timeStr: string): string => {
  // dateStr is YYYY-MM-DD, timeStr is HH:MM
  const cleanDate = dateStr.replace(/-/g, '');
  const cleanTime = timeStr.replace(/:/g, '') + '00';
  return `${cleanDate}T${cleanTime}`;
};

/**
 * Generates and triggers download of an .ics file for the given booking and room
 */
export const downloadIcsFile = (booking: Booking, room: Room) => {
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dtStart = formatToIcsDate(booking.date, booking.startTime);
  const dtEnd = formatToIcsDate(booking.date, booking.endTime);

  const cleanDescription = booking.description
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');

  const cleanSummary = `${booking.title} (${room.name})`
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,');

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Office Meeting Room Booking System//Outlook Sync//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${booking.id}@officeroombooking.com`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=${Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}:${dtStart}`,
    `DTEND;TZID=${Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}:${dtEnd}`,
    `SUMMARY:${cleanSummary}`,
    `DESCRIPTION:${cleanDescription}\\n\\nHost: ${booking.hostName} (${booking.hostEmail})\\nFloor: ${room.floor}`,
    `LOCATION:${room.name}\\, Floor ${room.floor}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  const icsString = icsLines.join('\r\n');
  const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `meeting_${room.name.toLowerCase().replace(/\s+/g, '_')}_${booking.date}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
