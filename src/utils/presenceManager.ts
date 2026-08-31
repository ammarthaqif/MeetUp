import { db } from '../firebase';
import { doc, setDoc, deleteDoc, onSnapshot, collection } from 'firebase/firestore';
import { ActivePresenceUser, Tenant, Office, TenantRole } from '../types';
import { CLIENT_TAB_ID, broadcastMessage, subscribeToSyncChannel } from './syncChannel';

export const SESSION_TAB_ID = CLIENT_TAB_ID;

/**
 * Generates initial realistic concurrent seed presence records
 */
export function generateDefaultSeedPresence(): ActivePresenceUser[] {
  const now = Date.now();
  return [
    {
      id: 'presence-seed-1',
      sessionId: 'sess-sarah-lin',
      email: 'sarah.lin@acme.corp',
      displayName: 'Sarah Lin',
      role: 'staff',
      tenantId: 'tenant-acme',
      tenantName: 'Acme Corporation',
      tenantCode: 'ACME',
      officeId: 'office-acme-sf',
      officeName: 'San Francisco HQ',
      currentView: 'Day Timeline',
      activeRoomId: 'room-acme-arena',
      activeRoomName: 'The Arena',
      status: 'online',
      loginMethod: 'google',
      lastActive: now - 12000,
      joinedAt: now - 3600000,
      device: 'Desktop Chrome',
    },
    {
      id: 'presence-seed-2',
      sessionId: 'sess-david-chen',
      email: 'david.chen@acme.corp',
      displayName: 'David Chen',
      role: 'company_admin',
      tenantId: 'tenant-acme',
      tenantName: 'Acme Corporation',
      tenantCode: 'ACME',
      officeId: 'office-acme-sf',
      officeName: 'San Francisco HQ',
      currentView: 'Floor Plan (Level 4)',
      status: 'in_booking',
      activeRoomId: 'room-acme-think-tank',
      activeRoomName: 'Think Tank 4A',
      loginMethod: 'token',
      lastActive: now - 5000,
      joinedAt: now - 7200000,
      device: 'MacBook Pro',
    },
    {
      id: 'presence-seed-3',
      sessionId: 'sess-marcus-vance',
      email: 'marcus.v@nexus.tech',
      displayName: 'Marcus Vance',
      role: 'staff',
      tenantId: 'tenant-nexus',
      tenantName: 'Nexus Cybernetics',
      tenantCode: 'NEXUS',
      officeId: 'office-nexus-austin',
      officeName: 'Austin Innovation Hub',
      currentView: 'Room Finder',
      status: 'online',
      loginMethod: 'token',
      lastActive: now - 18000,
      joinedAt: now - 1800000,
      device: 'Linux Workstation',
    },
    {
      id: 'presence-seed-4',
      sessionId: 'sess-elena-rostova',
      email: 'elena.rostova@starlight.media',
      displayName: 'Elena Rostova',
      role: 'company_admin',
      tenantId: 'tenant-starlight',
      tenantName: 'Starlight Creative Group',
      tenantCode: 'STARLIGHT',
      officeId: 'office-starlight-la',
      officeName: 'Los Angeles Studio',
      currentView: 'Weekly Grid',
      status: 'online',
      loginMethod: 'google',
      lastActive: now - 8000,
      joinedAt: now - 5400000,
      device: 'iPad Pro',
    }
  ];
}

/**
 * Prunes stale presence records where last heartbeat was older than 60 seconds.
 */
export function filterActiveSessions(sessions: ActivePresenceUser[], timeoutMs = 60000): ActivePresenceUser[] {
  const cutoff = Date.now() - timeoutMs;
  const map = new Map<string, ActivePresenceUser>();

  sessions.forEach(s => {
    if (s && s.lastActive && s.lastActive >= cutoff && s.status !== 'offline') {
      // Deduplicate by session ID
      map.set(s.id, s);
    }
  });

  return Array.from(map.values()).sort((a, b) => b.lastActive - a.lastActive);
}

/**
 * Creates or updates presence state for the current staff member in Firestore & BroadcastChannel.
 */
export async function pushPresenceHeartbeat(
  userPresence: ActivePresenceUser
): Promise<void> {
  const sanitized: Record<string, any> = {
    id: userPresence.id,
    sessionId: userPresence.sessionId || userPresence.id,
    email: (userPresence.email || 'staff@enterprise.internal').trim().toLowerCase(),
    displayName: (userPresence.displayName || 'Staff Member').trim(),
    role: userPresence.role || 'staff',
    tenantId: userPresence.tenantId || 'tenant-acme',
    tenantName: userPresence.tenantName || 'Workspace Organization',
    status: userPresence.status || 'online',
    loginMethod: userPresence.loginMethod || 'guest',
    lastActive: Date.now(),
    joinedAt: userPresence.joinedAt || Date.now(),
    device: userPresence.device || (typeof navigator !== 'undefined' ? (navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop Browser') : 'Desktop'),
  };

  if (userPresence.photoURL) sanitized.photoURL = userPresence.photoURL;
  if (userPresence.tenantCode) sanitized.tenantCode = userPresence.tenantCode;
  if (userPresence.officeId) sanitized.officeId = userPresence.officeId;
  if (userPresence.officeName) sanitized.officeName = userPresence.officeName;
  if (userPresence.currentView) sanitized.currentView = userPresence.currentView;
  if (userPresence.activeRoomId) sanitized.activeRoomId = userPresence.activeRoomId;
  if (userPresence.activeRoomName) sanitized.activeRoomName = userPresence.activeRoomName;
  if (userPresence.uid) sanitized.uid = userPresence.uid;

  // Broadcast to local tabs/windows
  broadcastMessage('SYNC_PRESENCE', sanitized, userPresence.tenantId);

  // Sync to Firestore
  if (db) {
    try {
      await Promise.race([
        Promise.allSettled([
          setDoc(doc(db, 'presence', userPresence.id), sanitized, { merge: true }),
          setDoc(doc(db, 'tenants', userPresence.tenantId, 'presence', userPresence.id), sanitized, { merge: true })
        ]),
        new Promise((resolve) => setTimeout(resolve, 2000))
      ]);
    } catch (e) {
      console.warn('Presence write error fallback:', e);
    }
  }
}

/**
 * Removes presence upon tab closure or logout
 */
export async function removePresenceSession(sessionId: string, tenantId?: string): Promise<void> {
  broadcastMessage('PRESENCE_LEAVE', { id: sessionId }, tenantId);

  if (db) {
    try {
      await Promise.race([
        Promise.allSettled([
          deleteDoc(doc(db, 'presence', sessionId)),
          tenantId ? deleteDoc(doc(db, 'tenants', tenantId, 'presence', sessionId)) : Promise.resolve()
        ]),
        new Promise((resolve) => setTimeout(resolve, 1500))
      ]);
    } catch {}
  }
}
