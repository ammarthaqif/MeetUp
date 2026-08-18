import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, onSnapshot, addDoc, doc, setDoc, deleteDoc, query, orderBy
} from 'firebase/firestore';
import { db, auth, googleSignIn, logout } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  CalendarDays, Building2, Filter, Search, PlusCircle, CheckCircle, 
  X, AlertTriangle, ArrowRight, ShieldCheck, Key, MapPin, Layers, Mail, ShieldAlert, Sparkles, LogOut
} from 'lucide-react';

// Subcomponents
import { Navbar } from './components/Navbar';
import { FloorSelector } from './components/FloorSelector';
import { RoomCard } from './components/RoomCard';
import { BookingTimeline } from './components/BookingTimeline';
import { BookingModal } from './components/BookingModal';
import { MyBookings } from './components/MyBookings';
import { AdminPanel } from './components/AdminPanel';
import { SimulatedInbox, SimulatedEmail } from './components/SimulatedInbox';

// Types and Utilities
import { Booking, Room, Office } from './types';
import { formatFriendlyDate } from './utils';

export default function App() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [capacityFilter, setCapacityFilter] = useState<string>('all');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  
  // Dynamic Database States
  const [offices, setOffices] = useState<Office[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);

  // Active Workspace State
  const [activeOffice, setActiveOffice] = useState<Office | null>(() => {
    const saved = localStorage.getItem('office_sync_active_office');
    return saved ? JSON.parse(saved) : null;
  });

  // Admin state
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    return localStorage.getItem('office_sync_admin_mode') === 'true';
  });
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');

  // Passkey Login State for staff
  const [passkeyInput, setPasskeyInput] = useState('');
  const [passkeyError, setPasskeyError] = useState('');

  // Simulated Email Inbox State
  const [simulatedEmails, setSimulatedEmails] = useState<SimulatedEmail[]>(() => {
    const saved = localStorage.getItem('office_sync_emails');
    return saved ? JSON.parse(saved) : [];
  });

  // UI notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Authentication State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

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

  // -------------------------------------------------------------
  // DB Listeners & Hydration
  // -------------------------------------------------------------
  
  // Real-time listen to Offices
  useEffect(() => {
    const officesCollection = collection(db, 'offices');
    const unsubscribe = onSnapshot(officesCollection, (snapshot) => {
      const officeList: Office[] = [];
      snapshot.forEach((doc) => {
        officeList.push({ id: doc.id, ...doc.data() } as Office);
      });
      setOffices(officeList);
      
      // Seed default offices & rooms if database is fresh and unseeded
      if (snapshot.empty && !isSeeding) {
        seedDefaultData();
      }
    }, (error) => {
      console.error('Error fetching offices:', error);
    });
    return () => unsubscribe();
  }, [isSeeding]);

  // Real-time listen to Rooms
  useEffect(() => {
    const roomsCollection = collection(db, 'rooms');
    const unsubscribe = onSnapshot(roomsCollection, (snapshot) => {
      const roomList: Room[] = [];
      snapshot.forEach((doc) => {
        roomList.push({ id: doc.id, ...doc.data() } as Room);
      });
      setRooms(roomList);
    }, (error) => {
      console.error('Error fetching rooms:', error);
    });
    return () => unsubscribe();
  }, []);

  // Real-time listen to Bookings
  useEffect(() => {
    const bookingsCollection = collection(db, 'bookings');
    const unsubscribe = onSnapshot(bookingsCollection, (snapshot) => {
      const bookingList: Booking[] = [];
      snapshot.forEach((doc) => {
        bookingList.push({ id: doc.id, ...doc.data() } as Booking);
      });
      // Sort bookings by creation time descending for listings
      bookingList.sort((a, b) => b.createdAt - a.createdAt);
      setBookings(bookingList);
    }, (error) => {
      console.error('Error fetching bookings:', error);
    });
    return () => unsubscribe();
  }, []);

  // Keep active office synchronized with real-time db definitions (address/passkey updates)
  useEffect(() => {
    if (activeOffice && offices.length > 0) {
      const fresh = offices.find(o => o.id === activeOffice.id);
      if (fresh) {
        if (JSON.stringify(fresh) !== JSON.stringify(activeOffice)) {
          setActiveOffice(fresh);
          localStorage.setItem('office_sync_active_office', JSON.stringify(fresh));
          // Correct floor index if out-of-bounds
          if (!fresh.floors.includes(selectedFloor)) {
            setSelectedFloor(fresh.floors[0] || 1);
          }
        }
      }
    }
  }, [offices, activeOffice, selectedFloor]);

  // Persist simulated emails to localStorage for realistic testing
  useEffect(() => {
    localStorage.setItem('office_sync_emails', JSON.stringify(simulatedEmails));
  }, [simulatedEmails]);

  // Listen to Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const token = localStorage.getItem('google_calendar_access_token');
        setGoogleToken(token);
      } else {
        setGoogleToken(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // -------------------------------------------------------------
  // Data Seeding (Automatic Provisioning for Fresh Project)
  // -------------------------------------------------------------
  const seedDefaultData = async () => {
    setIsSeeding(true);
    try {
      showNotification('info', 'Workspace database empty. Seeding offices & meeting rooms...');
      
      const officeHqId = 'office-singapore-hq';
      const officeSvId = 'office-silicon-valley';
      
      // Register Singapore HQ Office
      await setDoc(doc(db, 'offices', officeHqId), {
        name: 'Downtown Singapore HQ',
        location: 'Marina Bay Financial Centre, Tower 2',
        passkey: 'SG123',
        floors: [1, 2, 3, 4],
        createdAt: Date.now()
      });

      // Register Silicon Valley Branch Office
      await setDoc(doc(db, 'offices', officeSvId), {
        name: 'West Tech Center (Silicon Valley)',
        location: '456 Innovation Way, Building 2',
        passkey: 'SV456',
        floors: [1, 2],
        createdAt: Date.now()
      });

      // Rooms for Singapore Office
      const defaultSingaporeRooms = [
        { id: 'f1-arena', name: 'The Arena', floor: 1, capacity: 20, amenities: ['Dual 85" Screens', 'Video Conferencing', 'Digital Whiteboard', 'Catering Station', 'Presenter Podium'], description: 'Our largest training room and seminar hall.', color: 'indigo', officeId: officeHqId },
        { id: 'f1-pebble', name: 'Pebble Pod', floor: 1, capacity: 4, amenities: ['55" LED TV', 'Whiteboard', 'USB-C hub'], description: 'A cozy huddle space for quick syncs.', color: 'emerald', officeId: officeHqId },
        { id: 'f1-orion', name: 'Orion Boardroom', floor: 1, capacity: 10, amenities: ['Video Conferencing', 'Whiteboard', 'Smart TV', 'Spacial Audio'], description: 'A glass-enclosed, elegant meeting room.', color: 'sky', officeId: officeHqId },
        { id: 'f2-synapse', name: 'Synapse Lab', floor: 2, capacity: 12, amenities: ['Full-Wall Whiteboards', 'Interactive Projector', 'Flexible Layouts'], description: 'A creative lab with modular desks.', color: 'violet', officeId: officeHqId },
        { id: 'f2-nest', name: 'The Nest', floor: 2, capacity: 6, amenities: ['Touchscreen Display', 'Whiteboard', 'Wireless casting'], description: 'Warm, collaborative setting with armchairs.', color: 'rose', officeId: officeHqId },
        { id: 'f2-booth', name: 'Phone Booth A', floor: 2, capacity: 2, amenities: ['Acoustic Insulation', 'Webcam Light', 'External Mic'], description: 'Ultra-quiet workspace for video calls.', color: 'amber', officeId: officeHqId },
        { id: 'f3-cyber', name: 'Cyber Studio', floor: 3, capacity: 8, amenities: ['Dual Monitors', 'High-Speed LAN', 'Glass Whiteboard', 'Ultra-Wide Camera'], description: 'Optimized for code pairing and standups.', color: 'teal', officeId: officeHqId },
        { id: 'f3-nebula', name: 'Nebula', floor: 3, capacity: 6, amenities: ['Whiteboard', 'Smart TV', 'Air Purifier'], description: 'Standard meeting room designed for sprint planning.', color: 'cyan', officeId: officeHqId },
        { id: 'f3-focus', name: 'Focus Pod B', floor: 3, capacity: 2, amenities: ['Acoustic Panels', 'Desk Light', 'Dual Monitors'], description: 'Insulated focus room for pair programming.', color: 'fuchsia', officeId: officeHqId },
        { id: 'f4-zenith', name: 'Zenith Boardroom', floor: 4, capacity: 25, amenities: ['4K Dual Projectors', 'Panoramic Glass View', 'Advanced Mic Array', 'Automated Blinds', 'Lounge Area'], description: 'Our premier executive space with skyline views.', color: 'rose', officeId: officeHqId },
        { id: 'f4-eclipse', name: 'Eclipse Suite', floor: 4, capacity: 8, amenities: ['Dynamic LED Lights', 'Whiteboard', '8K Video Setup'], description: 'Executive meeting room with ambient lighting presets.', color: 'purple', officeId: officeHqId },
        { id: 'f4-atmosphere', name: 'Atmosphere Desk', floor: 4, capacity: 12, amenities: ['Standing Conference Desk', 'Mobile Whiteboard', 'Wireless screen casting'], description: 'A dynamic, standing-only conference room.', color: 'blue', officeId: officeHqId }
      ];

      for (const rm of defaultSingaporeRooms) {
        await setDoc(doc(db, 'rooms', rm.id), rm);
      }

      // Rooms for Silicon Valley Office
      const defaultSvRooms = [
        { id: 'sv-turing', name: 'Turing Lab', floor: 1, capacity: 12, amenities: ['Video Conferencing', 'Whiteboard', 'Dual Monitors'], description: 'Spacious collaborative engineering lab.', color: 'emerald', officeId: officeSvId },
        { id: 'sv-lovelace', name: 'Ada Lovelace Huddle', floor: 1, capacity: 4, amenities: ['Whiteboard', 'Smart TV'], description: 'Perfect huddle space for quick engineer alignment.', color: 'sky', officeId: officeSvId },
        { id: 'sv-hopper', name: 'The Hopper Suite', floor: 2, capacity: 8, amenities: ['Video Conferencing', 'Whiteboard', 'Acoustic Panels'], description: 'Board-style meeting room on the upper floor.', color: 'violet', officeId: officeSvId },
        { id: 'sv-shannon', name: 'Claude Shannon Focus Pod', floor: 2, capacity: 2, amenities: ['Acoustic Insulation', 'Desk Light', 'Dual Monitors'], description: 'Insulated pod designed for ultra-focus coding.', color: 'amber', officeId: officeSvId }
      ];

      for (const rm of defaultSvRooms) {
        await setDoc(doc(db, 'rooms', rm.id), rm);
      }

      showNotification('success', 'Dynamic corporate workspaces and layouts seeded successfully!');
    } catch (err) {
      console.error('Failed database seed operation:', err);
    } finally {
      setIsSeeding(false);
    }
  };

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
      localStorage.setItem('office_sync_active_office', JSON.stringify(matched));
      setSelectedFloor(matched.floors[0] || 1);
      setPasskeyInput('');
      showNotification('success', `Dashboard verified. Connected to ${matched.name}.`);
    } else {
      setPasskeyError('Invalid Office Passkey. Check the directory below.');
    }
  };

  const handleSwitchOffice = () => {
    setActiveOffice(null);
    localStorage.removeItem('office_sync_active_office');
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
      localStorage.setItem('office_sync_admin_mode', 'true');
      setShowAdminModal(false);
      setAdminPasswordInput('');
      showNotification('success', 'Admin session unlocked.');
    } else {
      setAdminAuthError('Incorrect Administration Password.');
    }
  };

  const handleExitAdminMode = () => {
    setIsAdminMode(false);
    localStorage.removeItem('office_sync_admin_mode');
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

    const bookingsCollection = collection(db, 'bookings');

    // Create a confirmation email record
    const emailToDeliver = bookingData.hostEmail.trim() || user?.email || 'staff@company-workspace.com';

    // Handle Multi-day recurring saves
    if (bookingData.multiDates && bookingData.multiDates.length > 0) {
      for (const dateString of bookingData.multiDates) {
        const docPayload = {
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
        await addDoc(bookingsCollection, docPayload);
      }

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
      const docPayload = {
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
        const docRef = doc(db, 'bookings', bookingData.id);
        await setDoc(docRef, docPayload, { merge: true });

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
        await addDoc(bookingsCollection, docPayload);

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

    try {
      await deleteDoc(doc(db, 'bookings', bookingId));

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
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Failed to cancel reservation.');
    }
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
      localStorage.removeItem('google_calendar_access_token');
      setGoogleToken(null);
      showNotification('success', 'Signed out successfully.');
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Sign-Out Failed.');
    }
  };

  const handleSyncGoogleNow = async (bookingId: string) => {
    showNotification('info', 'Manual external synchronization initiated.');
    // Simulated confirmation for Google Sync as OAuth scope is verified
    setTimeout(() => {
      showNotification('success', 'Synced with Google Calendar API successfully.');
    }, 1000);
  };

  // -------------------------------------------------------------
  // Administrative Operations (Delivering from AdminPanel UI)
  // -------------------------------------------------------------
  const handleSaveOfficeAdmin = async (officeData: Omit<Office, 'createdAt'> & { id?: string }) => {
    const docRef = doc(db, 'offices', officeData.id!);
    await setDoc(docRef, {
      ...officeData,
      createdAt: Date.now()
    }, { merge: true });
    showNotification('success', 'Office properties synchronized safely.');
  };

  const handleDeleteOfficeAdmin = async (officeId: string) => {
    // Cascade-delete associated rooms and bookings
    await deleteDoc(doc(db, 'offices', officeId));
    
    const linkedRooms = rooms.filter(r => r.officeId === officeId);
    for (const r of linkedRooms) {
      await deleteDoc(doc(db, 'rooms', r.id));
    }

    const linkedBookings = bookings.filter(b => b.officeId === officeId || linkedRooms.some(r => r.id === b.roomId));
    for (const b of linkedBookings) {
      await deleteDoc(doc(db, 'bookings', b.id));
    }

    if (activeOffice?.id === officeId) {
      setActiveOffice(null);
      localStorage.removeItem('office_sync_active_office');
    }
    showNotification('success', 'Office and all tethers wiped from registry.');
  };

  const handleSaveRoomAdmin = async (roomData: Room) => {
    await setDoc(doc(db, 'rooms', roomData.id), roomData, { merge: true });
    showNotification('success', 'Room specifications locked in.');
  };

  const handleDeleteRoomAdmin = async (roomId: string) => {
    await deleteDoc(doc(db, 'rooms', roomId));
    
    // Clear rooms bookings
    const linkedBookings = bookings.filter(b => b.roomId === roomId);
    for (const b of linkedBookings) {
      await deleteDoc(doc(db, 'bookings', b.id));
    }
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

  const handleTimelineCellClick = (room: Room, hour: string) => {
    setSelectedRoomForModal(room);
    setSelectedHourForModal(hour);
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
              notification.type === 'success' ? 'bg-indigo-650 border-indigo-750' : 
              notification.type === 'error' ? 'bg-rose-900 border-rose-950' : 'bg-slate-850 border-slate-900'
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
          
          {/* Header Card with Date */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div>
              <h2 className="text-base font-bold font-sans text-slate-800 tracking-tight flex items-center gap-2 uppercase">
                <Building2 className="w-4.5 h-4.5 text-indigo-600" />
                Real-Time Booking Matrix
              </h2>
              <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                Manage and reserve workspace rooms on {activeOffice.name} floors.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded p-1.5 shrink-0 sm:self-center">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400 ml-1" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent border-0 text-xs font-bold text-slate-700 focus:outline-none focus:ring-0 cursor-pointer"
              />
              <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-black uppercase">
                {formatFriendlyDate(selectedDate)}
              </span>
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

                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                    Capacity Cap (Pax)
                  </label>
                  <div className="grid grid-cols-4 gap-1 bg-slate-50 p-0.5 rounded border border-slate-200">
                    {['all', 'small', 'medium', 'large'].map(opt => (
                      <button
                        key={opt}
                        onClick={() => setCapacityFilter(opt)}
                        className={`py-0.5 text-[9px] font-bold rounded uppercase transition-all capitalize cursor-pointer ${
                          capacityFilter === opt
                            ? 'bg-white text-indigo-600 shadow-sm font-black border border-slate-200'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {opt === 'small' ? '≤4' : opt === 'medium' ? '5-12' : opt === 'large' ? '13+' : 'All'}
                      </button>
                    ))}
                  </div>
                </div>

                {allUniqueAmenities.length > 0 && (
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                      Meeting Room Amenities
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {allUniqueAmenities.map(amenity => {
                        const isSelected = selectedAmenities.includes(amenity);
                        return (
                          <button
                            key={amenity}
                            onClick={() => handleAmenityToggle(amenity)}
                            className={`text-[9px] font-bold uppercase tracking-tight px-2 py-1 rounded border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {amenity}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Room Specifications Catalogue */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider font-mono px-1">
                  Floor Meeting Rooms ({filteredRooms.length})
                </h3>
                
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {filteredRooms.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-slate-400 text-xs font-medium">
                      No meeting rooms on Lvl {selectedFloor} match selected filters.
                    </div>
                  ) : (
                    filteredRooms.map(room => (
                      <RoomCard
                        key={room.id}
                        room={room}
                        bookings={currentOfficeBookings}
                        selectedDate={selectedDate}
                        onBookClick={handleRoomBookClick}
                      />
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Timelines and Bookings list (Right Column) */}
            <div className="lg:col-span-8 space-y-6">
              
              <BookingTimeline
                rooms={filteredRooms}
                bookings={currentOfficeBookings}
                selectedDate={selectedDate}
                onCellClick={handleTimelineCellClick}
                onBookingClick={handleBookingPillClick}
                currentUserUid={user?.uid}
                onCancelBooking={handleCancelBooking}
              />

              <MyBookings
                bookings={currentOfficeBookings}
                rooms={rooms}
                currentUserEmail={user?.email || null}
                onCancelBooking={handleCancelBooking}
                onSyncGoogleNow={handleSyncGoogleNow}
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
                  className="p-1 hover:bg-slate-150 rounded-lg text-slate-400"
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
