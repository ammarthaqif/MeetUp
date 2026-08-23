import { Booking, Room } from './types';

// Helper to format Date objects or Date strings into ICS format: YYYYMMDDTHHMMSS
const formatToIcsDate = (dateStr: string, timeStr: string): string => {
  // dateStr is YYYY-MM-DD, timeStr is HH:MM
  const cleanDate = (dateStr || '').replace(/-/g, '');
  const cleanTime = (timeStr || '09:00').replace(/:/g, '').padEnd(4, '0') + '00';
  return `${cleanDate}T${cleanTime}`;
};

const escapeIcsText = (str: string): string => {
  return (str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/[\r\n]/g, '\\n');
};

/**
 * Generates an iCalendar VEVENT block for a single reservation
 */
export const createIcsEventBlock = (booking: Booking, room?: Room): string[] => {
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dtStart = formatToIcsDate(booking.date, booking.startTime);
  const dtEnd = formatToIcsDate(booking.date, booking.endTime);
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const roomName = room?.name || `Room ${booking.roomId}`;
  const floorText = room?.floor !== undefined ? `Level ${room.floor}` : `Floor ${booking.floor}`;
  const locationText = `${roomName}, ${floorText}`;

  const summary = escapeIcsText(`${booking.title} (${roomName})`);
  const hostDesc = `Host: ${booking.hostName || 'Organizer'} (${booking.hostEmail || 'host@office.internal'})`;
  const fullDesc = escapeIcsText(
    `${booking.description ? booking.description + '\n\n' : ''}${hostDesc}\nLocation: ${locationText}\nStatus: Confirmed Reservation`
  );

  return [
    'BEGIN:VEVENT',
    `UID:${booking.id}@officesync.app`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=${userTz}:${dtStart}`,
    `DTEND;TZID=${userTz}:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${fullDesc}`,
    `LOCATION:${escapeIcsText(locationText)}`,
    booking.hostEmail ? `ORGANIZER;CN=${escapeIcsText(booking.hostName || 'Host')}:mailto:${booking.hostEmail}` : '',
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${summary}`,
    'END:VALARM',
    'END:VEVENT'
  ].filter(Boolean);
};

/**
 * Generates and triggers download of an .ics file for a selected reservation
 * Compatible with Apple Calendar, Google Calendar, Microsoft Outlook, Thunderbird, etc.
 */
export const downloadIcsFile = (booking: Booking, room?: Room) => {
  const eventLines = createIcsEventBlock(booking, room);

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OfficeSync Meeting Room System//iCalendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...eventLines,
    'END:VCALENDAR'
  ];

  const icsString = icsLines.join('\r\n');
  const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const roomSlug = (room?.name || 'meeting').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const cleanTitle = (booking.title || 'reservation').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 20);
  const filename = `${cleanTitle}_${roomSlug}_${booking.date}.ics`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Generates and triggers download of an .ics file for multiple bookings
 */
export const downloadMultipleIcsFile = (bookings: Booking[], rooms: Room[], calendarName = 'My Reservations') => {
  if (!bookings || bookings.length === 0) return;

  const roomMap = new Map(rooms.map(r => [r.id, r]));
  const allEvents = bookings.flatMap(b => createIcsEventBlock(b, roomMap.get(b.roomId)));

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OfficeSync Meeting Room System//iCalendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    ...allEvents,
    'END:VCALENDAR'
  ];

  const icsString = icsLines.join('\r\n');
  const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const today = new Date().toISOString().split('T')[0];
  const filename = `my_reservations_${today}.ics`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

