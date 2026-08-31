// Multi-Window & Inter-Tab Broadcast Sync Engine for Office Meeting Room Synchronization
import { Booking, Office, Room, ApprovedUser, AccessKey, BlockedDate, AuditLog } from '../types';

export type SyncMessageType = 
  | 'SYNC_BOOKINGS'
  | 'SYNC_OFFICES'
  | 'SYNC_ROOMS'
  | 'SYNC_USERS'
  | 'SYNC_KEYS'
  | 'SYNC_BLOCKED_DATES'
  | 'SYNC_AUDIT_LOGS'
  | 'SYNC_PRESENCE'
  | 'PRESENCE_LEAVE'
  | 'BOOKING_CREATED_ALERT'
  | 'BOOKING_CONFLICT_EVENT';

export interface SyncPayload {
  type: SyncMessageType;
  payload: any;
  tenantId?: string;
  senderTabId: string;
  timestamp: number;
}

export const CLIENT_TAB_ID = typeof crypto !== 'undefined' && crypto.randomUUID 
  ? crypto.randomUUID() 
  : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let channelInstance: BroadcastChannel | null = null;
const listeners = new Set<(msg: SyncPayload) => void>();

export function getSyncChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channelInstance) {
    try {
      channelInstance = new BroadcastChannel('office_sync_channel');
      channelInstance.onmessage = (event: MessageEvent<SyncPayload>) => {
        if (!event.data || event.data.senderTabId === CLIENT_TAB_ID) return;
        listeners.forEach(fn => {
          try {
            fn(event.data);
          } catch (err) {
            console.error('Error in sync channel listener:', err);
          }
        });
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported or blocked in this context', e);
      return null;
    }
  }
  return channelInstance;
}

export function subscribeToSyncChannel(callback: (msg: SyncPayload) => void): () => void {
  // Ensure channel is initialized
  getSyncChannel();
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function broadcastMessage(type: SyncMessageType, payload: any, tenantId?: string) {
  const message: SyncPayload = {
    type,
    payload,
    tenantId,
    senderTabId: CLIENT_TAB_ID,
    timestamp: Date.now(),
  };

  try {
    const ch = getSyncChannel();
    if (ch) {
      ch.postMessage(message);
    }
  } catch (e) {
    console.warn('BroadcastChannel postMessage failed:', e);
  }
}
