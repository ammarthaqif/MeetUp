import { Booking, Room } from './types';

// Helper to construct DateTime ISO string from date and time strings
const getEventTimeObject = (date: string, time: string) => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  // Standard format: YYYY-MM-DDTHH:MM:SS
  return {
    dateTime: `${date}T${time}:00`,
    timeZone,
  };
};

/**
 * Creates an event in Google Calendar
 * @returns The created event ID from Google Calendar
 */
export const createGoogleCalendarEvent = async (
  booking: Omit<Booking, 'id' | 'createdAt'>,
  room: Room,
  accessToken: string
): Promise<string> => {
  const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  
  const eventBody = {
    summary: `${booking.title} (${room.name})`,
    description: `${booking.description}\n\nBooked via Office Meeting Room System.\nHost: ${booking.hostName} (${booking.hostEmail})\nFloor: ${room.floor}`,
    location: `${room.name}, Floor ${room.floor}`,
    start: getEventTimeObject(booking.date, booking.startTime),
    end: getEventTimeObject(booking.date, booking.endTime),
    attendees: booking.attendees.map(email => ({ email: email.trim() })),
    reminders: {
      useDefault: true,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to create Google Calendar event');
  }

  const data = await response.json();
  return data.id;
};

/**
 * Updates an existing event in Google Calendar
 */
export const updateGoogleCalendarEvent = async (
  eventId: string,
  booking: Booking,
  room: Room,
  accessToken: string
): Promise<void> => {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;
  
  const eventBody = {
    summary: `${booking.title} (${room.name})`,
    description: `${booking.description}\n\nBooked via Office Meeting Room System.\nHost: ${booking.hostName} (${booking.hostEmail})\nFloor: ${room.floor}`,
    location: `${room.name}, Floor ${room.floor}`,
    start: getEventTimeObject(booking.date, booking.startTime),
    end: getEventTimeObject(booking.date, booking.endTime),
    attendees: booking.attendees.map(email => ({ email: email.trim() })),
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to update Google Calendar event');
  }
};

/**
 * Deletes an event in Google Calendar
 */
export const deleteGoogleCalendarEvent = async (
  eventId: string,
  accessToken: string
): Promise<void> => {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to delete Google Calendar event');
  }
};
