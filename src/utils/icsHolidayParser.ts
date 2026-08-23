import { BlockedDate, BlockedDateType } from '../types';

export interface ParsedIcsEvent {
  uid?: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  description?: string;
  location?: string;
  type: BlockedDateType;
  isAllDay: boolean;
  rawDtStart?: string;
  rawDtEnd?: string;
}

/**
 * Unfolds RFC 5545 iCalendar content lines
 * Lines starting with a space or tab are continuation of previous lines.
 */
export function unfoldIcsLines(rawIcs: string): string[] {
  const normalized = rawIcs.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = normalized.split('\n');
  const unfolded: string[] = [];

  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.substring(1);
    } else if (line.trim().length > 0) {
      unfolded.push(line.trim());
    }
  }

  return unfolded;
}

/**
 * Parses an iCalendar date string into standard ISO YYYY-MM-DD format
 * Supports:
 * - 20261225
 * - 20261225T000000Z
 * - 20261225T093000
 */
export function parseIcsDateStringToISO(dateStr: string): string | null {
  if (!dateStr) return null;

  // Extract the raw digits portion (strip parameters like TZID=...:)
  const valuePart = dateStr.includes(':') ? dateStr.split(':').pop()! : dateStr;
  const clean = valuePart.trim();

  // Match YYYYMMDD
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;

  const year = match[1];
  const month = match[2];
  const day = match[3];

  return `${year}-${month}-${day}`;
}

/**
 * Decodes escaped characters in iCalendar text properties
 */
export function decodeIcsText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

/**
 * Auto-detects whether the holiday event is a Public Holiday,
 * Replacement Leave / In Lieu Day, Company Closure, or Maintenance.
 */
export function detectBlockedDateType(title: string, description = '', categories = ''): BlockedDateType {
  const combined = `${title} ${description} ${categories}`.toLowerCase();

  // 1. Replacement leave keywords
  if (
    combined.includes('replacement') ||
    combined.includes('in lieu') ||
    combined.includes('in-lieu') ||
    combined.includes('substitute') ||
    combined.includes('off day') ||
    combined.includes('off-in-lieu') ||
    combined.includes('bridge day') ||
    combined.includes('rest day') ||
    combined.includes('compensatory')
  ) {
    return 'replacement_leave';
  }

  // 2. Company closure / shutdown keywords
  if (
    combined.includes('company closure') ||
    combined.includes('office closure') ||
    combined.includes('shut down') ||
    combined.includes('shutdown') ||
    combined.includes('annual shutdown') ||
    combined.includes('renovation') ||
    combined.includes('town hall closure')
  ) {
    return 'company_closure';
  }

  // 3. Facility / Room Maintenance
  if (
    combined.includes('maintenance') ||
    combined.includes('sanitization') ||
    combined.includes('inspection') ||
    combined.includes('system upgrade')
  ) {
    return 'maintenance';
  }

  // 4. Default to public holiday
  return 'public_holiday';
}

/**
 * Parses full iCalendar (.ics) string content into structured events
 */
export function parseIcsContent(rawIcs: string): ParsedIcsEvent[] {
  const lines = unfoldIcsLines(rawIcs);
  const events: ParsedIcsEvent[] = [];

  let inEvent = false;
  let currentEvent: Partial<ParsedIcsEvent> & { categories?: string } = {};

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
      continue;
    }

    if (line === 'END:VEVENT') {
      if (inEvent && currentEvent.title && currentEvent.startDate) {
        const detectedType = currentEvent.type || detectBlockedDateType(
          currentEvent.title,
          currentEvent.description,
          currentEvent.categories
        );

        events.push({
          uid: currentEvent.uid || `evt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          title: currentEvent.title,
          startDate: currentEvent.startDate,
          endDate: currentEvent.endDate,
          description: currentEvent.description,
          location: currentEvent.location,
          type: detectedType,
          isAllDay: currentEvent.isAllDay ?? true,
          rawDtStart: currentEvent.rawDtStart,
          rawDtEnd: currentEvent.rawDtEnd,
        });
      }
      inEvent = false;
      currentEvent = {};
      continue;
    }

    if (!inEvent) continue;

    // Parse VEVENT properties
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const propHeader = line.substring(0, colonIdx);
    const propValue = line.substring(colonIdx + 1);
    const propName = propHeader.split(';')[0].toUpperCase();

    switch (propName) {
      case 'SUMMARY':
        currentEvent.title = decodeIcsText(propValue);
        break;
      case 'DESCRIPTION':
        currentEvent.description = decodeIcsText(propValue);
        break;
      case 'LOCATION':
        currentEvent.location = decodeIcsText(propValue);
        break;
      case 'CATEGORIES':
        currentEvent.categories = decodeIcsText(propValue);
        break;
      case 'UID':
        currentEvent.uid = propValue.trim();
        break;
      case 'DTSTART': {
        currentEvent.rawDtStart = propValue;
        const iso = parseIcsDateStringToISO(line);
        if (iso) currentEvent.startDate = iso;
        currentEvent.isAllDay = !propValue.includes('T');
        break;
      }
      case 'DTEND': {
        currentEvent.rawDtEnd = propValue;
        const iso = parseIcsDateStringToISO(line);
        if (iso) {
          // For all-day events in ICS, DTEND is often non-inclusive (the day after).
          // If DTSTART and DTEND are different by 1 day and time is absent, startDate is the sole day.
          currentEvent.endDate = iso;
        }
        break;
      }
    }
  }

  return events;
}

/**
 * Converts parsed ICS events into BlockedDate entities for storage
 */
export function convertParsedEventsToBlockedDates(
  events: ParsedIcsEvent[],
  options: {
    tenantId: string; // 'ALL' for global public holidays or specific tenant ID
    importedBy: string;
    sourceFilename?: string;
    isHardBlock?: boolean;
  }
): BlockedDate[] {
  const timestamp = Date.now();

  return events.map((evt, idx) => {
    return {
      id: `holiday-${timestamp}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
      tenantId: options.tenantId,
      date: evt.startDate,
      endDate: evt.endDate && evt.endDate !== evt.startDate ? evt.endDate : undefined,
      title: evt.title,
      type: evt.type,
      description: evt.description || (evt.type === 'replacement_leave' ? 'Company Replacement Leave / Day In Lieu' : 'Official Public Holiday'),
      isHardBlock: options.isHardBlock ?? false,
      importedAt: timestamp,
      importedBy: options.importedBy,
      sourceIcsFilename: options.sourceFilename || 'calendar_import.ics',
      active: true,
    };
  });
}

/**
 * Exports a collection of BlockedDate records to standard RFC 5545 .ics calendar format
 */
export function exportBlockedDatesToIcs(
  blockedDates: BlockedDate[],
  calendarName = 'Public Holidays & Company Replacement Leave'
): string {
  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const escapeIcs = (str: string) =>
    (str || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/[\r\n]+/g, '\\n');

  const eventBlocks = blockedDates.map((b) => {
    const cleanDate = b.date.replace(/-/g, '');
    const cleanEndDate = (b.endDate ? b.endDate : b.date).replace(/-/g, '');

    const typeLabel = 
      b.type === 'public_holiday' ? 'Public Holiday' :
      b.type === 'replacement_leave' ? 'Company Replacement Leave' :
      b.type === 'company_closure' ? 'Company Office Closure' : 'Maintenance Window';

    return [
      'BEGIN:VEVENT',
      `UID:${b.id}@officesync.internal`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART;VALUE=DATE:${cleanDate}`,
      `DTEND;VALUE=DATE:${cleanEndDate}`,
      `SUMMARY:${escapeIcs(`[${typeLabel}] ${b.title}`)}`,
      `DESCRIPTION:${escapeIcs(b.description || `${typeLabel} - Workspace Booking Notice`)}`,
      `CATEGORIES:${escapeIcs(typeLabel)}`,
      'STATUS:CONFIRMED',
      'TRANSP:TRANSPARENT',
      'END:VEVENT'
    ].join('\r\n');
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OfficeSync Meeting Room System//Holiday & Leave Import//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    ...eventBlocks,
    'END:VCALENDAR'
  ].join('\r\n');
}

/**
 * Triggers client-side download of generated .ics file
 */
export function triggerIcsDownload(icsContent: string, filename = 'public_holidays_leave.ics') {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Default Seed 2026 Public Holidays and Corporate Replacement Leaves
 */
export const DEFAULT_SEED_BLOCKED_DATES: BlockedDate[] = [
  // Global Public Holidays
  {
    id: 'holiday-2026-001',
    tenantId: 'ALL',
    date: '2026-01-01',
    title: "New Year's Day",
    type: 'public_holiday',
    description: 'Gazetted Public Holiday. Global offices closed.',
    isHardBlock: false,
    importedAt: 1704067200000,
    importedBy: 'System Superadmin',
    sourceIcsFilename: 'global_holidays_2026.ics',
    active: true,
  },
  {
    id: 'holiday-2026-002',
    tenantId: 'ALL',
    date: '2026-02-17',
    endDate: '2026-02-18',
    title: 'Lunar New Year (Spring Festival)',
    type: 'public_holiday',
    description: 'National Public Holiday celebration.',
    isHardBlock: false,
    importedAt: 1704067200000,
    importedBy: 'System Superadmin',
    sourceIcsFilename: 'global_holidays_2026.ics',
    active: true,
  },
  {
    id: 'holiday-2026-003',
    tenantId: 'ALL',
    date: '2026-03-20',
    title: 'Eid al-Fitr (Hari Raya Aidilfitri)',
    type: 'public_holiday',
    description: 'Gazetted Public Holiday celebration.',
    isHardBlock: false,
    importedAt: 1704067200000,
    importedBy: 'System Superadmin',
    sourceIcsFilename: 'global_holidays_2026.ics',
    active: true,
  },
  {
    id: 'holiday-2026-004',
    tenantId: 'ALL',
    date: '2026-05-01',
    title: 'Labour Day / International Workers Day',
    type: 'public_holiday',
    description: 'National Public Holiday.',
    isHardBlock: false,
    importedAt: 1704067200000,
    importedBy: 'System Superadmin',
    sourceIcsFilename: 'global_holidays_2026.ics',
    active: true,
  },
  {
    id: 'holiday-2026-005',
    tenantId: 'ALL',
    date: '2026-08-31',
    title: 'National Independence Day (Merdeka Day)',
    type: 'public_holiday',
    description: 'National Public Holiday celebration.',
    isHardBlock: false,
    importedAt: 1704067200000,
    importedBy: 'System Superadmin',
    sourceIcsFilename: 'global_holidays_2026.ics',
    active: true,
  },
  {
    id: 'holiday-2026-006',
    tenantId: 'ALL',
    date: '2026-09-01',
    title: 'National Day Replacement Leave (In Lieu)',
    type: 'replacement_leave',
    description: 'Gazetted replacement public holiday observed across corporate offices.',
    isHardBlock: false,
    importedAt: 1704067200000,
    importedBy: 'System Superadmin',
    sourceIcsFilename: 'company_leave_calendar_2026.ics',
    active: true,
  },
  {
    id: 'holiday-2026-007',
    tenantId: 'ALL',
    date: '2026-11-08',
    title: 'Deepavali / Festival of Lights',
    type: 'public_holiday',
    description: 'Gazetted Public Holiday celebration.',
    isHardBlock: false,
    importedAt: 1704067200000,
    importedBy: 'System Superadmin',
    sourceIcsFilename: 'global_holidays_2026.ics',
    active: true,
  },
  {
    id: 'holiday-2026-008',
    tenantId: 'ALL',
    date: '2026-11-09',
    title: 'Deepavali Replacement Holiday',
    type: 'replacement_leave',
    description: 'Replacement public holiday in lieu of Sunday festival.',
    isHardBlock: false,
    importedAt: 1704067200000,
    importedBy: 'System Superadmin',
    sourceIcsFilename: 'company_leave_calendar_2026.ics',
    active: true,
  },
  {
    id: 'holiday-2026-009',
    tenantId: 'ALL',
    date: '2026-12-25',
    title: 'Christmas Day',
    type: 'public_holiday',
    description: 'Gazetted Public Holiday.',
    isHardBlock: false,
    importedAt: 1704067200000,
    importedBy: 'System Superadmin',
    sourceIcsFilename: 'global_holidays_2026.ics',
    active: true,
  },
  // Tenant-specific replacement leaves & company shutdowns
  {
    id: 'holiday-acme-001',
    tenantId: 'tenant-acme',
    date: '2026-12-24',
    title: 'Acme Global Christmas Eve Replacement Leave',
    type: 'replacement_leave',
    description: 'Corporate company-wide replacement leave day granted by Acme executive management.',
    isHardBlock: false,
    importedAt: 1704067200000,
    importedBy: 'Sarah Connor (Acme Focal Admin)',
    sourceIcsFilename: 'acme_company_leave_2026.ics',
    active: true,
  },
  {
    id: 'holiday-nexus-001',
    tenantId: 'tenant-nexus',
    date: '2026-06-19',
    title: 'Nexus Capital Juneteenth Observance Leave',
    type: 'replacement_leave',
    description: 'Financial market closure and company replacement leave.',
    isHardBlock: false,
    importedAt: 1704067200000,
    importedBy: 'Elizabeth Vane (Nexus Admin)',
    sourceIcsFilename: 'nexus_leave_2026.ics',
    active: true,
  }
];

/**
 * Sample pre-configured ICS strings for easy instant loading / demonstration
 */
export const SAMPLE_HOLIDAY_ICS_2026 = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Government & Enterprise Holiday System//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:2026 Public Holidays & Corporate Replacement Leaves
BEGIN:VEVENT
UID:ph-2026-01-01@holidays.gov
DTSTART;VALUE=DATE:20260101
DTEND;VALUE=DATE:20260102
SUMMARY:New Year's Day
DESCRIPTION:Gazetted Official Public Holiday
CATEGORIES:Public Holiday
END:VEVENT
BEGIN:VEVENT
UID:ph-2026-02-17@holidays.gov
DTSTART;VALUE=DATE:20260217
DTEND;VALUE=DATE:20260219
SUMMARY:Lunar New Year (Spring Festival)
DESCRIPTION:Gazetted Public Holiday celebration
CATEGORIES:Public Holiday
END:VEVENT
BEGIN:VEVENT
UID:ph-2026-03-20@holidays.gov
DTSTART;VALUE=DATE:20260320
DTEND;VALUE=DATE:20260321
SUMMARY:Hari Raya Aidilfitri / Eid al-Fitr
DESCRIPTION:Gazetted Public Holiday
CATEGORIES:Public Holiday
END:VEVENT
BEGIN:VEVENT
UID:ph-2026-05-01@holidays.gov
DTSTART;VALUE=DATE:20260501
DTEND;VALUE=DATE:20260502
SUMMARY:Labour Day
DESCRIPTION:International Workers Day
CATEGORIES:Public Holiday
END:VEVENT
BEGIN:VEVENT
UID:ph-2026-08-31@holidays.gov
DTSTART;VALUE=DATE:20260831
DTEND;VALUE=DATE:20260901
SUMMARY:National Independence Day
DESCRIPTION:National Day Public Holiday
CATEGORIES:Public Holiday
END:VEVENT
BEGIN:VEVENT
UID:rl-2026-09-01@enterprise.leave
DTSTART;VALUE=DATE:20260901
DTEND;VALUE=DATE:20260902
SUMMARY:National Day Replacement Leave (In Lieu)
DESCRIPTION:Company replacement leave observed across all enterprise divisions
CATEGORIES:Replacement Leave
END:VEVENT
BEGIN:VEVENT
UID:ph-2026-11-08@holidays.gov
DTSTART;VALUE=DATE:20261108
DTEND;VALUE=DATE:20261109
SUMMARY:Deepavali / Festival of Lights
DESCRIPTION:Gazetted Public Holiday
CATEGORIES:Public Holiday
END:VEVENT
BEGIN:VEVENT
UID:rl-2026-11-09@enterprise.leave
DTSTART;VALUE=DATE:20261109
DTEND;VALUE=DATE:20261110
SUMMARY:Deepavali Replacement Leave (In Lieu)
DESCRIPTION:Corporate replacement holiday for Sunday festival
CATEGORIES:Replacement Leave
END:VEVENT
BEGIN:VEVENT
UID:ph-2026-12-25@holidays.gov
DTSTART;VALUE=DATE:20261225
DTEND;VALUE=DATE:20261226
SUMMARY:Christmas Day
DESCRIPTION:Gazetted Public Holiday
CATEGORIES:Public Holiday
END:VEVENT
BEGIN:VEVENT
UID:rl-2026-12-28@enterprise.leave
DTSTART;VALUE=DATE:20261228
DTEND;VALUE=DATE:20261229
SUMMARY:Company Year-End Bridge Replacement Leave
DESCRIPTION:Special discretionary replacement leave approved by corporate executive board
CATEGORIES:Replacement Leave
END:VEVENT
END:VCALENDAR`;
