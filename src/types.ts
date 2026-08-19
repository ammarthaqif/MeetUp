export interface Office {
  id: string;
  name: string;
  location: string;
  passkey: string;
  floors: number[]; // e.g. [1, 2, 3, 4]
  createdAt: number;
}

export interface Room {
  id: string;
  name: string;
  floor: number;
  capacity: number;
  amenities: string[];
  description: string;
  color: string; // Tailwind color name like 'emerald', 'sky', 'amber', etc.
  officeId?: string; // Tethers to an office
}

export interface Booking {
  id: string;
  roomId: string;
  floor: number;
  officeId?: string; // Tethers to an office
  title: string;
  hostName: string;
  hostEmail: string;
  hostUid: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  description: string;
  attendees: string[]; // Email addresses
  googleEventId?: string;
  outlookSynced?: boolean;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
}

export interface ApprovedUser {
  id: string;
  email: string;
  name?: string;
  department?: string;
  addedBy: string;
  addedAt: number;
}

export interface AccessKey {
  id: string;
  token: string;
  label: string;
  createdBy: string;
  createdAt: number;
  expiresAt?: string; // Optional YYYY-MM-DD
  maxUses?: number;
  usedCount: number;
  active: boolean;
}

export type AuditActionType = 
  | 'BOOKING_CREATED'
  | 'BOOKING_UPDATED'
  | 'BOOKING_CANCELLED'
  | 'TOKEN_ACCESS_GRANTED'
  | 'APPROVED_USER_ADDED'
  | 'APPROVED_USER_REMOVED'
  | 'ACCESS_KEY_GENERATED'
  | 'ACCESS_KEY_REVOKED'
  | 'ROOM_MODIFIED'
  | 'ROOM_DELETED'
  | 'OFFICE_MODIFIED';

export interface AuditLog {
  id: string;
  action: AuditActionType;
  actorEmail: string;
  actorName: string;
  actorUid?: string;
  targetTitle?: string;
  roomName?: string;
  floor?: number;
  officeName?: string;
  bookingDateTime?: string; // e.g. "2026-08-20 from 09:00 to 10:30"
  details: string;
  timestamp: number;
  formattedTimestamp: string;
}

