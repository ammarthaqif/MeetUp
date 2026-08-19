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
  Clock, CalendarRange, Calendar
} from 'lucide-react';

// Subcomponents
import { Navbar } from './components/Navbar';
import { FloorSelector } from './components/FloorSelector';
import { RoomCard } from './components/RoomCard';
import { BookingTimeline } from './components/BookingTimeline';
import { WeeklyScheduleView } from './components/WeeklyScheduleView';
import { MonthlyAvailabilityView } from './components/MonthlyAvailabilityView';
import { BookingModal } from './components/BookingModal';
import { MyBookings } from './components/MyBookings';
import { AdminPanel } from './components/AdminPanel';
import { SimulatedInbox, SimulatedEmail } from './components/SimulatedInbox';

// Types and Utilities
import { Booking, Room, Office } from './types';
import { formatFriendlyDate } from './utils';
import { ROOMS as DEFAULT_ROOMS } from './roomsData';

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
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');

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

  // View mode switcher: 'day' | 'week' | 'month'
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');

  // Modal actions
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoomForModal, setSelectedRoomForModal] = useState<Room | null>(null);
  const [selectedHourForModal, setSelectedHourForModal] = useState<string | null>(null);
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
      localStorage.setItem('office_sync_emails', JSON.stringify(simulatedEmails));
    } catch {}
  }, [simulatedEmails]);

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
        // Silently operates in offline mode without crashing
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

  // Keep active office synchronized with real-time db definitions (address/passkey updates)
  useEffect(() => {
    if (activeOffice && offices.length > 0) {
      const fresh = offices.find(o => o.id === activeOffice.id);
      if (fresh) {
        if (JSON.stringify(fresh) !== JSON.stringify(activeOffice)) {
          setActiveOffice(fresh);
          try {
            localStorage.setItem('office_sync_active_office', JSON.stringify(fresh));
          } catch {}
          // Correct floor index if out-of-bounds
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
        } else {
          setGoogleToken(null);
        }
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn('Auth listener offline fallback:', e);
    }
  }, []);

  // -------------------------------------------------------------
  // Employee Login Passkey Verification
  // -------------------------------------------------------------
  const handlePasskeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasskeyError('');

    if (!passkeyInput.trim()) {
      setPasskeyError('Passkey field cannot be blank.');
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
      showNotification('success', `Dashboard verified. Connected to ${matched.name}.`);
    } else {
      setPasskeyError('Invalid Office Passkey. Check the directory below.');
    }
  };

  const handleSwitchOffice = () => {
    setActiveOffice(null);
    try {
      localStorage.removeItem('office_sync_active_office');
    } catch {}
    showNotification('info', 'Disconnected from office portal.');
  };

  // -------------------------------------------------------------
  // Admin Mode Authentication (admin123)
  // -------------------------------------------------------------
  const handleAdminAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError('');

    if (adminPasswordInput === 'admin123') {
      setIsAdminMode(true);
      try {
        localStorage.setItem('office_sync_admin_mode', 'true');
      } catch {}
      setShowAdminModal(false);
      setAdminPasswordInput('');
      showNotification('success', 'Admin session unlocked.');
    } else {
      setAdminAuthError('Incorrect Administration Password.');
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
  // Booking operations (Save & Cancel)
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
          hostUid: bookingData.hostUid,
          attendees: bookingData.attendees,
          outlookSynced: bookingData.outlookSynced || false,
          createdAt: Date.now(),
        };
        createdBookings.push(docPayload);

        // Async write to Firestore if available
        try {
          addDoc(collection(db, 'bookings'), docPayload).catch(() => {});
        } catch {}
      }

      setBookings(prev => [...createdBookings, ...prev]);

      // Append multi-day email notification to simulated inbox
      const newEmail: SimulatedEmail = {
        id: `email-${Date.now()}`,
        to: emailToDeliver,
        subject: `[CONFIRMED] Multi-Day Room Reservation: "${bookingData.title}"`,
        date: new Date().toLocaleString(),
        body: `Successful booking across multiple days!`,
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
      showNotification('success', `Successfully reserved ${room.name} over ${bookingData.multiDates.length} specified days.`);

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
        hostUid: bookingData.hostUid,
        attendees: bookingData.attendees,
        outlookSynced: bookingData.outlookSynced || false,
        googleEventId: bookingData.googleEventId || null,
        createdAt: Date.now(),
      };

      if (isEditing && bookingData.id) {
        setBookings(prev => prev.map(b => b.id === bookingData.id ? { ...b, ...docPayload } : b));
        try {
          setDoc(doc(db, 'bookings', bookingData.id), docPayload, { merge: true }).catch(() => {});
        } catch {}

        // Email for edit confirmation
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

        // Email for new reservation
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
    if (!window.confirm('Are you sure you want to cancel this reservation?')) {
      return;
    }
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const room = rooms.find(r => r.id === booking.roomId);

    // Immediate local state update
    setBookings(prev => prev.filter(b => b.id !== bookingId));

    try {
      deleteDoc(doc(db, 'bookings', bookingId)).catch(() => {});
    } catch {}

    // Append cancellation notification email
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
      showNotification('success', 'Authenticated with Google Calendar scope.');
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
  // Administrative Operations (Delivering from AdminPanel UI)
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

    showNotification('success', 'Office properties synchronized safely.');
  };

  const handleDeleteOfficeAdmin = async (officeId: string) => {
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

    showNotification('success', 'Room specifications saved.');
  };

  const handleDeleteRoomAdmin = async (roomId: string) => {
    setRooms(prev => prev.filter(r => r.id !== roomId));
    setBookings(prev => prev.filter(b => b.roomId !== roomId));

    try {
      deleteDoc(doc(db, 'rooms', roomId)).catch(() => {});
    } catch {}

    showNotification('success', 'Room deleted, pending calendar invitations cleared.');
  };

  const handleCancelBookingAdmin = async (booking: Booking) => {
    await handleCancelBooking(booking.id);
  };

  // -------------------------------------------------------------
  // Filtering Algorithm (Current Office context)
  // -------------------------------------------------------------
  const currentOfficeRooms = rooms.filter(r => r.officeId === activeOffice?.id);
  const currentOfficeBookings = bookings.filter(b => b.officeId === activeOffice?.id);

  // Auto-calculated facilities options loaded from what's configured on active site rooms!
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

    // Search query match
    if (searchQuery && !room.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    // Capacity matching
    if (capacityFilter === 'small' && room.capacity > 4) return false;
    if (capacityFilter === 'medium' && (room.capacity < 5 || room.capacity > 12)) return false;
    if (capacityFilter === 'large' && room.capacity < 13) return false;

    // Amenities checklist matching
    if (selectedAmenities.length > 0) {
      const hasAll = selectedAmenities.every(selected => 
        room.amenities.some(roomAmenity => roomAmenity.toLowerCase().includes(selected.toLowerCase()))
      );
      if (!hasAll) return false;
    }

    return true;
  });

  // Timeline & room selection triggers
  const handleRoomBookClick = (room: Room) => {
    setSelectedRoomForModal(room);
    setSelectedHourForModal(null);
    setEditingBooking(null);
    setIsModalOpen(true);
  };

  const handleTimelineCellClick = (room: Room, hour: string, customDate?: string) => {
    setSelectedRoomForModal(room);
    setSelectedHourForModal(hour);
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
    setEditingBooking(booking);
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
                <Sparkles className="w-5 h-5 shrink-0 text-amber-300 mt-0.5" />
              )}
              <div>
                <p className="text-xs font-bold leading-relaxed">{notification.message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header component */}
      <Navbar
        user={user}
        onLogin={handleLoginGoogle}
        onLogout={handleLogoutGoogle}
        isLoggingIn={isLoggingIn}
        googleToken={googleToken}
        activeOffice={activeOffice}
        onSwitchOffice={handleSwitchOffice}
        isAdminMode={isAdminMode}
        onOpenAdminAuth={() => setShowAdminModal(true)}
        onExitAdminMode={handleExitAdminMode}
      />

      {/* Admin Mode Overlay Portal */}
      {isAdminMode ? (
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
          <AdminPanel
            offices={offices}
            rooms={rooms}
            bookings={bookings}
            onSaveOffice={handleSaveOfficeAdmin}
            onDeleteOffice={handleDeleteOfficeAdmin}
            onSaveRoom={handleSaveRoomAdmin}
            onDeleteRoom={handleDeleteRoomAdmin}
            onCancelBooking={handleCancelBookingAdmin}
            onExitAdmin={handleExitAdminMode}
          />
        </main>
      ) : !activeOffice ? (
        
        /* Employee Verification Screen (Passkey Gate) */
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-md mx-auto w-full my-12">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 w-full space-y-6 relative overflow-hidden">
            
            {/* Visual Accent */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto border border-indigo-100 shadow-sm">
                <Building2 className="w-6 h-6 animate-pulse" />
              </div>
              <h2 className="font-sans font-black text-slate-800 text-lg tracking-tight uppercase">
                Workplace Portal Access
              </h2>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Enter your site's access passkey to load the interactive meeting floor plans and timeline booking scheduler.
              </p>
            </div>

            <form onSubmit={handlePasskeySubmit} className="space-y-4">
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
                    placeholder="e.g. SG123"
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

            <div className="border-t border-slate-100 pt-5 space-y-3.5">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block font-mono">
                Corporate Directory (For Testing)
              </span>

              {offices.length === 0 ? (
                <div className="text-[10px] text-slate-400 italic">No offices registered. Activate Admin mode to construct one!</div>
              ) : (
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {offices.map(o => (
                    <div 
                      key={o.id} 
                      onClick={() => {
                        setPasskeyInput(o.passkey);
                        setPasskeyError('');
                      }}
                      className="flex items-center justify-between bg-slate-50/50 hover:bg-indigo-50/30 border border-slate-200/50 rounded-xl p-2.5 cursor-pointer transition-colors"
                    >
                      <div className="space-y-0.5 text-left max-w-[200px]">
                        <span className="font-bold text-slate-800 text-xs block truncate">{o.name}</span>
                        <span className="text-[9px] text-slate-400 flex items-center gap-0.5 truncate">
                          <MapPin className="w-2.5 h-2.5" /> {o.location}
                        </span>
                      </div>
                      <span className="bg-amber-100/80 text-amber-800 border border-amber-200 font-mono text-[9px] font-bold px-2 py-0.5 rounded-lg">
                        {o.passkey}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="text-center pt-2">
              <button
                onClick={() => setShowAdminModal(true)}
                className="text-[10px] text-slate-400 hover:text-indigo-600 font-bold underline cursor-pointer flex items-center gap-1 mx-auto"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Login as Administrator</span>
              </button>
            </div>

          </div>
        </div>
      ) : (
        
        /* Employee Active Dashboard */
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-4">
          
          {/* Header Card with Date & View Mode Switcher */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div>
              <h2 className="text-base font-bold font-sans text-slate-800 tracking-tight flex items-center gap-2 uppercase">
                <Building2 className="w-4.5 h-4.5 text-indigo-600" />
                Meeting Room Availability Matrix
              </h2>
              <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                Real-time schedules & availability across {activeOffice.name} spaces.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* View Switcher Segmented Tabs: Day | Week | Month */}
              <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode('day')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    viewMode === 'day'
                      ? 'bg-white text-indigo-600 shadow-xs ring-1 ring-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Day</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('week')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    viewMode === 'week'
                      ? 'bg-white text-indigo-600 shadow-xs ring-1 ring-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <CalendarRange className="w-3.5 h-3.5" />
                  <span>Week</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('month')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    viewMode === 'month'
                      ? 'bg-white text-indigo-600 shadow-xs ring-1 ring-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Month</span>
                </button>
              </div>

              {/* Date Input */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded p-1.5 shrink-0">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400 ml-1" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent border-0 text-xs font-bold text-slate-700 focus:outline-none focus:ring-0 cursor-pointer"
                />
                <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-black uppercase hidden sm:inline">
                  {formatFriendlyDate(selectedDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Floors Navigator Map */}
          <FloorSelector 
            selectedFloor={selectedFloor} 
            onSelectFloor={setSelectedFloor}
            rooms={currentOfficeRooms}
            bookings={currentOfficeBookings}
            selectedDate={selectedDate}
            floors={activeOffice.floors}
          />

          {/* Primary Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            
            {/* Catalog list + Filters (Left Column) */}
            <div className="lg:col-span-4 space-y-4">
              
              {/* Filter tools */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 font-sans uppercase tracking-tight">
                    <Filter className="w-3.5 h-3.5 text-indigo-600" />
                    Specifications Filters
                  </span>
                  {(searchQuery || capacityFilter !== 'all' || selectedAmenities.length > 0) && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setCapacityFilter('all');
                        setSelectedAmenities([]);
                      }}
                      className="text-[9px] font-black uppercase tracking-wider text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search room name..."
                    className="w-full border border-slate-200 rounded pl-8 pr-2.5 py-1 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Capacity segmented buttons */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 font-sans uppercase tracking-wider">
                    Room Capacity
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'small', label: '1-4' },
                      { id: 'medium', label: '5-12' },
                      { id: 'large', label: '13+' }
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => setCapacityFilter(btn.id)}
                        className={`py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                          capacityFilter === btn.id
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dynamic Amenities Checkbox List */}
                {allUniqueAmenities.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <label className="text-[10px] font-bold text-slate-500 font-sans uppercase tracking-wider">
                      Included Amenities
                    </label>
                    <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto pr-1">
                      {allUniqueAmenities.map((amenity) => {
                        const isChecked = selectedAmenities.includes(amenity);
                        return (
                          <button
                            key={amenity}
                            type="button"
                            onClick={() => handleAmenityToggle(amenity)}
                            className={`flex items-center justify-between px-2 py-1 rounded text-left transition-colors cursor-pointer ${
                              isChecked ? 'bg-indigo-50 text-indigo-800 font-semibold' : 'hover:bg-slate-50 text-slate-600'
                            }`}
                          >
                            <span className="text-[11px] truncate">{amenity}</span>
                            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] ${
                              isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                            }`}>
                              {isChecked ? '✓' : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Room Cards List for Floor */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                    Floor {selectedFloor} Spaces ({filteredRooms.length})
                  </span>
                </div>

                {filteredRooms.length === 0 ? (
                  <div className="bg-white border border-dashed border-slate-300 rounded-lg p-6 text-center space-y-2">
                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                      <Filter className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-bold text-slate-600">No rooms match filter criteria</p>
                    <p className="text-[10px] text-slate-400">Try clearing amenity tags or switching floors.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredRooms.map(room => (
                      <RoomCard
                        key={room.id}
                        room={room}
                        bookings={currentOfficeBookings}
                        selectedDate={selectedDate}
                        onBookClick={handleRoomBookClick}
                      />
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Matrix & Timelines (Right Column) */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Day View */}
              {viewMode === 'day' && (
                <BookingTimeline
                  rooms={filteredRooms}
                  bookings={currentOfficeBookings}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onCellClick={handleTimelineCellClick}
                  onBookingClick={handleBookingPillClick}
                  currentUserUid={user?.uid}
                  onCancelBooking={handleCancelBooking}
                />
              )}

              {/* Week View */}
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

              {/* Month View */}
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
        onClose={() => setIsModalOpen(false)}
        room={selectedRoomForModal}
        rooms={currentOfficeRooms}
        selectedDate={selectedDate}
        selectedHour={selectedHourForModal}
        onSave={handleSaveBooking}
        editingBooking={editingBooking}
        currentUser={user ? { displayName: user.displayName, email: user.email, uid: user.uid } : null}
        bookings={currentOfficeBookings}
        googleSyncAvailable={!!googleToken}
      />

      {/* Admin Panel Authorization Modal prompt */}
      <AnimatePresence>
        {showAdminModal && (
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
                  <h3 className="font-sans font-black text-slate-800 text-sm tracking-tight uppercase">Admin Authorization</h3>
                </div>
                <button
                  onClick={() => {
                    setShowAdminModal(false);
                    setAdminPasswordInput('');
                    setAdminAuthError('');
                  }}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Enter the Workspace matrix administration password to configure offices, modify floor layouts, and manage global specifications.
              </p>

              <form onSubmit={handleAdminAuthSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                    Admin Password
                  </label>
                  <input
                    type="password"
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="Enter default: admin123"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {adminAuthError && (
                    <p className="text-[9px] text-rose-600 font-bold mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-600" /> {adminAuthError}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-slate-900 hover:bg-black text-white font-black text-[11px] uppercase py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer"
                  >
                    Authorize Session
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminModal(false);
                      setAdminPasswordInput('');
                      setAdminAuthError('');
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 rounded-xl text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
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
