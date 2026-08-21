import * as XLSX from 'xlsx';
import { Booking, Office, Room } from '../types';
import { areTimesOverlapping, formatDateToISO, parseISODate, timeToMinutes, minutesToTime } from '../utils';

export interface ParsedBookingCandidate {
  id: string;
  sourceSheet: string;
  sourceRow: number;
  sourceCol?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  title: string;
  roomName: string;
  matchedRoomId?: string;
  floor?: number;
  officeName?: string;
  officeId?: string;
  hostName: string;
  hostEmail: string;
  description: string;
  attendees: string[];
  status: 'valid' | 'conflict' | 'warning' | 'invalid';
  validationMessage?: string;
  conflictingWith?: Booking;
}

export type ExcelLayoutMode = 'auto' | 'calendar_grid' | 'tabular_list';

/**
 * Parses an Excel date/time cell value into standard formats
 */
export function parseExcelDateValue(val: any, fallbackDateStr?: string): string {
  if (!val) return fallbackDateStr || formatDateToISO(new Date());

  if (typeof val === 'number') {
    // Excel date serial number (e.g. 45500)
    // Excel base date is 1899-12-30 due to the 1900 leap year bug
    const date = new Date((val - (25567 + 2)) * 86400 * 1000);
    if (!isNaN(date.getTime()) && date.getFullYear() > 2000 && date.getFullYear() < 2100) {
      return formatDateToISO(date);
    }
  }

  const str = String(val).trim();
  
  // YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const parts = str.split('-');
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }

  // DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY
  if (/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.test(str)) {
    const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (match) {
      const p1 = parseInt(match[1], 10);
      const p2 = parseInt(match[2], 10);
      const year = match[3];
      // Assume DD/MM/YYYY if p1 > 12
      if (p1 > 12) {
        return `${year}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
      } else {
        // Default to DD/MM/YYYY standard
        return `${year}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
      }
    }
  }

  // Textual dates e.g. "24 Aug 2026" or "August 24, 2026"
  const parsedTimestamp = Date.parse(str);
  if (!isNaN(parsedTimestamp)) {
    const parsedDate = new Date(parsedTimestamp);
    if (parsedDate.getFullYear() > 2000 && parsedDate.getFullYear() < 2100) {
      return formatDateToISO(parsedDate);
    }
  }

  return fallbackDateStr || formatDateToISO(new Date());
}

/**
 * Parses an Excel time string or number into HH:MM format
 */
export function parseExcelTimeValue(val: any, defaultTime = '09:00'): string {
  if (val === undefined || val === null || val === '') return defaultTime;

  if (typeof val === 'number') {
    // If fractional (0 to 1), it represents fraction of day
    if (val >= 0 && val <= 1) {
      const totalMinutes = Math.round(val * 24 * 60);
      const hours = Math.floor(totalMinutes / 60) % 24;
      const minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    // If integer like 900 or 1430
    if (val >= 100 && val <= 2400) {
      const str = String(val).padStart(4, '0');
      return `${str.slice(0, 2)}:${str.slice(2, 4)}`;
    }
  }

  const str = String(val).trim();

  // "09:00", "9:30", "14:00"
  const match24 = str.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h = parseInt(match24[1], 10);
    const m = match24[2];
    return `${String(h).padStart(2, '0')}:${m}`;
  }

  // "9:00 AM", "2:30 PM", "9am", "2pm", "11:00pm"
  const match12 = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = match12[2] || '00';
    const meridiem = (match12[3] || '').toLowerCase();
    if (meridiem.includes('p') && h < 12) h += 12;
    if (meridiem.includes('a') && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }

  // "09:00 - 10:30" or "9am-10am" (takes start time)
  const rangeMatch = str.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–—to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (rangeMatch) {
    return parseExcelTimeValue(rangeMatch[1], defaultTime);
  }

  return defaultTime;
}

/**
 * Extracts start and end time if cell contains a range like "09:00 - 10:30" or "9:00 AM to 11:00 AM"
 */
export function extractTimeRange(val: any): { startTime: string; endTime: string } | null {
  if (!val) return null;
  const str = String(val).trim();

  const rangeMatch = str.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–—to/]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (rangeMatch) {
    const startTime = parseExcelTimeValue(rangeMatch[1], '09:00');
    let endTime = parseExcelTimeValue(rangeMatch[2], '10:00');
    // If end time is before start time or equal, add 60 mins
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      endTime = minutesToTime(Math.min(1439, timeToMinutes(startTime) + 60));
    }
    return { startTime, endTime };
  }

  return null;
}

/**
 * Parses freeform meeting text inside calendar grid cells
 * e.g. "Executive Sync - Sarah Connor (sarah@acme.com) [09:00 - 10:30]"
 * or "Design Review / John / Level 4"
 */
export function parseMeetingCellContent(cellText: string): {
  title: string;
  hostName: string;
  hostEmail: string;
  timeRange?: { startTime: string; endTime: string };
  description: string;
} {
  const clean = cellText.replace(/\r\n/g, '\n').trim();
  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);

  let title = lines[0] || 'Imported Meeting';
  let hostName = 'Corporate Staff';
  let hostEmail = '';
  let description = lines.slice(1).join(' ');
  let timeRange: { startTime: string; endTime: string } | undefined;

  // Check for email in cell
  const emailMatch = clean.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    hostEmail = emailMatch[1].toLowerCase();
  }

  // Check for time range in brackets or text
  const extractedRange = extractTimeRange(clean);
  if (extractedRange) {
    timeRange = extractedRange;
  }

  // Check if title has "Title - Host (Email)" format
  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    title = parts[0].trim();
    if (parts[1]) {
      const hostPart = parts[1].replace(/\(.*?\)/g, '').trim();
      if (hostPart) hostName = hostPart;
    }
  } else if (title.includes(' / ')) {
    const parts = title.split(' / ');
    title = parts[0].trim();
    if (parts[1]) hostName = parts[1].trim();
  }

  // If host name has email format, extract name
  if (hostName.includes('@')) {
    hostEmail = hostName.toLowerCase();
    hostName = hostName.split('@')[0].replace(/[._-]/g, ' ');
  }

  return { title, hostName, hostEmail, timeRange, description };
}

/**
 * Detects if a worksheet is a Manual Calendar Grid (Matrix) or a Tabular List
 */
export function detectSheetLayout(data: any[][]): 'calendar_grid' | 'tabular_list' {
  if (!data || data.length < 2) return 'tabular_list';

  // Look for column headers in the first 5 rows
  for (let r = 0; r < Math.min(5, data.length); r++) {
    const row = data[r] || [];
    const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');

    const hasTabularHeaders = 
      (rowStr.includes('room') || rowStr.includes('meeting') || rowStr.includes('title')) &&
      (rowStr.includes('date') || rowStr.includes('day')) &&
      (rowStr.includes('time') || rowStr.includes('start') || rowStr.includes('from'));

    if (hasTabularHeaders) {
      return 'tabular_list';
    }
  }

  // Check for calendar grid signatures:
  // Signature A: Column headers contain day names (Mon, Tue, Wed, Thursday...) or dates (2026-08-24, Aug 24...)
  // and Row headers contain times (09:00, 10:00, 11:00...)
  const dayNameKeywords = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  for (let r = 0; r < Math.min(4, data.length); r++) {
    const row = data[r] || [];
    const dayMatches = row.filter(cell => {
      const str = String(cell || '').toLowerCase().trim();
      return dayNameKeywords.some(day => str.startsWith(day)) || /^\d{4}-\d{2}-\d{2}/.test(str) || /^\d{1,2}\/\d{1,2}/.test(str);
    });

    if (dayMatches.length >= 2) {
      return 'calendar_grid';
    }
  }

  // Signature B: Column 0 has time values (e.g. 08:00, 09:00, 10:00) and other columns are Rooms
  let timeInFirstColCount = 0;
  for (let r = 1; r < Math.min(15, data.length); r++) {
    const firstCell = data[r]?.[0];
    if (firstCell && (extractTimeRange(firstCell) || /^\d{1,2}(?::\d{2})?\s*(?:am|pm)?$/i.test(String(firstCell).trim()))) {
      timeInFirstColCount++;
    }
  }

  if (timeInFirstColCount >= 3) {
    return 'calendar_grid';
  }

  return 'tabular_list';
}

/**
 * Parses Tabular List Excel Data
 */
export function parseTabularExcelData(
  data: any[][],
  sheetName: string,
  targetOffice: Office,
  availableRooms: Room[],
  existingBookings: Booking[],
  defaultHostEmail: string
): ParsedBookingCandidate[] {
  if (!data || data.length < 2) return [];

  // Find header row (search first 5 rows)
  let headerRowIndex = 0;
  let headers: string[] = [];

  for (let r = 0; r < Math.min(5, data.length); r++) {
    const row = (data[r] || []).map(c => String(c || '').trim().toLowerCase());
    const matchCount = row.filter(h => 
      h.includes('date') || h.includes('room') || h.includes('time') || h.includes('title') || h.includes('host') || h.includes('meeting')
    ).length;

    if (matchCount >= 2) {
      headerRowIndex = r;
      headers = row;
      break;
    }
  }

  if (headers.length === 0) {
    headers = (data[0] || []).map(c => String(c || '').trim().toLowerCase());
  }

  // Identify column indices
  const getColIndex = (keywords: string[]): number => {
    return headers.findIndex(h => keywords.some(k => h.includes(k)));
  };

  const colDate = getColIndex(['date', 'tarikh', 'day']);
  const colRoom = getColIndex(['room', 'bilik', 'space', 'location']);
  const colStartTime = getColIndex(['start', 'from', 'begin', 'time from']);
  const colEndTime = getColIndex(['end', 'to', 'until', 'time to', 'finish']);
  const colTimeSlot = getColIndex(['time', 'slot', 'timeslot', 'duration', 'masa']);
  const colTitle = getColIndex(['title', 'subject', 'event', 'meeting', 'purpose', 'agenda', 'tajuk', 'name of meeting']);
  const colHost = getColIndex(['host', 'organizer', 'booked by', 'name', 'requester', 'pemohon', 'person']);
  const colEmail = getColIndex(['email', 'host email', 'organizer email', 'contact']);
  const colFloor = getColIndex(['floor', 'level', 'lvl', 'tingkat']);
  const colDescription = getColIndex(['description', 'desc', 'notes', 'remarks', 'catatan', 'agenda']);
  const colAttendees = getColIndex(['attendees', 'participants', 'guests', 'peserta']);

  const candidates: ParsedBookingCandidate[] = [];

  for (let r = headerRowIndex + 1; r < data.length; r++) {
    const row = data[r];
    if (!row || row.length === 0 || row.every(c => c === null || c === undefined || String(c).trim() === '')) {
      continue;
    }

    const rawDate = colDate >= 0 ? row[colDate] : null;
    const rawRoom = colRoom >= 0 ? String(row[colRoom] || '').trim() : '';
    let rawStart = colStartTime >= 0 ? row[colStartTime] : null;
    let rawEnd = colEndTime >= 0 ? row[colEndTime] : null;
    const rawTimeSlot = colTimeSlot >= 0 ? row[colTimeSlot] : null;
    const rawTitle = colTitle >= 0 ? String(row[colTitle] || '').trim() : '';
    const rawHost = colHost >= 0 ? String(row[colHost] || '').trim() : '';
    const rawEmail = colEmail >= 0 ? String(row[colEmail] || '').trim() : '';
    const rawFloor = colFloor >= 0 ? parseInt(String(row[colFloor]), 10) : undefined;
    const rawDesc = colDescription >= 0 ? String(row[colDescription] || '').trim() : '';
    const rawAttendees = colAttendees >= 0 ? String(row[colAttendees] || '').trim() : '';

    if (!rawDate && !rawTitle && !rawRoom) continue;

    const date = parseExcelDateValue(rawDate);

    // Parse times
    let startTime = '09:00';
    let endTime = '10:00';

    if (rawStart && rawEnd) {
      startTime = parseExcelTimeValue(rawStart, '09:00');
      endTime = parseExcelTimeValue(rawEnd, '10:00');
    } else if (rawStart) {
      const range = extractTimeRange(rawStart);
      if (range) {
        startTime = range.startTime;
        endTime = range.endTime;
      } else {
        startTime = parseExcelTimeValue(rawStart, '09:00');
        endTime = minutesToTime(Math.min(1439, timeToMinutes(startTime) + 60));
      }
    } else if (rawTimeSlot) {
      const range = extractTimeRange(rawTimeSlot);
      if (range) {
        startTime = range.startTime;
        endTime = range.endTime;
      } else {
        startTime = parseExcelTimeValue(rawTimeSlot, '09:00');
        endTime = minutesToTime(Math.min(1439, timeToMinutes(startTime) + 60));
      }
    }

    // Ensure valid duration
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      endTime = minutesToTime(Math.min(1439, timeToMinutes(startTime) + 60));
    }

    // Room resolution
    let matchedRoom = availableRooms.find(rm => 
      rm.name.toLowerCase() === rawRoom.toLowerCase() ||
      rm.name.toLowerCase().includes(rawRoom.toLowerCase()) ||
      rawRoom.toLowerCase().includes(rm.name.toLowerCase())
    );

    if (!matchedRoom && availableRooms.length > 0) {
      matchedRoom = availableRooms[0]; // fallback
    }

    const hostEmail = rawEmail || defaultHostEmail || 'admin@enterprise.internal';
    const hostName = rawHost || (hostEmail.includes('@') ? hostEmail.split('@')[0] : 'Corporate Staff');
    const title = rawTitle || 'Imported Workspace Booking';
    const attendeesList = rawAttendees ? rawAttendees.split(/[,;\n]+/).map(a => a.trim()).filter(Boolean) : [];

    const candidateId = `cand-${Date.now()}-${r}-${Math.random().toString(36).substr(2, 4)}`;

    // Validate availability
    const roomId = matchedRoom?.id || '';
    let status: 'valid' | 'conflict' | 'warning' = 'valid';
    let validationMessage = 'Ready for import';
    let conflictingWith: Booking | undefined;

    if (roomId) {
      const conflict = existingBookings.find(b => 
        b.roomId === roomId &&
        b.date === date &&
        areTimesOverlapping(startTime, endTime, b.startTime, b.endTime)
      );

      if (conflict) {
        status = 'conflict';
        validationMessage = `Conflicts with "${conflict.title}" (${conflict.startTime} - ${conflict.endTime}) by ${conflict.hostName}`;
        conflictingWith = conflict;
      }
    }

    candidates.push({
      id: candidateId,
      sourceSheet: sheetName,
      sourceRow: r + 1,
      date,
      startTime,
      endTime,
      title,
      roomName: matchedRoom ? matchedRoom.name : rawRoom || 'Workspace Room',
      matchedRoomId: matchedRoom?.id,
      floor: matchedRoom?.floor || rawFloor || targetOffice.floors[0] || 1,
      officeName: targetOffice.name,
      officeId: targetOffice.id,
      hostName,
      hostEmail,
      description: rawDesc,
      attendees: attendeesList,
      status,
      validationMessage,
      conflictingWith
    });
  }

  return candidates;
}

/**
 * Parses Manual Calendar Grid / Timetable Excel Data
 * Handles:
 * Layout 1: Columns are Dates (e.g. 2026-08-24 / Monday), Rows are Time Slots (09:00, 10:00, ...)
 * Layout 2: Columns are Rooms (Orion Boardroom, Apollo Suite...), Rows are Time Slots
 */
export function parseCalendarGridExcelData(
  data: any[][],
  sheetName: string,
  baseDate: string, // YYYY-MM-DD for current week / base
  targetOffice: Office,
  availableRooms: Room[],
  existingBookings: Booking[],
  defaultHostEmail: string
): ParsedBookingCandidate[] {
  if (!data || data.length < 2) return [];

  const candidates: ParsedBookingCandidate[] = [];

  // Find header row with column labels
  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(5, data.length); r++) {
    const row = data[r] || [];
    const nonEmptyCount = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '').length;
    if (nonEmptyCount >= 2) {
      headerRowIndex = r;
      break;
    }
  }

  const headerRow = data[headerRowIndex] || [];
  
  // Analyze column headers to determine if columns are Dates, Rooms, or Days
  const dayNameMap: Record<string, number> = {
    'mon': 0, 'monday': 0, 'isnin': 0,
    'tue': 1, 'tuesday': 1, 'selasa': 1,
    'wed': 2, 'wednesday': 2, 'rabu': 2,
    'thu': 3, 'thursday': 3, 'khamis': 3,
    'fri': 4, 'friday': 4, 'jumaat': 4,
    'sat': 5, 'saturday': 5, 'sabtu': 5,
    'sun': 6, 'sunday': 6, 'ahad': 6
  };

  // Base date calculation for relative weekdays
  const baseD = parseISODate(baseDate);
  const baseDayOfWeek = baseD.getDay(); // 0 is Sunday, 1 is Monday
  const mondayOffset = (baseDayOfWeek + 6) % 7; // days since Monday
  const mondayDate = new Date(baseD);
  mondayDate.setDate(mondayDate.getDate() - mondayOffset);

  interface ColMeta {
    colIdx: number;
    headerText: string;
    type: 'date' | 'room' | 'time' | 'unknown';
    resolvedDate?: string;
    resolvedRoom?: Room;
  }

  const colMetas: ColMeta[] = [];

  for (let c = 1; c < headerRow.length; c++) {
    const headerCell = headerRow[c];
    if (headerCell === null || headerCell === undefined || String(headerCell).trim() === '') continue;

    const str = String(headerCell).trim();
    const lower = str.toLowerCase();

    // Check if header is a Room
    const matchingRoom = availableRooms.find(r => 
      r.name.toLowerCase() === lower ||
      r.name.toLowerCase().includes(lower) ||
      lower.includes(r.name.toLowerCase())
    );

    if (matchingRoom) {
      colMetas.push({
        colIdx: c,
        headerText: str,
        type: 'room',
        resolvedRoom: matchingRoom,
        resolvedDate: baseDate
      });
      continue;
    }

    // Check if header is a Date format
    const parsedDate = parseExcelDateValue(headerCell, '');
    if (parsedDate && parsedDate !== formatDateToISO(new Date())) {
      colMetas.push({
        colIdx: c,
        headerText: str,
        type: 'date',
        resolvedDate: parsedDate
      });
      continue;
    }

    // Check if header is a Day of the week (Monday, Tuesday, etc.)
    let dayIdx = -1;
    for (const [key, val] of Object.entries(dayNameMap)) {
      if (lower.startsWith(key)) {
        dayIdx = val;
        break;
      }
    }

    if (dayIdx !== -1) {
      const d = new Date(mondayDate);
      d.setDate(d.getDate() + dayIdx);
      colMetas.push({
        colIdx: c,
        headerText: str,
        type: 'date',
        resolvedDate: formatDateToISO(d)
      });
      continue;
    }

    colMetas.push({
      colIdx: c,
      headerText: str,
      type: 'unknown',
      resolvedDate: baseDate
    });
  }

  // Iterate down rows for time slots
  for (let r = headerRowIndex + 1; r < data.length; r++) {
    const row = data[r];
    if (!row || row.length === 0) continue;

    const timeColCell = row[0];
    if (timeColCell === null || timeColCell === undefined || String(timeColCell).trim() === '') continue;

    // Parse time for this row
    let rowStartTime = '09:00';
    let rowEndTime = '10:00';

    const range = extractTimeRange(timeColCell);
    if (range) {
      rowStartTime = range.startTime;
      rowEndTime = range.endTime;
    } else {
      rowStartTime = parseExcelTimeValue(timeColCell, '09:00');
      // Look ahead to next row for slot duration or default 60 mins
      const nextTimeCell = data[r + 1]?.[0];
      if (nextTimeCell) {
        const nextTime = parseExcelTimeValue(nextTimeCell, '');
        if (nextTime && timeToMinutes(nextTime) > timeToMinutes(rowStartTime)) {
          rowEndTime = nextTime;
        } else {
          rowEndTime = minutesToTime(Math.min(1439, timeToMinutes(rowStartTime) + 60));
        }
      } else {
        rowEndTime = minutesToTime(Math.min(1439, timeToMinutes(rowStartTime) + 60));
      }
    }

    // Now inspect each column cell in this row
    for (const meta of colMetas) {
      const cellValue = row[meta.colIdx];
      if (!cellValue) continue;

      const cellStr = String(cellValue).trim();
      if (!cellStr || cellStr === '-' || cellStr === 'N/A' || cellStr.toLowerCase() === 'free' || cellStr.toLowerCase() === 'available') {
        continue;
      }

      const parsedCell = parseMeetingCellContent(cellStr);

      const bookingDate = meta.resolvedDate || baseDate;
      const targetRoom = meta.resolvedRoom || availableRooms[0];
      const startTime = parsedCell.timeRange ? parsedCell.timeRange.startTime : rowStartTime;
      const endTime = parsedCell.timeRange ? parsedCell.timeRange.endTime : rowEndTime;
      const hostEmail = parsedCell.hostEmail || defaultHostEmail || 'admin@enterprise.internal';
      const hostName = parsedCell.hostName || 'Corporate Staff';

      const candidateId = `cand-grid-${Date.now()}-${r}-${meta.colIdx}-${Math.random().toString(36).substr(2, 4)}`;

      // Check conflict
      let status: 'valid' | 'conflict' | 'warning' = 'valid';
      let validationMessage = 'Valid calendar slot';
      let conflictingWith: Booking | undefined;

      if (targetRoom) {
        const conflict = existingBookings.find(b => 
          b.roomId === targetRoom.id &&
          b.date === bookingDate &&
          areTimesOverlapping(startTime, endTime, b.startTime, b.endTime)
        );

        if (conflict) {
          status = 'conflict';
          validationMessage = `Conflicts with "${conflict.title}" (${conflict.startTime} - ${conflict.endTime})`;
          conflictingWith = conflict;
        }
      }

      candidates.push({
        id: candidateId,
        sourceSheet: sheetName,
        sourceRow: r + 1,
        sourceCol: meta.headerText,
        date: bookingDate,
        startTime,
        endTime,
        title: parsedCell.title,
        roomName: targetRoom ? targetRoom.name : 'Meeting Room',
        matchedRoomId: targetRoom?.id,
        floor: targetRoom?.floor || targetOffice.floors[0] || 1,
        officeName: targetOffice.name,
        officeId: targetOffice.id,
        hostName,
        hostEmail,
        description: parsedCell.description || `Imported from calendar matrix: Row ${r + 1}, Col "${meta.headerText}"`,
        attendees: hostEmail ? [hostEmail] : [],
        status,
        validationMessage,
        conflictingWith
      });
    }
  }

  return candidates;
}

/**
 * Generates sample downloadable Excel workbooks
 */
export function generateSampleCalendarExcel(type: 'calendar_grid' | 'tabular_list'): Blob {
  const wb = XLSX.utils.book_new();

  if (type === 'calendar_grid') {
    // 1. Weekly Calendar Matrix Sheet
    const gridData = [
      ['Time Slot', 'Monday (2026-08-24)', 'Tuesday (2026-08-25)', 'Wednesday (2026-08-26)', 'Thursday (2026-08-27)', 'Friday (2026-08-28)'],
      ['08:30 - 09:30', 'Morning Standup - Dev Team (sarah.connor@acme.com)', 'Executive Breakfast / Sarah', 'Client Discovery Call - Acme Corp', '', 'Weekly Wrapup & Retrospective'],
      ['09:30 - 10:30', 'Architecture Sync - Cloud Lead (david.chen@acme.com)', '', 'Sprint Planning Session', 'Product Roadmap Review - VP Eng', 'Townhall Prep Meeting'],
      ['10:30 - 11:30', '', 'Q3 Budget Review - Finance Director', 'Security Compliance Audit', '', 'Design Jam & UX Wireframes'],
      ['11:30 - 12:30', 'Lunch & Learn: AI in Enterprise', '', '', 'Vendor Negotiations - Operations', ''],
      ['13:30 - 14:30', 'Client Demo: Global Portal', 'Cross-functional Alignment', 'Investor Briefing - Managing Partner', '', '1-on-1 Mentorship Session'],
      ['14:30 - 15:30', 'Marketing Launch Campaign Sync', '', 'Quarterly Business Review (QBR)', 'Engineering All-Hands', ''],
      ['15:30 - 16:30', 'Board of Directors Briefing', 'Patent & Legal Review', '', 'Operations Strategy Sync', 'Team Happy Hour Setup']
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(gridData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Weekly Schedule (Grid)');

    // 2. Room Matrix Sheet
    const roomMatrixData = [
      ['Time Slot', 'Orion Boardroom', 'Apollo Suite', 'Zenith Conference', 'Cyber Lounge', 'Nexus Strategy Room'],
      ['09:00 - 10:00', 'Senior Leadership Sync (sarah@acme.com)', 'Frontend Team Standup', 'Interviews: Senior Architect', '', 'Project Phoenix Review'],
      ['10:00 - 11:30', 'Investor Pitch - Series B', '', 'Customer Advisory Board', 'Brainstorming Sprint', ''],
      ['13:00 - 14:00', 'Executive Board Meeting', 'Security Incident Post-Mortem', '', 'Design Huddle', 'Sales Pipeline Review'],
      ['14:30 - 16:00', 'Annual General Meeting (AGM)', 'API Integration Workshop', 'Data Science Deep Dive', '', 'Vendor Demo']
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(roomMatrixData);
    XLSX.utils.book_append_sheet(wb, ws2, 'By Room (Matrix)');

  } else {
    // Tabular List
    const tableData = [
      ['Date', 'Room Name', 'Start Time', 'End Time', 'Meeting Title', 'Host Name', 'Host Email', 'Floor', 'Description', 'Attendees'],
      ['2026-08-24', 'Orion Boardroom', '09:00', '10:30', 'Strategic Q3 Review', 'Sarah Connor', 'sarah.connor@acme.com', '1', 'Quarterly roadmap alignment with executive committee', 'david.chen@acme.com; elena@vertex.ai'],
      ['2026-08-24', 'Apollo Suite', '11:00', '12:00', 'Cloud Infrastructure Deep Dive', 'David Chen', 'david.chen@acme.com', '2', 'Review GCP multi-region container failovers', 'sarah.connor@acme.com'],
      ['2026-08-25', 'Zenith Conference', '14:00', '15:30', 'Product Design Crit', 'Marcus Vance', 'marcus.vance@starlightmedia.io', '3', 'Final review of interactive boardroom booking mobile screens', 'sarah.connor@acme.com'],
      ['2026-08-26', 'Orion Boardroom', '10:00', '11:30', 'Partner Ecosystem Briefing', 'Elizabeth Vane', 'elizabeth.vane@nexuscapital.com', '1', 'High-level discussion on institutional co-investments', 'david.chen@acme.com'],
      ['2026-08-27', 'Cyber Lounge', '15:00', '16:30', 'AI Model Integration Workshop', 'Dr. Elena Rostova', 'dr.elena.rostova@vertexrobotics.ai', '4', 'Hands-on session with Gemini 2.5 Flash on Edge devices', 'sarah.connor@acme.com; david.chen@acme.com']
    ];

    const ws = XLSX.utils.aoa_to_sheet(tableData);
    XLSX.utils.book_append_sheet(wb, ws, 'Corporate Bookings List');
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
