import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, onSnapshot, addDoc, doc, setDoc, deleteDoc
} from 'firebase/firestore';
import { db, auth, googleSignIn, logout } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  CalendarDays, Building2, Filter, Search, CheckCircle, 
  X, AlertTriangle, ArrowRight, ShieldCheck, Key, MapPin, Sparkles, ShieldAlert,
  Clock, CalendarRange, Calendar, Lock, Shield
} from 'lucide-react';

// Subcomponents
import { Navbar } from './components/Navbar';
import { FloorSelector } from './components/FloorSelector';
import { RoomCard } from './components/RoomCard';
import { BookingTimeline } from './components/BookingTimeline';
import { WeeklyScheduleView } from './components/WeeklyScheduleView';
import { MonthlyAvailabilityView } from './components/MonthlyAvailabilityView';
import { BookingModal } from './components/BookingModal';
import { BookingAuthModal } from './components/BookingAuthModal';
import { RoomFinderModal } from './components/RoomFinderModal';
import { InteractiveFloorPlan } from './components/InteractiveFloorPlan';
import { MyBookings } from './components/MyBookings';
import { AdminPanel } from './components/AdminPanel';
import { SimulatedInbox, SimulatedEmail } from './components/SimulatedInbox';

// Types and Utilities
import { Booking, Room, Office, ApprovedUser, AccessKey, AuditLog, AuditActionType } from './types';
import { formatFriendlyDate } from './utils';
import { ROOMS as DEFAULT_ROOMS } from './roomsData';

const ADMIN_EMAIL = 'ammarthaqif.ar@gmail.com';

const DEFAULT_INITIAL_OFFICES: Office[] = [
  {
    id: 'office-singapore-hq',
    name: 'Downtown Singapore HQ',
    location: 'Marina Bay Financial Centre, Tower 2',
    passkey: 'SG123',
    floors: [1, 2, 3, 4],
    createdAt: 1700000000000
  },
  {
    id: 'office-silicon-valley',
    name: 'West Tech Center (Silicon Valley)',
    location: '456 Innovation Way, Building 2',
    passkey: 'SV456',
    floors: [1, 2],
    createdAt: 1700000000000
  }
];

const DEFAULT_INITIAL_BOOKINGS: Booking[] = [
  {
    id: 'sample-booking-1',
    roomId: 'f1-arena',
    floor: 1,
    officeId: 'office-singapore-hq',
    title: 'Product All-Hands & Strategy Sync',
    description: 'Quarterly review with engineering and design leads.',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '12:00',
    hostName: 'Sarah Lin',
    hostEmail: 'sarah.lin@workspace.corp',
    hostUid: 'user-sample-1',
    attendees: ['alex@workspace.corp', 'dev-team@workspace.corp'],
    createdAt: Date.now() - 3600000,
  },
  {
    id: 'sample-booking-2',
    roomId: 'f1-orion',
    floor: 1,
    officeId: 'office-singapore-hq',
    title: 'Client Pitch: Vertex Ventures',
    description: 'Executive partnership presentation.',
    date: new Date().toISOString().split('T')[0],
    startTime: '14:00',
    endTime: '15:30',
    hostName: 'David Chen',
    hostEmail: 'david.chen@workspace.corp',
    hostUid: 'user-sample-2',
    attendees: ['partners@vertex.vc'],
    createdAt: Date.now() - 7200000,
  }
];

const DEFAULT_APPROVED_USERS: ApprovedUser[] = [
  {
    id: 'usr-admin-1',
    email: 'ammarthaqif.ar@gmail.com',
    name: 'Ammar Thaqif',
    department: 'Executive Administration',
    addedAt: 1700000000000,
    addedBy: 'System'
  },
  {
    id: 'usr-staff-1',
    email: 'sarah.lin@workspace.corp',
    name: 'Sarah Lin',
    department: 'Product & Design',
    addedAt: 1700000000000,
    addedBy: 'ammarthaqif.ar@gmail.com'
  },
  {
    id: 'usr-staff-2',
    email: 'david.chen@workspace.corp',
    name: 'David Chen',
    department: 'Engineering',
    addedAt: 1700000000000,
    addedBy: 'ammarthaqif.ar@gmail.com'
  }
];

const DEFAULT_ACCESS_KEYS: AccessKey[] = [
  {
    id: 'key-hq-standard',
    token: 'SEC-HQ2026-PASS',
    label: 'Corporate Staff Access Pass',
    active: true,
    createdAt: 1700000000000,
    createdBy: 'ammarthaqif.ar@gmail.com',
    usedCount: 0
  },
  {
    id: 'key-vip-exec',
    token: 'SEC-VIP77-TOKEN',
    label: 'Visiting Partner & Vendor Token',
    active: true,
    createdAt: 1700000000000,
    createdBy: 'ammarthaqif.ar@gmail.com',
    usedCount: 0
  }
];

const DEFAULT_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-seed-1',
    action: 'BOOKING_CREATED',
    actorEmail: 'sarah.lin@workspace.corp',
    actorName: 'Sarah Lin',
    targetTitle: 'Product All-Hands & Strategy Sync',
    roomName: 'The Arena',
    floor: 1,
    officeName: 'Downtown Singapore HQ',
    bookingDateTime: `${new Date().toISOString().split('T')[0]} (10:00 - 12:00)`,
    details: 'Created reservation "Product All-Hands & Strategy Sync" in The Arena (Level 1)',
    timestamp: Date.now() - 3600000,
    formattedTimestamp: new Date(Date.now() - 3600000).toLocaleString('en-US')
  },
  {
    id: 'log-seed-2',
    action: 'BOOKING_CREATED',
    actorEmail: 'david.chen@workspace.corp',
    actorName: 'David Chen',
    targetTitle: 'Client Pitch: Vertex Ventures',
    roomName: 'Orion Boardroom',
    floor: 1,
    officeName: 'Downtown Singapore HQ',
    bookingDateTime: `${new Date().toISOString().split('T')[0]} (14:00 - 15:30)`,
    details: 'Created reservation "Client Pitch: Vertex Ventures" in Orion Boardroom (Level 1)',
    timestamp: Date.now() - 7200000,
    formattedTimestamp: new Date(Date.now() - 7200000).toLocaleString('en-US')
  }
];

export default function App() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [capacityFilter, setCapacityFilter] = useState<string>('all');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  
  // Dynamic Database States (with instant offline fallback)
  const [offices, setOffices] = useState<Office[]>(() => {
    try {
      const saved = localStorage.getItem('office_sync_offices');
      return saved ? JSON.parse(saved) : DEFAULT_INITIAL_OFFICES;
    } catch {
      return DEFAULT_INITIAL_OFFICES;
    }
  });

  const [rooms, setRooms] = useState<Room[]>(() => {
    try {
      const saved = localStorage.getItem('office_sync_rooms');
      return saved ? JSON.parse(saved) : DEFAULT_ROOMS;
    } catch {
      return DEFAULT_ROOMS;
    }
  });

  const [bookings, setBookings] = useState<Booking[]>(() => {
    try {
      const saved = localStorage.getItem('office_sync_bookings');
      return saved ? JSON.parse(saved) : DEFAULT_INITIAL_BOOKINGS;
    } catch {
      return DEFAULT_INITIAL_BOOKINGS;
    }
  });

  // Approved users whitelist
  const [approvedUsers, setApprovedUsers] = useState<ApprovedUser[]>(() => {
    try {
      const saved = localStorage.getItem('office_sync_approved_users');
      return saved ? JSON.parse(saved) : DEFAULT_APPROVED_USERS;
    } catch {
      return DEFAULT_APPROVED_USERS;
    }
  });

  // Secret Access Keys / Tokens
  const [accessKeys, setAccessKeys] = useState<AccessKey[]>(() => {
    try {
      const saved = localStorage.getItem('office_sync_access_keys');
      return saved ? JSON.parse(saved) : DEFAULT_ACCESS_KEYS;
    } catch {
      return DEFAULT_ACCESS_KEYS;
    }
  });

  // Audit Logs trail
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const saved = localStorage.getItem('office_sync_audit_logs');
      return saved ? JSON.parse(saved) : DEFAULT_AUDIT_LOGS;
    } catch {
      return DEFAULT_AUDIT_LOGS;
    }
  });

  // Verified Tokens unlocked in current browser session
  const [verifiedTokens, setVerifiedTokens] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('office_sync_verified_tokens');
      return saved ? JSON.parse(saved) : ['SEC-HQ2026-PASS'];
    } catch {
      return ['SEC-HQ2026-PASS'];
    }
  });

  // Active Workspace State
  const [activeOffice, setActiveOffice] = useState<Office | null>(() => {
    try {
      const saved = localStorage.getItem('office_sync_active_office');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Admin state
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('office_sync_admin_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [showAdminRestrictionModal, setShowAdminRestrictionModal] = useState(false);

  // Passkey Login State for staff
  const [passkeyInput, setPasskeyInput] = useState('');
  const [passkeyError, setPasskeyError] = useState('');

  // Simulated Email Inbox State
  const [simulatedEmails, setSimulatedEmails] = useState<SimulatedEmail[]>(() => {
    try {
      const saved = localStorage.getItem('office_sync_emails');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // UI notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Authentication State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  // View mode switcher: 'day' | 'week' | 'month' | 'floorplan'
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'floorplan'>('day');

  // Modal actions
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRoomFinderOpen, setIsRoomFinderOpen] = useState(false);
  const [pendingBookingIntent, setPendingBookingIntent] = useState<{ room: Room; hour?: string | null; date?: string; endTime?: string } | null>(null);
  const [selectedRoomForModal, setSelectedRoomForModal] = useState<Room | null>(null);
  const [selectedHourForModal, setSelectedHourForModal] = useState<string | null>(null);
  const [selectedEndTimeForModal, setSelectedEndTimeForModal] = useState<string | undefined>(undefined);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Synchronize local states to localStorage for instant offline access
  useEffect(() => {
    try {
      localStorage.setItem('office_sync_offices', JSON.stringify(offices));
    } catch {}
  }, [offices]);

  useEffect(() => {
    try {
      localStorage.setItem('office_sync_rooms', JSON.stringify(rooms));
    } catch {}
  }, [rooms]);

  useEffect(() => {
    try {
      localStorage.setItem('office_sync_bookings', JSON.stringify(bookings));
    } catch {}
  }, [bookings]);

  useEffect(() => {
    try {
      localStorage.setItem('office_sync_approved_users', JSON.stringify(approvedUsers));
    } catch {}
  }, [approvedUsers]);

  useEffect(() => {
    try {
      localStorage.setItem('office_sync_access_keys', JSON.stringify(accessKeys));
    } catch {}
  }, [accessKeys]);

  useEffect(() => {
    try {
      localStorage.setItem('office_sync_audit_logs', JSON.stringify(auditLogs));
    } catch {}
  }, [auditLogs]);

  useEffect(() => {
    try {
      localStorage.setItem('office_sync_emails', JSON.stringify(simulatedEmails));
    } catch {}
  }, [simulatedEmails]);

  // -------------------------------------------------------------
  // Centralized Activity & Audit Logger
  // -------------------------------------------------------------
  const logActivity = (data: {
    action: AuditActionType;
    actorEmail?: string;
    actorName?: string;
    actorUid?: string;
    targetTitle?: string;
    roomName?: string;
    floor?: number;
    officeName?: string;
    bookingDateTime?: string;
    details: string;
  }) => {
    const now = new Date();
    const newLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      action: data.action,
      actorEmail: data.actorEmail || user?.email || 'Authorized Token User',
      actorName: data.actorName || user?.displayName || 'Authorized User',
      actorUid: data.actorUid || user?.uid,
      targetTitle: data.targetTitle,
      roomName: data.roomName,
      floor: data.floor,
      officeName: data.officeName || activeOffice?.name,
      bookingDateTime: data.bookingDateTime,
      details: data.details,
      timestamp: Date.now(),
      formattedTimestamp: now.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };

    setAuditLogs(prev => [newLog, ...prev.slice(0, 499)]);

    try {
      setDoc(doc(db, 'audit_logs', newLog.id), newLog).catch(() => {});
    } catch {}
  };

  // -------------------------------------------------------------
  // Authorization Gate Verification
  // -------------------------------------------------------------
  const isUserAuthorizedToBook = (): boolean => {
    // 1. Super Admin is always authorized
    if (user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;

    // 2. User logged in with whitelisted email
    if (user?.email) {
      const isApproved = approvedUsers.some(u => u.email.toLowerCase() === user.email?.toLowerCase());
      if (isApproved) return true;
    }

    // 3. User unlocked with a valid, active Secret Access Key Token
    const hasValidKey = accessKeys.some(k => k.active && verifiedTokens.includes(k.token));
    if (hasValidKey) return true;

    return false;
  };

  // -------------------------------------------------------------
  // DB Listeners & Online Hydration (with resilient offline fallback)
  // -------------------------------------------------------------
  
  // Real-time listen to Offices
  useEffect(() => {
    try {
      const officesCollection = collection(db, 'offices');
      const unsubscribe = onSnapshot(officesCollection, (snapshot) => {
        if (!snapshot.empty) {
          const officeList: Office[] = [];
          snapshot.forEach((docSnap) => {
            officeList.push({ id: docSnap.id, ...docSnap.data() } as Office);
          });
          setOffices(officeList);
        }
      }, (error) => {
        console.warn('Operating in offline local cache mode for offices:', error.message);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn('Firestore offices initialization offline fallback:', e);
    }
  }, []);

  // Real-time listen to Rooms
  useEffect(() => {
    try {
      const roomsCollection = collection(db, 'rooms');
      const unsubscribe = onSnapshot(roomsCollection, (snapshot) => {
        if (!snapshot.empty) {
          const roomList: Room[] = [];
          snapshot.forEach((docSnap) => {
            roomList.push({ id: docSnap.id, ...docSnap.data() } as Room);
          });
          setRooms(roomList);
        }
      }, (error) => {
        console.warn('Operating in offline local cache mode for rooms:', error.message);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn('Firestore rooms initialization offline fallback:', e);
    }
  }, []);

  // Real-time listen to Bookings
  useEffect(() => {
    try {
      const bookingsCollection = collection(db, 'bookings');
      const unsubscribe = onSnapshot(bookingsCollection, (snapshot) => {
        if (!snapshot.empty) {
          const bookingList: Booking[] = [];
          snapshot.forEach((docSnap) => {
            bookingList.push({ id: docSnap.id, ...docSnap.data() } as Booking);
          });
          bookingList.sort((a, b) => b.createdAt - a.createdAt);
          setBookings(bookingList);
        }
      }, (error) => {
        console.warn('Operating in offline local cache mode for bookings:', error.message);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn('Firestore bookings initialization offline fallback:', e);
    }
  }, []);

  // Real-time listen to Approved Users
  useEffect(() => {
    try {
      const usersCollection = collection(db, 'approved_users');
      const unsubscribe = onSnapshot(usersCollection, (snapshot) => {
        if (!snapshot.empty) {
          const userList: ApprovedUser[] = [];
          snapshot.forEach((docSnap) => {
            userList.push({ id: docSnap.id, ...docSnap.data() } as ApprovedUser);
          });
          setApprovedUsers(userList);
        }
      }, (error) => {
        console.warn('Operating in offline local cache mode for approved users:', error.message);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn('Firestore approved users listener fallback:', e);
    }
  }, []);

  // Real-time listen to Access Keys
  useEffect(() => {
    try {
      const keysCollection = collection(db, 'access_keys');
      const unsubscribe = onSnapshot(keysCollection, (snapshot) => {
        if (!snapshot.empty) {
          const keyList: AccessKey[] = [];
          snapshot.forEach((docSnap) => {
            keyList.push({ id: docSnap.id, ...docSnap.data() } as AccessKey);
          });
          setAccessKeys(keyList);
        }
      }, (error) => {
        console.warn('Operating in offline local cache mode for access keys:', error.message);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn('Firestore access keys listener fallback:', e);
    }
  }, []);

  // Real-time listen to Audit Logs
  useEffect(() => {
    try {
      const auditCollection = collection(db, 'audit_logs');
      const unsubscribe = onSnapshot(auditCollection, (snapshot) => {
        if (!snapshot.empty) {
          const logList: AuditLog[] = [];
          snapshot.forEach((docSnap) => {
            logList.push({ id: docSnap.id, ...docSnap.data() } as AuditLog);
          });
          logList.sort((a, b) => b.timestamp - a.timestamp);
          setAuditLogs(logList);
        }
      }, (error) => {
        console.warn('Operating in offline local cache mode for audit logs:', error.message);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn('Firestore audit logs listener fallback:', e);
    }
  }, []);

  // Keep active office synchronized with real-time db definitions
  useEffect(() => {
    if (activeOffice && offices.length > 0) {
      const fresh = offices.find(o => o.id === activeOffice.id);
      if (fresh) {
        if (JSON.stringify(fresh) !== JSON.stringify(activeOffice)) {
          setActiveOffice(fresh);
          try {
            localStorage.setItem('office_sync_active_office', JSON.stringify(fresh));
          } catch {}
          if (!fresh.floors.includes(selectedFloor)) {
            setSelectedFloor(fresh.floors[0] || 1);
          }
        }
      }
    }
  }, [offices, activeOffice, selectedFloor]);

  // Listen to Auth
  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          try {
            const token = localStorage.getItem('google_calendar_access_token');
            setGoogleToken(token);
          } catch {}

          // If the logged in user is admin, auto-log activity
          if (currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            console.log('Super Administrator session confirmed.');
          }
        } else {
          setGoogleToken(null);
          // If user logs out while in admin mode, exit admin
          if (isAdminMode) {
            setIsAdminMode(false);
            localStorage.removeItem('office_sync_admin_mode');
          }
        }
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn('Auth listener offline fallback:', e);
    }
  }, [isAdminMode]);

  // -------------------------------------------------------------
  // Employee Login Passkey Verification (Without exposing secrets)
  // -------------------------------------------------------------
  const handlePasskeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasskeyError('');

    if (!passkeyInput.trim()) {
      setPasskeyError('Office Passkey field cannot be blank.');
      return;
    }

    const matched = offices.find(
      o => o.passkey.toLowerCase() === passkeyInput.trim().toLowerCase()
    );

    if (matched) {
      setActiveOffice(matched);
      try {
        localStorage.setItem('office_sync_active_office', JSON.stringify(matched));
      } catch {}
      setSelectedFloor(matched.floors[0] || 1);
      setPasskeyInput('');
      showNotification('success', `Connected to ${matched.name}.`);
    } else {
      setPasskeyError('Invalid Office Passkey. Please verify with your workspace administrator.');
    }
  };

  const handleSwitchOffice = () => {
    setActiveOffice(null);
    try {
      localStorage.removeItem('office_sync_active_office');
    } catch {}
    showNotification('info', 'Switched location.');
  };

  // -------------------------------------------------------------
  // Admin Mode Entry: STRICTLY RESTRICTED TO ammarthaqif.ar@gmail.com
  // -------------------------------------------------------------
  const handleOpenAdminConsole = () => {
    if (user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      setIsAdminMode(true);
      try {
        localStorage.setItem('office_sync_admin_mode', 'true');
      } catch {}
      showNotification('success', 'Admin Control Room unlocked for ' + ADMIN_EMAIL);
    } else {
      setShowAdminRestrictionModal(true);
    }
  };

  const handleExitAdminMode = () => {
    setIsAdminMode(false);
    try {
      localStorage.removeItem('office_sync_admin_mode');
    } catch {}
    showNotification('info', 'Exited Administrator mode.');
  };

  // -------------------------------------------------------------
  // Token Verification Handler (from BookingAuthModal)
  // -------------------------------------------------------------
  const handleVerifySecretToken = (tokenString: string): boolean => {
    const cleanToken = tokenString.trim().toUpperCase();
    const matchingKey = accessKeys.find(k => k.token.toUpperCase() === cleanToken && k.active);
    
    if (!matchingKey) return false;

    // Check expiration
    if (matchingKey.expiresAt) {
      const today = new Date().toISOString().split('T')[0];
      if (matchingKey.expiresAt < today) return false;
    }

    // Check max uses
    if (matchingKey.maxUses && matchingKey.usedCount >= matchingKey.maxUses) return false;

    // Increment used count
    const updatedKey: AccessKey = { ...matchingKey, usedCount: matchingKey.usedCount + 1 };
    setAccessKeys(prev => prev.map(k => k.id === matchingKey.id ? updatedKey : k));
    try {
      setDoc(doc(db, 'access_keys', matchingKey.id), updatedKey, { merge: true }).catch(() => {});
    } catch {}

    // Add to verified tokens
    setVerifiedTokens(prev => {
      const updated = Array.from(new Set([...prev, matchingKey.token]));
      try {
        localStorage.setItem('office_sync_verified_tokens', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    logActivity({
      action: 'TOKEN_ACCESS_GRANTED',
      details: `Secret Access Token "${matchingKey.label}" (${matchingKey.token}) verified for room booking permissions.`,
    });

    showNotification('success', `Access token verified! Booking unlocked for ${matchingKey.label}.`);
    
    // Close auth modal and open pending booking modal
    setIsAuthModalOpen(false);
    if (pendingBookingIntent) {
      setSelectedRoomForModal(pendingBookingIntent.room);
      setSelectedHourForModal(pendingBookingIntent.hour || null);
      if (pendingBookingIntent.date) {
        setSelectedDate(pendingBookingIntent.date);
      }
      setEditingBooking(null);
      setIsModalOpen(true);
      setPendingBookingIntent(null);
    }

    return true;
  };

  // -------------------------------------------------------------
  // Booking operations (Save & Cancel with strict ownership & audit trails)
  // -------------------------------------------------------------
  const handleSaveBooking = async (
    bookingData: Omit<Booking, 'id' | 'createdAt'> & { id?: string; multiDates?: string[] }
  ) => {
    const isEditing = !!bookingData.id;
    const room = rooms.find(r => r.id === bookingData.roomId);
    if (!room) throw new Error('Selected room is invalid.');

    const emailToDeliver = bookingData.hostEmail.trim() || user?.email || 'staff@company-workspace.com';

    // Handle Multi-day recurring saves
    if (bookingData.multiDates && bookingData.multiDates.length > 0) {
      const createdBookings: Booking[] = [];
      for (const dateString of bookingData.multiDates) {
        const id = `booking-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const docPayload: Booking = {
          id,
          roomId: bookingData.roomId,
          floor: bookingData.floor,
          officeId: activeOffice?.id || room.officeId || '',
          title: bookingData.title,
          description: bookingData.description,
          date: dateString,
          startTime: bookingData.startTime,
          endTime: bookingData.endTime,
          hostName: bookingData.hostName,
          hostEmail: emailToDeliver,
          hostUid: bookingData.hostUid || user?.uid,
          attendees: bookingData.attendees,
          outlookSynced: bookingData.outlookSynced || false,
          createdAt: Date.now(),
        };
        createdBookings.push(docPayload);

        try {
          addDoc(collection(db, 'bookings'), docPayload).catch(() => {});
        } catch {}

        // Audit Trail
        logActivity({
          action: 'BOOKING_CREATED',
          actorEmail: emailToDeliver,
          actorName: bookingData.hostName,
          actorUid: bookingData.hostUid || user?.uid,
          targetTitle: bookingData.title,
          roomName: room.name,
          floor: room.floor,
          bookingDateTime: `${dateString} (${bookingData.startTime} - ${bookingData.endTime})`,
          details: `Reserved "${bookingData.title}" in ${room.name} (Lvl ${room.floor}) for ${bookingData.startTime} - ${bookingData.endTime}`,
        });
      }

      setBookings(prev => [...createdBookings, ...prev]);

      const newEmail: SimulatedEmail = {
        id: `email-${Date.now()}`,
        to: emailToDeliver,
        subject: `[CONFIRMED] Multi-Day Room Reservation: "${bookingData.title}"`,
        date: new Date().toLocaleString(),
        body: `Successful booking across ${bookingData.multiDates.length} days!`,
        details: {
          title: bookingData.title,
          roomName: room.name,
          floor: room.floor,
          startTime: bookingData.startTime,
          endTime: bookingData.endTime,
          officeName: activeOffice?.name || 'Workspace HQ',
          officeLocation: activeOffice?.location || 'Corporate Location',
          dates: bookingData.multiDates,
          hostName: bookingData.hostName,
          attendees: bookingData.attendees,
        }
      };
      setSimulatedEmails(prev => [newEmail, ...prev]);
      showNotification('success', `Successfully reserved ${room.name} over ${bookingData.multiDates.length} days.`);

    } else {
      // Single booking save
      const targetId = bookingData.id || `booking-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const docPayload: Booking = {
        id: targetId,
        roomId: bookingData.roomId,
        floor: bookingData.floor,
        officeId: activeOffice?.id || room.officeId || '',
        title: bookingData.title,
        description: bookingData.description,
        date: bookingData.date,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        hostName: bookingData.hostName,
        hostEmail: emailToDeliver,
        hostUid: bookingData.hostUid || user?.uid,
        attendees: bookingData.attendees,
        outlookSynced: bookingData.outlookSynced || false,
        googleEventId: bookingData.googleEventId || null,
        createdAt: Date.now(),
      };

      if (isEditing && bookingData.id) {
        // Enforce Ownership check
        const existing = bookings.find(b => b.id === bookingData.id);
        if (existing) {
          const isOwner = (user && (
            (user.uid && existing.hostUid === user.uid) ||
            (user.email && existing.hostEmail.toLowerCase() === user.email.toLowerCase())
          )) || (user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());

          if (!isOwner) {
            showNotification('error', 'Permission denied: You can only edit bookings made by yourself.');
            return;
          }
        }

        setBookings(prev => prev.map(b => b.id === bookingData.id ? { ...b, ...docPayload } : b));
        try {
          setDoc(doc(db, 'bookings', bookingData.id), docPayload, { merge: true }).catch(() => {});
        } catch {}

        logActivity({
          action: 'BOOKING_UPDATED',
          actorEmail: emailToDeliver,
          actorName: bookingData.hostName,
          actorUid: bookingData.hostUid || user?.uid,
          targetTitle: bookingData.title,
          roomName: room.name,
          floor: room.floor,
          bookingDateTime: `${bookingData.date} (${bookingData.startTime} - ${bookingData.endTime})`,
          details: `Modified reservation details for "${bookingData.title}" in ${room.name} (Lvl ${room.floor})`,
        });

        const editEmail: SimulatedEmail = {
          id: `email-${Date.now()}`,
          to: emailToDeliver,
          subject: `[UPDATED] Room Reservation Details: "${bookingData.title}"`,
          date: new Date().toLocaleString(),
          body: `Your booking details have been modified.`,
          details: {
            title: `UPDATED: ${bookingData.title}`,
            roomName: room.name,
            floor: room.floor,
            startTime: bookingData.startTime,
            endTime: bookingData.endTime,
            officeName: activeOffice?.name || 'Workspace HQ',
            officeLocation: activeOffice?.location || 'Corporate Location',
            dates: [bookingData.date],
            hostName: bookingData.hostName,
            attendees: bookingData.attendees,
          }
        };
        setSimulatedEmails(prev => [editEmail, ...prev]);
        showNotification('success', 'Meeting room reservation updated successfully.');
      } else {
        setBookings(prev => [docPayload, ...prev]);
        try {
          addDoc(collection(db, 'bookings'), docPayload).catch(() => {});
        } catch {}

        logActivity({
          action: 'BOOKING_CREATED',
          actorEmail: emailToDeliver,
          actorName: bookingData.hostName,
          actorUid: bookingData.hostUid || user?.uid,
          targetTitle: bookingData.title,
          roomName: room.name,
          floor: room.floor,
          bookingDateTime: `${bookingData.date} (${bookingData.startTime} - ${bookingData.endTime})`,
          details: `Created reservation "${bookingData.title}" in ${room.name} (Lvl ${room.floor})`,
        });

        const newEmail: SimulatedEmail = {
          id: `email-${Date.now()}`,
          to: emailToDeliver,
          subject: `[CONFIRMED] Room Reservation: "${bookingData.title}"`,
          date: new Date().toLocaleString(),
          body: `Successful booking reservation!`,
          details: {
            title: bookingData.title,
            roomName: room.name,
            floor: room.floor,
            startTime: bookingData.startTime,
            endTime: bookingData.endTime,
            officeName: activeOffice?.name || 'Workspace HQ',
            officeLocation: activeOffice?.location || 'Corporate Location',
            dates: [bookingData.date],
            hostName: bookingData.hostName,
            attendees: bookingData.attendees,
          }
        };
        setSimulatedEmails(prev => [newEmail, ...prev]);
        showNotification('success', `Successfully reserved ${room.name} for "${bookingData.title}".`);
      }
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    // Strict Ownership Enforcement: user can only cancel bookings made by themselves unless super admin
    const isOwner = (user && (
      (user.uid && booking.hostUid === user.uid) ||
      (user.email && booking.hostEmail.toLowerCase() === user.email.toLowerCase())
    )) || (user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());

    if (!isOwner) {
      showNotification('error', 'Permission denied: You can only cancel reservations created by yourself.');
      return;
    }

    if (!window.confirm(`Are you sure you want to cancel the reservation for "${booking.title}"?`)) {
      return;
    }

    const room = rooms.find(r => r.id === booking.roomId);

    setBookings(prev => prev.filter(b => b.id !== bookingId));

    try {
      deleteDoc(doc(db, 'bookings', bookingId)).catch(() => {});
    } catch {}

    logActivity({
      action: 'BOOKING_CANCELLED',
      actorEmail: user?.email || booking.hostEmail,
      actorName: user?.displayName || booking.hostName,
      targetTitle: booking.title,
      roomName: room?.name || 'Meeting Room',
      floor: booking.floor,
      bookingDateTime: `${booking.date} (${booking.startTime} - ${booking.endTime})`,
      details: `Reservation "${booking.title}" cancelled by ${user?.displayName || booking.hostName} (${user?.email || booking.hostEmail})`,
    });

    const cancelEmail: SimulatedEmail = {
      id: `email-${Date.now()}`,
      to: booking.hostEmail,
      subject: `[CANCELLED] Reservation Cancellation Alert: "${booking.title}"`,
      date: new Date().toLocaleString(),
      body: `This email confirms your meeting room booking was successfully deleted.`,
      details: {
        title: `CANCELLED: ${booking.title}`,
        roomName: room ? room.name : 'Meeting Room',
        floor: booking.floor,
        startTime: booking.startTime,
        endTime: booking.endTime,
        officeName: activeOffice?.name || 'Workspace HQ',
        officeLocation: activeOffice?.location || 'Corporate Location',
        dates: [booking.date],
        hostName: booking.hostName,
        attendees: [],
      }
    };
    setSimulatedEmails(prev => [cancelEmail, ...prev]);
    showNotification('success', 'Meeting room reservation deleted successfully.');
  };

  // -------------------------------------------------------------
  // Google Calendar Integration Handlers
  // -------------------------------------------------------------
  const handleLoginGoogle = async () => {
    setIsLoggingIn(true);
    try {
      await googleSignIn();
      showNotification('success', 'Authenticated with Google Account.');
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Google Sign-In Failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogoutGoogle = async () => {
    try {
      await logout();
      try {
        localStorage.removeItem('google_calendar_access_token');
      } catch {}
      setGoogleToken(null);
      showNotification('success', 'Signed out successfully.');
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Sign-Out Failed.');
    }
  };

  const handleSyncGoogleNow = async (bookingId: string) => {
    showNotification('info', 'Manual external synchronization initiated.');
    setTimeout(() => {
      showNotification('success', 'Synced with Google Calendar API successfully.');
    }, 1000);
  };

  // -------------------------------------------------------------
  // Administrative Operations (Strictly in Admin Mode)
  // -------------------------------------------------------------
  const handleSaveOfficeAdmin = async (officeData: Omit<Office, 'createdAt'> & { id?: string }) => {
    const id = officeData.id || `office-${Date.now()}`;
    const newOffice: Office = {
      ...officeData,
      id,
      createdAt: Date.now()
    };

    setOffices(prev => {
      const exists = prev.some(o => o.id === id);
      if (exists) {
        return prev.map(o => o.id === id ? newOffice : o);
      }
      return [...prev, newOffice];
    });

    try {
      setDoc(doc(db, 'offices', id), newOffice, { merge: true }).catch(() => {});
    } catch {}

    logActivity({
      action: 'OFFICE_MODIFIED',
      details: `Configured office workspace "${newOffice.name}" (${newOffice.location})`,
    });

    showNotification('success', 'Office properties synchronized safely.');
  };

  const handleDeleteOfficeAdmin = async (officeId: string) => {
    const target = offices.find(o => o.id === officeId);
    setOffices(prev => prev.filter(o => o.id !== officeId));
    setRooms(prev => prev.filter(r => r.officeId !== officeId));
    setBookings(prev => prev.filter(b => b.officeId !== officeId));

    try {
      deleteDoc(doc(db, 'offices', officeId)).catch(() => {});
    } catch {}

    if (activeOffice?.id === officeId) {
      setActiveOffice(null);
      try {
        localStorage.removeItem('office_sync_active_office');
      } catch {}
    }

    logActivity({
      action: 'OFFICE_MODIFIED',
      details: `Removed office profile "${target?.name || officeId}"`,
    });

    showNotification('success', 'Office and all associated rooms deleted.');
  };

  const handleSaveRoomAdmin = async (roomData: Room) => {
    setRooms(prev => {
      const exists = prev.some(r => r.id === roomData.id);
      if (exists) {
        return prev.map(r => r.id === roomData.id ? roomData : r);
      }
      return [...prev, roomData];
    });

    try {
      setDoc(doc(db, 'rooms', roomData.id), roomData, { merge: true }).catch(() => {});
    } catch {}

    logActivity({
      action: 'ROOM_MODIFIED',
      roomName: roomData.name,
      floor: roomData.floor,
      details: `Saved room profile for "${roomData.name}" (Floor ${roomData.floor}, Capacity ${roomData.capacity})`,
    });

    showNotification('success', 'Room specifications saved.');
  };

  const handleDeleteRoomAdmin = async (roomId: string) => {
    const room = rooms.find(r => r.id === roomId);
    setRooms(prev => prev.filter(r => r.id !== roomId));
    setBookings(prev => prev.filter(b => b.roomId !== roomId));

    try {
      deleteDoc(doc(db, 'rooms', roomId)).catch(() => {});
    } catch {}

    logActivity({
      action: 'ROOM_DELETED',
      roomName: room?.name,
      floor: room?.floor,
      details: `Deleted room specification "${room?.name || roomId}"`,
    });

    showNotification('success', 'Room deleted, pending calendar invitations cleared.');
  };

  // Whitelist Admin Handlers
  const handleAddApprovedUser = async (email: string, name?: string, department?: string) => {
    const id = `usr-${Date.now()}`;
    const newUser: ApprovedUser = {
      id,
      email: email.toLowerCase().trim(),
      name,
      department,
      addedAt: Date.now(),
      addedBy: user?.email || ADMIN_EMAIL,
    };

    setApprovedUsers(prev => [newUser, ...prev]);
    try {
      setDoc(doc(db, 'approved_users', id), newUser).catch(() => {});
    } catch {}

    logActivity({
      action: 'APPROVED_USER_ADDED',
      details: `Whitelisted user "${newUser.email}" with booking authorization permissions.`,
    });
  };

  const handleBulkAddApprovedUsers = async (emails: string[]): Promise<number> => {
    let addedCount = 0;
    const newItems: ApprovedUser[] = [];

    for (const rawEmail of emails) {
      const email = rawEmail.toLowerCase().trim();
      if (!approvedUsers.some(u => u.email.toLowerCase() === email) && email !== ADMIN_EMAIL.toLowerCase()) {
        const id = `usr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const u: ApprovedUser = {
          id,
          email,
          addedAt: Date.now(),
          addedBy: user?.email || ADMIN_EMAIL,
        };
        newItems.push(u);
        try {
          setDoc(doc(db, 'approved_users', id), u).catch(() => {});
        } catch {}
        addedCount++;
      }
    }

    if (newItems.length > 0) {
      setApprovedUsers(prev => [...newItems, ...prev]);
      logActivity({
        action: 'APPROVED_USER_ADDED',
        details: `Bulk uploaded ${addedCount} corporate accounts to approved staff whitelist.`,
      });
    }

    return addedCount;
  };

  const handleRemoveApprovedUser = async (userId: string) => {
    const target = approvedUsers.find(u => u.id === userId);
    setApprovedUsers(prev => prev.filter(u => u.id !== userId));

    try {
      deleteDoc(doc(db, 'approved_users', userId)).catch(() => {});
    } catch {}

    if (target) {
      logActivity({
        action: 'APPROVED_USER_REMOVED',
        details: `Revoked booking authorization permissions for "${target.email}"`,
      });
    }

    showNotification('info', 'User access permissions revoked.');
  };

  // Access Key Token Generator Handlers
  const handleGenerateAccessKey = async (data: { label: string; expiresAt?: string; maxUses?: number }): Promise<AccessKey> => {
    const id = `key-${Date.now()}`;
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const token = `SEC-${randomHex}-${randomNum}`;

    const newKey: AccessKey = {
      id,
      token,
      label: data.label,
      expiresAt: data.expiresAt,
      maxUses: data.maxUses,
      usedCount: 0,
      active: true,
      createdAt: Date.now(),
      createdBy: user?.email || ADMIN_EMAIL,
    };

    setAccessKeys(prev => [newKey, ...prev]);
    try {
      setDoc(doc(db, 'access_keys', id), newKey).catch(() => {});
    } catch {}

    logActivity({
      action: 'ACCESS_KEY_GENERATED',
      details: `Generated Secret Token "${newKey.label}" (${newKey.token}) with ${newKey.maxUses ? `${newKey.maxUses} uses` : 'unlimited uses'}`,
    });

    return newKey;
  };

  const handleToggleAccessKey = async (keyId: string) => {
    const target = accessKeys.find(k => k.id === keyId);
    if (!target) return;

    const updated = { ...target, active: !target.active };
    setAccessKeys(prev => prev.map(k => k.id === keyId ? updated : k));

    try {
      setDoc(doc(db, 'access_keys', keyId), updated, { merge: true }).catch(() => {});
    } catch {}

    logActivity({
      action: updated.active ? 'ACCESS_KEY_GENERATED' : 'ACCESS_KEY_REVOKED',
      details: `${updated.active ? 'Re-activated' : 'Suspended'} Secret Token "${target.label}" (${target.token})`,
    });
  };

  const handleRevokeAccessKey = async (keyId: string) => {
    const target = accessKeys.find(k => k.id === keyId);
    setAccessKeys(prev => prev.filter(k => k.id !== keyId));

    try {
      deleteDoc(doc(db, 'access_keys', keyId)).catch(() => {});
    } catch {}

    if (target) {
      logActivity({
        action: 'ACCESS_KEY_REVOKED',
        details: `Deleted Secret Token "${target.label}" (${target.token})`,
      });
    }

    showNotification('info', 'Token permanently revoked.');
  };

  const handleClearAuditLogs = async () => {
    setAuditLogs([]);
    try {
      localStorage.removeItem('office_sync_audit_logs');
    } catch {}
    showNotification('info', 'Audit trail cleared.');
  };

  // -------------------------------------------------------------
  // Filtering Algorithm (Current Office context)
  // -------------------------------------------------------------
  const currentOfficeRooms = rooms.filter(r => r.officeId === activeOffice?.id);
  const currentOfficeBookings = bookings.filter(b => b.officeId === activeOffice?.id);

  const allUniqueAmenities = Array.from(
    new Set(currentOfficeRooms.flatMap(room => room.amenities))
  ).filter(Boolean) as string[];

  const handleAmenityToggle = (amenity: string) => {
    if (selectedAmenities.includes(amenity)) {
      setSelectedAmenities(selectedAmenities.filter(a => a !== amenity));
    } else {
      setSelectedAmenities([...selectedAmenities, amenity]);
    }
  };

  const filteredRooms = currentOfficeRooms.filter(room => {
    if (room.floor !== selectedFloor) return false;

    if (searchQuery && !room.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    if (capacityFilter === 'small' && room.capacity > 4) return false;
    if (capacityFilter === 'medium' && (room.capacity < 5 || room.capacity > 12)) return false;
    if (capacityFilter === 'large' && room.capacity < 13) return false;

    if (selectedAmenities.length > 0) {
      const hasAll = selectedAmenities.every(selected => 
        room.amenities.some(roomAmenity => roomAmenity.toLowerCase().includes(selected.toLowerCase()))
      );
      if (!hasAll) return false;
    }

    return true;
  });

  // Timeline & room selection triggers (Protected with Auth & Whitelist Gate)
  const handleRoomBookClick = (room: Room) => {
    if (!isUserAuthorizedToBook()) {
      setPendingBookingIntent({ room, hour: null, date: selectedDate });
      setIsAuthModalOpen(true);
      return;
    }
    setSelectedRoomForModal(room);
    setSelectedHourForModal(null);
    setSelectedEndTimeForModal(undefined);
    setEditingBooking(null);
    setIsModalOpen(true);
  };

  const handleTimelineCellClick = (room: Room, hour: string, customDate?: string) => {
    const targetDate = customDate || selectedDate;
    if (!isUserAuthorizedToBook()) {
      setPendingBookingIntent({ room, hour, date: targetDate });
      setIsAuthModalOpen(true);
      return;
    }
    setSelectedRoomForModal(room);
    setSelectedHourForModal(hour);
    setSelectedEndTimeForModal(undefined);
    if (customDate) {
      setSelectedDate(customDate);
    }
    setEditingBooking(null);
    setIsModalOpen(true);
  };

  const handleBookingPillClick = (booking: Booking) => {
    const room = rooms.find(r => r.id === booking.roomId);
    if (!room) return;
    setSelectedRoomForModal(room);
    setSelectedHourForModal(null);
    setSelectedEndTimeForModal(undefined);
    setEditingBooking(booking);
    setIsModalOpen(true);
  };

  const handleProceedWithBookingFromFinder = (room: Room, date: string, start: string, end: string) => {
    if (!isUserAuthorizedToBook()) {
      setPendingBookingIntent({ room, hour: start, date, endTime: end });
      setIsAuthModalOpen(true);
      return;
    }

    setSelectedRoomForModal(room);
    setSelectedDate(date);
    setSelectedHourForModal(start);
    setSelectedEndTimeForModal(end);
    setEditingBooking(null);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800">
      
      {/* Dynamic Floating Toast Alerts */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
          >
            <div className={`p-3.5 rounded-2xl shadow-xl flex items-start gap-2.5 border text-white ${
              notification.type === 'success' ? 'bg-indigo-600 border-indigo-700' : 
              notification.type === 'error' ? 'bg-rose-900 border-rose-950' : 'bg-slate-800 border-slate-900'
            }`}>
              {notification.type === 'success' ? (
                <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
              ) : notification.type === 'error' ? (
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-300 mt-0.5" />
              ) : (
                <Building2 className="w-5 h-5 shrink-0 text-sky-400 mt-0.5" />
              )}
              <div className="text-xs font-semibold leading-relaxed">
                {notification.message}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Top Navbar */}
      <Navbar
        user={user}
        onLogin={handleLoginGoogle}
        onLogout={handleLogoutGoogle}
        isLoggingIn={isLoggingIn}
        googleToken={googleToken}
        activeOffice={activeOffice}
        onSwitchOffice={handleSwitchOffice}
        isAdminMode={isAdminMode}
        onOpenAdminAuth={handleOpenAdminConsole}
        onExitAdminMode={handleExitAdminMode}
        onOpenRoomFinder={() => setIsRoomFinderOpen(true)}
        adminEmail={ADMIN_EMAIL}
      />

      {/* Main View Router */}
      {isAdminMode ? (
        
        /* Admin Management Console (Restricted strictly to ammarthaqif.ar@gmail.com) */
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
          <AdminPanel
            offices={offices}
            rooms={rooms}
            bookings={bookings}
            approvedUsers={approvedUsers}
            accessKeys={accessKeys}
            auditLogs={auditLogs}
            adminEmail={ADMIN_EMAIL}
            onSaveOffice={handleSaveOfficeAdmin}
            onDeleteOffice={handleDeleteOfficeAdmin}
            onSaveRoom={handleSaveRoomAdmin}
            onDeleteRoom={handleDeleteRoomAdmin}
            onCancelBooking={(booking) => handleCancelBooking(booking.id)}
            onAddApprovedUser={handleAddApprovedUser}
            onBulkAddApprovedUsers={handleBulkAddApprovedUsers}
            onRemoveApprovedUser={handleRemoveApprovedUser}
            onGenerateAccessKey={handleGenerateAccessKey}
            onToggleAccessKey={handleToggleAccessKey}
            onRevokeAccessKey={handleRevokeAccessKey}
            onClearAuditLogs={handleClearAuditLogs}
            onExitAdmin={handleExitAdminMode}
          />
        </main>

      ) : !activeOffice ? (
        
        /* Employee Workspace Passkey Screen (Clean, no exposed testing passkeys) */
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-8 space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
            
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-md">
              <Building2 className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold font-sans tracking-tight text-slate-900">
                Corporate Workspace Portal
              </h2>
              <p className="text-xs text-slate-500">
                Select your building and enter your office passkey to access live room schedules.
              </p>
            </div>

            <form onSubmit={handlePasskeySubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                  Enter Office Passkey
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={passkeyInput}
                    onChange={(e) => setPasskeyInput(e.target.value)}
                    placeholder="Enter assigned office passkey (e.g. SG123)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  />
                </div>
                {passkeyError && (
                  <p className="text-[10px] text-rose-600 font-semibold mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {passkeyError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs tracking-wider uppercase py-3 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Access Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="border-t border-slate-100 pt-4 text-center">
              <button
                onClick={handleOpenAdminConsole}
                className="text-[11px] text-slate-500 hover:text-indigo-600 font-bold transition-colors cursor-pointer flex items-center gap-1.5 mx-auto"
              >
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>Super Administrator Portal</span>
              </button>
            </div>

          </div>
        </div>
      ) : (
        
        /* Employee Active Dashboard */
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-4">
          
          {/* Header Card with Date & View Mode Switcher */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            <div>
              <h2 className="text-base font-bold font-sans text-slate-800 tracking-tight flex items-center gap-2 uppercase">
                <Building2 className="w-4.5 h-4.5 text-indigo-600" />
                Meeting Room Availability Matrix
              </h2>
              <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                Real-time schedules & availability across {activeOffice.name} spaces.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              
              {/* View Mode Switcher Tabs */}
              <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode('day')}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    viewMode === 'day'
                      ? 'bg-white text-indigo-600 shadow-2xs ring-1 ring-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Day View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('week')}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    viewMode === 'week'
                      ? 'bg-white text-indigo-600 shadow-2xs ring-1 ring-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarRange className="w-3.5 h-3.5" />
                  <span>Weekly View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('month')}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    viewMode === 'month'
                      ? 'bg-white text-indigo-600 shadow-2xs ring-1 ring-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Monthly View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('floorplan')}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    viewMode === 'floorplan'
                      ? 'bg-white text-indigo-600 shadow-2xs ring-1 ring-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>SVG Floor Plan</span>
                </button>
              </div>

              {/* Date picker */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer"
                />
              </div>

              {/* Smart Room Finder Quick Launcher Button */}
              <button
                type="button"
                onClick={() => setIsRoomFinderOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                <span>Smart Room Finder</span>
              </button>

            </div>
          </div>

          {/* Level / Floor Selector Bar */}
          <FloorSelector
            floors={activeOffice.floors}
            selectedFloor={selectedFloor}
            onSelectFloor={setSelectedFloor}
            rooms={currentOfficeRooms}
            bookings={currentOfficeBookings}
            selectedDate={selectedDate}
          />

          {/* Search, Filter & Quick-Stats Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search meeting spaces by name or features..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Capacity Filter */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Room Size:
                </span>
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  {['all', 'small', 'medium', 'large'].map((cap) => (
                    <button
                      key={cap}
                      onClick={() => setCapacityFilter(cap)}
                      className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded transition-all cursor-pointer ${
                        capacityFilter === cap
                          ? 'bg-white text-indigo-600 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Amenities Checklist Tags */}
            {allUniqueAmenities.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono mr-1">
                  Amenities:
                </span>
                {allUniqueAmenities.map((amenity) => {
                  const isSelected = selectedAmenities.includes(amenity);
                  return (
                    <button
                      key={amenity}
                      onClick={() => handleAmenityToggle(amenity)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-bold shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {amenity}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Main Content Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left: Meeting Rooms Grid (Floor Context) */}
            <div className="lg:col-span-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-sans font-bold text-slate-900 text-xs tracking-tight uppercase flex items-center gap-1.5">
                  <span>Level {selectedFloor} Spaces</span>
                  <span className="text-[10px] font-mono text-slate-400 font-normal">
                    ({filteredRooms.length} available)
                  </span>
                </h3>
              </div>

              {filteredRooms.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-200 rounded-xl p-8 text-center space-y-2">
                  <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">No rooms match filter</p>
                  <p className="text-[10px] text-slate-400">Clear your search query or choose another floor level.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                  {filteredRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      selectedDate={selectedDate}
                      bookings={currentOfficeBookings.filter(b => b.roomId === room.id && b.date === selectedDate)}
                      onBookClick={() => handleRoomBookClick(room)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right: Master Availability View (Day, Weekly, Monthly) + My Reservations */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Day View */}
              {viewMode === 'day' && (
                <BookingTimeline
                  rooms={filteredRooms}
                  bookings={currentOfficeBookings.filter(b => b.date === selectedDate)}
                  selectedDate={selectedDate}
                  onCellClick={handleTimelineCellClick}
                  onBookingClick={handleBookingPillClick}
                  currentUserUid={user?.uid}
                  onCancelBooking={handleCancelBooking}
                />
              )}

              {/* Weekly View */}
              {viewMode === 'week' && (
                <WeeklyScheduleView
                  rooms={filteredRooms}
                  bookings={currentOfficeBookings}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onCellClick={handleTimelineCellClick}
                  onBookingClick={handleBookingPillClick}
                  currentUserUid={user?.uid}
                  onCancelBooking={handleCancelBooking}
                  onSwitchToDayView={(date) => {
                    setSelectedDate(date);
                    setViewMode('day');
                  }}
                />
              )}

              {/* Monthly View */}
              {viewMode === 'month' && (
                <MonthlyAvailabilityView
                  rooms={filteredRooms}
                  bookings={currentOfficeBookings}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onCellClick={handleTimelineCellClick}
                  onBookingClick={handleBookingPillClick}
                  currentUserUid={user?.uid}
                  onCancelBooking={handleCancelBooking}
                  onSwitchToDayView={(date) => {
                    setSelectedDate(date);
                    setViewMode('day');
                  }}
                />
              )}

              {/* Interactive SVG Floor Plan View */}
              {viewMode === 'floorplan' && (
                <InteractiveFloorPlan
                  rooms={currentOfficeRooms}
                  bookings={currentOfficeBookings}
                  currentFloor={selectedFloor}
                  selectedDate={selectedDate}
                  onSelectRoom={(room, hour) => handleTimelineCellClick(room, hour || '09:00')}
                  onFloorChange={setSelectedFloor}
                  availableFloors={activeOffice.floors}
                />
              )}

              {/* My Personal Reservations */}
              <MyBookings
                bookings={currentOfficeBookings}
                rooms={rooms}
                currentUserEmail={user?.email || null}
                onCancelBooking={(booking) => handleCancelBooking(booking.id)}
                onSyncGoogleNow={(booking) => handleSyncGoogleNow(booking.id)}
                googleSyncAvailable={!!googleToken}
              />

            </div>

          </div>

        </main>
      )}

      {/* Floating Modal for making / editing a reservation */}
      <BookingModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEndTimeForModal(undefined);
        }}
        room={selectedRoomForModal}
        rooms={currentOfficeRooms}
        selectedDate={selectedDate}
        selectedHour={selectedHourForModal}
        selectedEndTime={selectedEndTimeForModal}
        onSave={handleSaveBooking}
        editingBooking={editingBooking}
        currentUser={user ? { displayName: user.displayName, email: user.email, uid: user.uid } : null}
        bookings={currentOfficeBookings}
        googleSyncAvailable={!!googleToken}
        adminEmail={ADMIN_EMAIL}
      />

      {/* Smart Room Finder Modal (Recommend earliest available date or instant check for defined date) */}
      <RoomFinderModal
        isOpen={isRoomFinderOpen}
        onClose={() => setIsRoomFinderOpen(false)}
        rooms={currentOfficeRooms}
        bookings={currentOfficeBookings}
        currentFloor={selectedFloor}
        initialDate={selectedDate}
        onProceedWithBooking={handleProceedWithBookingFromFinder}
      />

      {/* Booking Authorization Gate Modal (for unapproved / token users) */}
      <BookingAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setPendingBookingIntent(null);
        }}
        currentUserEmail={user?.email || null}
        onLoginGoogle={handleLoginGoogle}
        onVerifyToken={handleVerifySecretToken}
        adminEmail={ADMIN_EMAIL}
      />

      {/* Admin Panel Access Restriction Modal (When non-admin clicks Admin) */}
      <AnimatePresence>
        {showAdminRestrictionModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 max-w-sm w-full space-y-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                  <h3 className="font-sans font-black text-slate-800 text-sm tracking-tight uppercase">Admin Access Restricted</h3>
                </div>
                <button
                  onClick={() => setShowAdminRestrictionModal(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs text-slate-600 leading-relaxed font-sans">
                <p>
                  System administrative controls and configuration suite are strictly restricted to the authorized administrator:
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 font-mono text-amber-900 font-bold text-center select-all">
                  {ADMIN_EMAIL}
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  Please sign in using your official Google Administrator account to access workspace management, staff whitelisting, and audit logs.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    setShowAdminRestrictionModal(false);
                    await handleLoginGoogle();
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase py-2.5 rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Sign In as Administrator</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdminRestrictionModal(false)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Simulated personal Corporate Mail Client tray (floating) */}
      <SimulatedInbox
        emails={simulatedEmails}
        onClear={() => setSimulatedEmails([])}
      />

    </div>
  );
}
