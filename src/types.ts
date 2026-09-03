export type TenantPlan = 'Enterprise' | 'Business Pro' | 'Standard' | 'Custom VIP';
export type TenantRole = 'company_admin' | 'staff' | 'guest';
export type SubscriptionStatus = 'active' | 'trial' | 'past_due' | 'cancelled' | 'Paid Active' | 'Annual Enterprise' | 'Monthly Active' | 'VIP Retainer';

export interface Tenant {
  id: string;
  name: string;
  slug: string; // e.g. "acme", "nexus", "starlight"
  code: string; // e.g. "ACME", "NEXUS"
  description: string;
  domain?: string; // e.g. "acme.com"
  contactEmail: string;
  focalAdminEmails?: string[]; // Designated company focal admins assigned by superadmin
  logoBadge: string; // Icon or initials badge (e.g. "AG", "NC", "SM")
  themeColor: 'indigo' | 'emerald' | 'violet' | 'cyan' | 'amber' | 'rose' | 'blue';
  planTier: TenantPlan;
  createdAt: number;
  active: boolean;
  // Enhanced subscription & admin provisioning details
  subscriptionStatus?: SubscriptionStatus;
  subscriptionAmount?: string; // e.g. "$499/mo", "$4,990/yr"
  billingReference?: string; // e.g. "INV-2026-0881" or "STRIPE-SUB-4910"
  renewalDate?: string; // e.g. "2027-08-20"
  assignedAdminName?: string;
  assignedAdminEmail?: string;
  assignedAdminDepartment?: string;
}

export interface Office {
  id: string;
  tenantId?: string; // Associated corporate tenant
  name: string;
  location: string;
  passkey: string;
  floors: number[]; // e.g. [1, 2, 3, 4]
  createdAt: number;
}

export interface Room {
  id: string;
  tenantId?: string; // Associated corporate tenant
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
  tenantId?: string; // Associated corporate tenant
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
  tenantId?: string; // Associated corporate tenant
  email: string;
  name?: string;
  department?: string;
  addedBy: string;
  addedAt: number;
}

export interface AccessKey {
  id: string;
  tenantId: string; // Tenant ID or 'ALL' for platform super admin key
  token: string; // e.g. "ACME-CORP-2025"
  label: string;
  role?: TenantRole;
  createdBy: string;
  createdAt: number;
  expiresAt?: string; // Optional YYYY-MM-DD
  maxUses?: number;
  usedCount: number;
  active: boolean;
}

export type BlockedDateType = 
  | 'public_holiday' 
  | 'replacement_leave' 
  | 'company_closure' 
  | 'maintenance' 
  | 'other';

export interface BlockedDate {
  id: string;
  tenantId: string; // 'ALL' for global public holidays (super admin), or specific tenantId (e.g. 'tenant-acme')
  date: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (for multi-day holidays/closures)
  title: string; // e.g. "Labor Day", "National Day Replacement Leave"
  type: BlockedDateType;
  description?: string;
  isHardBlock?: boolean; // If true, strictly prevent booking; if false (default), notify/warn user
  importedAt: number;
  importedBy?: string;
  sourceIcsFilename?: string;
  active: boolean;
}

export type AuditActionType = 
  | 'BOOKING_CREATED'
  | 'BOOKING_UPDATED'
  | 'BOOKING_CANCELLED'
  | 'TOKEN_ACCESS_GRANTED'
  | 'ADMIN_ACCESS_GRANTED'
  | 'APPROVED_USER_ADDED'
  | 'APPROVED_USER_REMOVED'
  | 'ACCESS_KEY_GENERATED'
  | 'ACCESS_KEY_REVOKED'
  | 'ROOM_MODIFIED'
  | 'ROOM_DELETED'
  | 'OFFICE_MODIFIED'
  | 'TENANT_CREATED'
  | 'TENANT_UPDATED'
  | 'TENANT_DELETED'
  | 'TENANT_SWITCHED'
  | 'SECURITY_ALERT'
  | 'HOLIDAY_IMPORTED'
  | 'HOLIDAY_CREATED'
  | 'HOLIDAY_UPDATED'
  | 'HOLIDAY_DELETED';

export interface AuditLog {
  id: string;
  tenantId?: string; // Scoped to tenant or 'platform'
  action: AuditActionType;
  actorEmail: string;
  actorName: string;
  actorUid?: string;
  targetTitle?: string;
  roomName?: string;
  floor?: number;
  officeName?: string;
  tenantName?: string;
  bookingDateTime?: string; // e.g. "2026-08-20 from 09:00 to 10:30"
  details: string;
  timestamp: number;
  formattedTimestamp: string;
}

export type PresenceStatus = 'online' | 'in_booking' | 'idle' | 'offline';

export interface ActivePresenceUser {
  id: string; // Session / Presence ID (unique per tab or device)
  sessionId: string;
  uid?: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: TenantRole | 'super_admin';
  tenantId: string;
  tenantName: string;
  tenantCode?: string;
  officeId?: string;
  officeName?: string;
  currentView?: string; // e.g. 'Day Timeline', 'Weekly Grid', 'Floor Plan', 'Room Finder', 'Utilization'
  activeRoomId?: string; // Room ID being viewed or booked
  activeRoomName?: string;
  status: PresenceStatus;
  loginMethod: 'google' | 'token' | 'passkey' | 'guest';
  lastActive: number; // Unix timestamp in ms
  joinedAt: number; // Unix timestamp in ms
  device?: string; // Browser / Platform summary
}

