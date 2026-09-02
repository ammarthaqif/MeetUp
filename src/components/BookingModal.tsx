import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Calendar, Clock, Info, UserCheck, AlertTriangle, Users, Mail, Plus, Trash2, 
  Lock, ShieldCheck, ShieldAlert, Layers, Sparkles, ArrowRight, CheckCircle2,
  Repeat, CalendarRange, Check, AlertCircle, RefreshCw, ChevronRight, Zap, Building2, ChevronDown, ChevronUp
} from 'lucide-react';
import { Room, Booking, BlockedDate, Tenant } from '../types';
import { 
  isRoomAvailable, 
  timeToMinutes, 
  minutesToTime, 
  formatDateToISO, 
  parseISODate, 
  formatFriendlyDate,
  generateRecurringDates,
  getWeekdayOrdinalInfo,
  RecurrenceFrequency,
  RecurrenceConfig,
  addMonthsToDate,
  addDaysToDate
} from '../utils';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  rooms: Room[]; // List of all rooms for selection
  selectedDate: string;
  selectedHour?: string | null;
  selectedEndTime?: string | null;
  onSave: (bookingData: Omit<Booking, 'id' | 'createdAt'> & { id?: string; multiDates?: string[] }) => Promise<void>;
  editingBooking: Booking | null;
  currentUser: { displayName: string | null; email: string | null; uid: string } | null;
  bookings: Booking[]; // Used for live conflict checking
  googleSyncAvailable: boolean;
  adminEmail?: string;
  blockedDates?: BlockedDate[];
  currentTenant?: Tenant | null;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  room,
  rooms,
  selectedDate,
  selectedHour,
  selectedEndTime,
  onSave,
  editingBooking,
  currentUser,
  bookings,
  googleSyncAvailable,
  adminEmail = 'admin@enterprise.internal',
  blockedDates = [],
  currentTenant = null,
}) => {
  const [roomId, setRoomId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hostName, setHostName] = useState('');
  const [hostEmail, setHostEmail] = useState('');
  const [attendeeEmail, setAttendeeEmail] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [syncGoogle, setSyncGoogle] = useState(true);
  
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isConflict, setIsConflict] = useState(false);

  // Overlap and Floor Collision Diagnostics
  const [directCollisions, setDirectCollisions] = useState<Booking[]>([]);
  const [floorConcurrentBookings, setFloorConcurrentBookings] = useState<{ booking: Booking; room: Room }[]>([]);
  const [alternativeAvailableRoomsOnFloor, setAlternativeAvailableRoomsOnFloor] = useState<Room[]>([]);
  const [alternativeAvailableRoomsOtherFloors, setAlternativeAvailableRoomsOtherFloors] = useState<{ floor: number; rooms: Room[] }[]>([]);
  const [showCrossFloorExplorer, setShowCrossFloorExplorer] = useState(false);

  // Ownership check: user can only edit/cancel if they are the creator or the verified admin
  const isOwner = !editingBooking || (
    (currentUser && (
      (currentUser.uid && editingBooking.hostUid === currentUser.uid) ||
      (currentUser.email && editingBooking.hostEmail?.toLowerCase() === currentUser.email.toLowerCase())
    )) ||
    (currentUser?.email?.toLowerCase() === adminEmail.toLowerCase())
  );

  // -------------------------------------------------------------------------
  // Rich Recurring Booking Engine States
  // -------------------------------------------------------------------------
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<RecurrenceFrequency>('WEEKLY');
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1);
  const [repeatDays, setRepeatDays] = useState<string[]>([]);
  const [endConditionType, setEndConditionType] = useState<'count' | 'until_date'>('count');
  const [occurrencesCount, setOccurrencesCount] = useState<number>(4);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>('');
  const [includedDates, setIncludedDates] = useState<string[]>([]);

  const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Initialize values when modal opens or inputs change
  useEffect(() => {
    if (isOpen) {
      setIsSaving(false);
      if (editingBooking) {
        setRoomId(editingBooking.roomId);
        setDate(editingBooking.date);
        setStartTime(editingBooking.startTime);
        setEndTime(editingBooking.endTime);
        setTitle(editingBooking.title);
        setDescription(editingBooking.description);
        setHostName(editingBooking.hostName);
        setHostEmail(editingBooking.hostEmail);
        setAttendees(editingBooking.attendees || []);
        setSyncGoogle(!!editingBooking.googleEventId);
        setErrorMessage('');
        
        setIsRecurring(false);
        setRecurrenceInterval(1);
        setRecurrenceEndDate(editingBooking.date);
        setRepeatDays([]);
        setIncludedDates([editingBooking.date]);
      } else {
        const defaultStart = selectedHour || '09:00';
        setRoomId(room?.id || rooms[0]?.id || '');
        setDate(selectedDate || formatDateToISO(new Date()));
        setStartTime(defaultStart);
        if (selectedEndTime) {
          setEndTime(selectedEndTime);
        } else {
          const startMin = timeToMinutes(defaultStart);
          setEndTime(minutesToTime(startMin + 60));
        }
        setTitle('');
        setDescription('');
        setHostName(currentUser?.displayName || '');
        setHostEmail(currentUser?.email || '');
        setAttendees([]);
        setSyncGoogle(googleSyncAvailable);
        setErrorMessage('');

        setIsRecurring(false);
        setRecurrenceFreq('WEEKLY');
        setRecurrenceInterval(1);
        const dayName = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });
        setRepeatDays([dayName]);
        setEndConditionType('count');
        setOccurrencesCount(4);
        setRecurrenceEndDate(addMonthsToDate(selectedDate, 1));
        setIncludedDates([selectedDate]);
      }
    } else {
      setIsSaving(false);
    }
  }, [isOpen, room, selectedDate, selectedHour, selectedEndTime, editingBooking, currentUser, rooms, googleSyncAvailable]);

  // Derived Ordinal info (e.g. 3rd Thursday)
  const ordinalInfo = useMemo(() => {
    if (!date) return { nth: 1, dayName: 'Thursday', label: '1st Day' };
    return getWeekdayOrdinalInfo(date);
  }, [date]);

  // Generate All Dates for the Current Recurrence Config
  const generatedSeriesDates = useMemo(() => {
    if (!isRecurring || !date) return [date];
    const config: RecurrenceConfig = {
      startDate: date,
      frequency: recurrenceFreq,
      interval: recurrenceInterval,
      repeatDays: repeatDays.length > 0 ? repeatDays : [ordinalInfo.dayName],
      endType: endConditionType,
      occurrencesCount,
      endDate: recurrenceEndDate,
      maxGenerated: 52,
    };
    return generateRecurringDates(config);
  }, [isRecurring, date, recurrenceFreq, recurrenceInterval, repeatDays, endConditionType, occurrencesCount, recurrenceEndDate, ordinalInfo.dayName]);

  // Sync includedDates when generated series changes
  useEffect(() => {
    if (isRecurring) {
      setIncludedDates(generatedSeriesDates);
    } else {
      setIncludedDates([date]);
    }
  }, [isRecurring, generatedSeriesDates, date]);

  // Map conflicts per date in the series
  const seriesDateConflictMap = useMemo(() => {
    const map = new Map<string, Booking[]>();
    if (!roomId || !startTime || !endTime) return map;

    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);

    for (const d of generatedSeriesDates) {
      const collisions = bookings.filter(b => {
        if (editingBooking && b.id === editingBooking.id) return false;
        if (b.roomId !== roomId) return false;
        if (b.date !== d) return false;
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);
        return Math.max(startMin, bStart) < Math.min(endMin, bEnd);
      });
      if (collisions.length > 0) {
        map.set(d, collisions);
      }
    }
    return map;
  }, [generatedSeriesDates, roomId, startTime, endTime, bookings, editingBooking]);

  // Active included conflicts
  const activeIncludedConflicts = useMemo(() => {
    return includedDates.filter(d => seriesDateConflictMap.has(d));
  }, [includedDates, seriesDateConflictMap]);

  // All bookings for the selected room on the selected date
  const currentRoomDayBookings = useMemo(() => {
    if (!roomId || !date || !Array.isArray(bookings)) return [];
    return bookings
      .filter(b => b && b.roomId === roomId && b.date === date && (!editingBooking || b.id !== editingBooking.id))
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }, [roomId, date, bookings, editingBooking]);

  // Detailed overlap breakdown for single date
  const detailedOverlapList = useMemo(() => {
    if (!startTime || !endTime || currentRoomDayBookings.length === 0) return [];
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (endMin <= startMin) return [];

    return currentRoomDayBookings
      .filter(b => {
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);
        return Math.max(startMin, bStart) < Math.min(endMin, bEnd);
      })
      .map(b => {
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);
        const overlapStartMin = Math.max(startMin, bStart);
        const overlapEndMin = Math.min(endMin, bEnd);
        const overlapMins = Math.max(0, overlapEndMin - overlapStartMin);
        return {
          booking: b,
          overlapStart: minutesToTime(overlapStartMin),
          overlapEnd: minutesToTime(overlapEndMin),
          overlapMins,
        };
      });
  }, [startTime, endTime, currentRoomDayBookings]);

  // Suggested free slots for the selected room on the selected date
  const suggestedFreeSlots = useMemo(() => {
    if (!roomId || !date || !startTime || !endTime) return [];
    const requestedDuration = Math.max(30, timeToMinutes(endTime) - timeToMinutes(startTime));
    const durationToUse = requestedDuration > 0 && requestedDuration <= 240 ? requestedDuration : 60;
    
    // Standard working day timeline: 08:00 (480 mins) to 19:00 (1140 mins)
    const DAY_START = 480;
    const DAY_END = 1140;

    const occupiedIntervals = currentRoomDayBookings
      .map(b => ({ start: timeToMinutes(b.startTime), end: timeToMinutes(b.endTime) }))
      .sort((a, b) => a.start - b.start);

    const merged: { start: number; end: number }[] = [];
    for (const interval of occupiedIntervals) {
      if (merged.length === 0) {
        merged.push({ ...interval });
      } else {
        const last = merged[merged.length - 1];
        if (interval.start < last.end) {
          last.end = Math.max(last.end, interval.end);
        } else {
          merged.push({ ...interval });
        }
      }
    }

    const freeGaps: { start: number; end: number }[] = [];
    let cur = DAY_START;
    for (const occ of merged) {
      if (occ.start > cur) {
        freeGaps.push({ start: cur, end: Math.min(occ.start, DAY_END) });
      }
      cur = Math.max(cur, occ.end);
    }
    if (cur < DAY_END) {
      freeGaps.push({ start: cur, end: DAY_END });
    }

    const suggestions: { start: string; end: string; duration: number }[] = [];
    for (const gap of freeGaps) {
      const gapDuration = gap.end - gap.start;
      if (gapDuration >= durationToUse) {
        suggestions.push({
          start: minutesToTime(gap.start),
          end: minutesToTime(gap.start + durationToUse),
          duration: durationToUse,
        });
        if (gapDuration >= durationToUse * 2) {
          suggestions.push({
            start: minutesToTime(gap.start + durationToUse),
            end: minutesToTime(gap.start + durationToUse * 2),
            duration: durationToUse,
          });
        }
      } else if (gapDuration >= 30) {
        suggestions.push({
          start: minutesToTime(gap.start),
          end: minutesToTime(gap.end),
          duration: gapDuration,
        });
      }
    }

    return suggestions.slice(0, 4);
  }, [roomId, date, startTime, endTime, currentRoomDayBookings]);

  // Find Alternative Rooms that have full availability across the selected series dates
  const seriesAlternativeRooms = useMemo(() => {
    if (!isRecurring || includedDates.length === 0 || !startTime || !endTime) return [];
    const currentRoomObj = rooms.find(r => r.id === roomId);
    if (!currentRoomObj) return [];

    const otherRooms = rooms.filter(r => r.id !== roomId);
    const viableRooms: { room: Room; availableCount: number; conflictCount: number }[] = [];

    for (const otherRoom of otherRooms) {
      let availableCount = 0;
      let conflictCount = 0;

      for (const d of includedDates) {
        const isFree = isRoomAvailable(otherRoom.id, d, startTime, endTime, bookings, editingBooking?.id);
        if (isFree) {
          availableCount++;
        } else {
          conflictCount++;
        }
      }

      if (conflictCount === 0 || availableCount > (includedDates.length - activeIncludedConflicts.length)) {
        viableRooms.push({ room: otherRoom, availableCount, conflictCount });
      }
    }

    return viableRooms.sort((a, b) => a.conflictCount - b.conflictCount);
  }, [isRecurring, includedDates, startTime, endTime, bookings, editingBooking, rooms, roomId, activeIncludedConflicts.length]);

  // Group all office rooms by floor for organized cross-floor selection
  const roomsByFloor = useMemo(() => {
    const map = new Map<number, Room[]>();
    rooms.forEach(r => {
      const list = map.get(r.floor) || [];
      list.push(r);
      map.set(r.floor, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [rooms]);

  // Real-time cross-floor availability breakdown across all floors of the office
  const crossFloorAvailabilitySummary = useMemo(() => {
    if (!date || !startTime || !endTime || rooms.length === 0) return [];
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (endMin <= startMin) return [];

    const currentRoomObj = rooms.find(r => r.id === roomId);

    return roomsByFloor.map(([floorNum, floorRooms]) => {
      const availableRooms: Room[] = [];
      const busyRooms: Room[] = [];

      floorRooms.forEach(r => {
        const isFree = isRoomAvailable(r.id, date, startTime, endTime, bookings, editingBooking?.id);
        if (isFree) {
          availableRooms.push(r);
        } else {
          busyRooms.push(r);
        }
      });

      return {
        floor: floorNum,
        totalRooms: floorRooms.length,
        availableRooms,
        busyRooms,
        isCurrentFloor: currentRoomObj?.floor === floorNum,
      };
    });
  }, [date, startTime, endTime, rooms, roomsByFloor, bookings, editingBooking, roomId]);

  // -------------------------------------------------------------------------
  // Holiday & Company Replacement Leave Awareness Engine
  // -------------------------------------------------------------------------
  const getHolidayForDate = (checkDate: string): BlockedDate | null => {
    if (!checkDate || !blockedDates) return null;
    return blockedDates.find(b => {
      if (!b.active) return false;
      const matchesTenant = b.tenantId === 'ALL' || b.tenantId === currentTenant?.id;
      if (!matchesTenant) return false;
      if (b.date === checkDate) return true;
      if (b.endDate && checkDate >= b.date && checkDate <= b.endDate) return true;
      return false;
    }) || null;
  };

  const selectedDateHoliday = useMemo(() => {
    return getHolidayForDate(date);
  }, [date, blockedDates, currentTenant]);

  const seriesHolidayMap = useMemo(() => {
    const map = new Map<string, BlockedDate>();
    for (const d of generatedSeriesDates) {
      const h = getHolidayForDate(d);
      if (h) map.set(d, h);
    }
    return map;
  }, [generatedSeriesDates, blockedDates, currentTenant]);

  const activeIncludedHolidays = useMemo(() => {
    return includedDates.filter(d => seriesHolidayMap.has(d));
  }, [includedDates, seriesHolidayMap]);

  const handleExcludeHolidayDates = () => {
    const cleanDates = includedDates.filter(d => !seriesHolidayMap.has(d));
    setIncludedDates(cleanDates);
  };

  // Live conflict checking
  useEffect(() => {
    if (!roomId || !date || !startTime || !endTime) return;
    
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (endMin <= startMin) {
      setErrorMessage('End time must be after the start time.');
      setIsConflict(false);
      setDirectCollisions([]);
      setFloorConcurrentBookings([]);
      setAlternativeAvailableRoomsOnFloor([]);
      setAlternativeAvailableRoomsOtherFloors([]);
      return;
    } else {
      setErrorMessage('');
    }

    const selectedRoomObj = rooms.find(r => r.id === roomId);
    const currentFloor = selectedRoomObj?.floor;

    // Check same-floor concurrent bookings for awareness
    if (currentFloor) {
      const sameFloorRooms = rooms.filter(r => r.floor === currentFloor && r.id !== roomId);
      const floorCollisions: { booking: Booking; room: Room }[] = [];
      const alternativeRooms: Room[] = [];

      sameFloorRooms.forEach(fRoom => {
        const isFree = isRoomAvailable(
          fRoom.id,
          date,
          startTime,
          endTime,
          bookings,
          editingBooking?.id
        );
        if (isFree) {
          alternativeRooms.push(fRoom);
        } else {
          const overlappingB = bookings.find(b => {
            if (editingBooking && b.id === editingBooking.id) return false;
            if (b.roomId !== fRoom.id) return false;
            if (b.date !== date) return false;
            const bStart = timeToMinutes(b.startTime);
            const bEnd = timeToMinutes(b.endTime);
            return Math.max(startMin, bStart) < Math.min(endMin, bEnd);
          });
          if (overlappingB) {
            floorCollisions.push({ booking: overlappingB, room: fRoom });
          }
        }
      });

      setFloorConcurrentBookings(floorCollisions);
      setAlternativeAvailableRoomsOnFloor(alternativeRooms);

      // Check other floors in this same office for cross-floor availability recommendations
      const otherFloorRooms = rooms.filter(r => r.floor !== currentFloor);
      const otherFloorsMap = new Map<number, Room[]>();

      otherFloorRooms.forEach(oRoom => {
        const isFree = isRoomAvailable(
          oRoom.id,
          date,
          startTime,
          endTime,
          bookings,
          editingBooking?.id
        );
        if (isFree) {
          const list = otherFloorsMap.get(oRoom.floor) || [];
          list.push(oRoom);
          otherFloorsMap.set(oRoom.floor, list);
        }
      });

      const groupedOtherFloors = Array.from(otherFloorsMap.entries())
        .sort(([fA], [fB]) => fA - fB)
        .map(([flr, flrRooms]) => ({ floor: flr, rooms: flrRooms }));

      setAlternativeAvailableRoomsOtherFloors(groupedOtherFloors);
    } else {
      setFloorConcurrentBookings([]);
      setAlternativeAvailableRoomsOnFloor([]);
      setAlternativeAvailableRoomsOtherFloors([]);
    }

    if (isRecurring && !editingBooking) {
      const hasConflictsInIncluded = activeIncludedConflicts.length > 0;
      setIsConflict(hasConflictsInIncluded);
      if (hasConflictsInIncluded) {
        const firstConflictDate = activeIncludedConflicts[0];
        setDirectCollisions(seriesDateConflictMap.get(firstConflictDate) || []);
      } else {
        setDirectCollisions([]);
      }
    } else {
      const collisions = bookings.filter(b => {
        if (editingBooking && b.id === editingBooking.id) return false;
        if (b.roomId !== roomId) return false;
        if (b.date !== date) return false;
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);
        return Math.max(startMin, bStart) < Math.min(endMin, bEnd);
      });

      setDirectCollisions(collisions);
      setIsConflict(collisions.length > 0);
    }
  }, [roomId, date, startTime, endTime, bookings, editingBooking, isRecurring, activeIncludedConflicts, seriesDateConflictMap, rooms]);

  if (!isOpen) return null;

  const currentRoom = rooms.find(r => r.id === roomId);

  const handleAddAttendee = (e: React.FormEvent) => {
    e.preventDefault();
    const email = attendeeEmail.trim().toLowerCase();
    if (!email) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (attendees.includes(email)) {
      setErrorMessage('Attendee already added.');
      return;
    }

    setAttendees([...attendees, email]);
    setAttendeeEmail('');
    setErrorMessage('');
  };

  const handleRemoveAttendee = (index: number) => {
    setAttendees(attendees.filter((_, idx) => idx !== index));
  };

  const handleDayToggle = (day: string) => {
    if (repeatDays.includes(day)) {
      if (repeatDays.length > 1) {
        setRepeatDays(repeatDays.filter(d => d !== day));
      }
    } else {
      setRepeatDays([...repeatDays, day]);
    }
  };

  const handleToggleDateInclusion = (dateStr: string) => {
    if (includedDates.includes(dateStr)) {
      setIncludedDates(includedDates.filter(d => d !== dateStr));
    } else {
      setIncludedDates([...includedDates, dateStr].sort());
    }
  };

  const handleSelectOnlyAvailableDates = () => {
    const cleanAvailable = generatedSeriesDates.filter(d => !seriesDateConflictMap.has(d));
    setIncludedDates(cleanAvailable);
  };

  const handleSelectAllDates = () => {
    setIncludedDates(generatedSeriesDates);
  };

  // Quick Recurrence Preset Handlers
  const applyPreset = (preset: 'DAILY_5D' | 'WEEKDAYS_1W' | 'WEEKLY_4W' | 'WEEKLY_12W' | 'BIWEEKLY_6S' | 'MONTHLY_6M' | 'MONTHLY_12M') => {
    setIsRecurring(true);
    switch (preset) {
      case 'DAILY_5D':
        setRecurrenceFreq('DAILY');
        setRecurrenceInterval(1);
        setEndConditionType('count');
        setOccurrencesCount(5);
        break;
      case 'WEEKDAYS_1W':
        setRecurrenceFreq('WEEKDAYS');
        setRecurrenceInterval(1);
        setEndConditionType('count');
        setOccurrencesCount(5);
        break;
      case 'WEEKLY_4W':
        setRecurrenceFreq('WEEKLY');
        setRecurrenceInterval(1);
        setRepeatDays([ordinalInfo.dayName]);
        setEndConditionType('count');
        setOccurrencesCount(4);
        break;
      case 'WEEKLY_12W':
        setRecurrenceFreq('WEEKLY');
        setRecurrenceInterval(1);
        setRepeatDays([ordinalInfo.dayName]);
        setEndConditionType('count');
        setOccurrencesCount(12);
        break;
      case 'BIWEEKLY_6S':
        setRecurrenceFreq('BIWEEKLY');
        setRecurrenceInterval(1);
        setRepeatDays([ordinalInfo.dayName]);
        setEndConditionType('count');
        setOccurrencesCount(6);
        break;
      case 'MONTHLY_6M':
        setRecurrenceFreq('MONTHLY_DATE');
        setRecurrenceInterval(1);
        setEndConditionType('count');
        setOccurrencesCount(6);
        break;
      case 'MONTHLY_12M':
        setRecurrenceFreq('MONTHLY_DATE');
        setRecurrenceInterval(1);
        setEndConditionType('count');
        setOccurrencesCount(12);
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage('Please enter a meeting title.');
      return;
    }
    if (!hostName.trim() || !hostEmail.trim()) {
      setErrorMessage('Host name and email are required.');
      return;
    }

    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (endMin <= startMin) {
      setErrorMessage('End time must be after start time.');
      return;
    }

    let confirmMessage = `Are you sure you want to ${editingBooking ? 'update this booking' : 'create this booking'} in ${currentRoom?.name} on ${date} from ${startTime} to ${endTime}?`;
    let multiDates: string[] | undefined = undefined;

    if (isRecurring && !editingBooking) {
      if (includedDates.length === 0) {
        setErrorMessage('Please select at least 1 date to book in this recurring series.');
        return;
      }

      // Check if any selected date is a strict hard block holiday
      const hardBlockedSelected = includedDates.filter(d => seriesHolidayMap.get(d)?.isHardBlock);
      if (hardBlockedSelected.length > 0) {
        const firstHard = seriesHolidayMap.get(hardBlockedSelected[0]);
        setErrorMessage(`Cannot book series: ${hardBlockedSelected.length} selected session(s) (${firstHard?.title} on ${hardBlockedSelected[0]}) have strict holiday booking lockouts. Click "Exclude Holidays" to proceed.`);
        return;
      }

      // Check conflicts among included dates
      const conflictingSelected = includedDates.filter(d => seriesDateConflictMap.has(d));
      if (conflictingSelected.length > 0) {
        setErrorMessage(`Conflict detected on ${conflictingSelected.length} selected date(s): ${conflictingSelected.join(', ')}. Click "Select Only Available" to book open dates or switch room.`);
        return;
      }

      multiDates = includedDates;
      confirmMessage = `Are you sure you want to book "${title.trim()}" in ${currentRoom?.name} for ${startTime} - ${endTime} across ${includedDates.length} recurring dates (${includedDates[0]} to ${includedDates[includedDates.length - 1]})?`;
      
      if (activeIncludedHolidays.length > 0) {
        confirmMessage += `\n\n⚠️ Holiday Notice: ${activeIncludedHolidays.length} selected dates fall on gazetted holidays / replacement leave.`;
      }
    } else {
      // Check hard block holiday for single date
      if (selectedDateHoliday?.isHardBlock) {
        setErrorMessage(`Room booking locked: ${selectedDateHoliday.title} on ${formatFriendlyDate(date)} is designated as a strict non-booking holiday/closure.`);
        return;
      }

      // Single day check
      const available = isRoomAvailable(
        roomId,
        date,
        startTime,
        endTime,
        bookings,
        editingBooking?.id
      );

      if (!available) {
        setErrorMessage('The selected room is occupied at this time. Please choose another time slot.');
        return;
      }

      if (selectedDateHoliday) {
        confirmMessage += `\n\n🌴 Notice: ${formatFriendlyDate(date)} is marked as ${selectedDateHoliday.type === 'public_holiday' ? 'Public Holiday' : 'Company Replacement Leave'} ("${selectedDateHoliday.title}").`;
      }
    }

    setIsSaving(true);
    let isCompleted = false;

    // Safety timeout timer: strictly terminate spinner if network hangs
    const safetyTimer = setTimeout(() => {
      if (!isCompleted) {
        setIsSaving(false);
        setErrorMessage('Booking request took longer than expected. Please check your calendar or try clicking Book again.');
      }
    }, 4500);

    try {
      await onSave({
        id: editingBooking?.id,
        roomId,
        floor: currentRoom?.floor || 1,
        title: title.trim(),
        description: description.trim(),
        date,
        startTime,
        endTime,
        hostName: hostName.trim(),
        hostEmail: hostEmail.trim(),
        hostUid: editingBooking?.hostUid || currentUser?.uid || 'anonymous',
        attendees,
        outlookSynced: editingBooking?.outlookSynced || false,
        googleEventId: syncGoogle ? editingBooking?.googleEventId : undefined,
        multiDates,
      });
      isCompleted = true;
      clearTimeout(safetyTimer);
      setIsSaving(false);
      onClose();
    } catch (err: any) {
      isCompleted = true;
      clearTimeout(safetyTimer);
      setIsSaving(false);
      console.error('Failed to save booking:', err);
      setErrorMessage(err.message || 'An error occurred while saving the booking.');
    } finally {
      isCompleted = true;
      clearTimeout(safetyTimer);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-slate-50 border-b border-slate-100 px-6 py-5 flex items-center justify-between">
          <div>
            <h3 className="font-sans font-bold text-slate-950 text-lg flex items-center gap-2">
              {editingBooking ? (
                isOwner ? 'Edit Meeting Room Reservation' : 'Meeting Reservation Details'
              ) : (
                <>
                  <span>Book a Meeting Room</span>
                  {isRecurring && (
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 font-mono px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1">
                      <Repeat className="w-3 h-3" /> Recurring Series ({includedDates.length} Days)
                    </span>
                  )}
                </>
              )}
              {editingBooking && !isOwner && (
                <span className="text-[10px] bg-slate-200 text-slate-700 font-mono px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Read Only
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              {editingBooking && !isOwner 
                ? `Reserved by ${editingBooking.hostName || 'Team Member'}`
                : 'Schedule single or recurring meetings across days, weeks, and months.'
              }
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {editingBooking && !isOwner && (
            <div className="p-3.5 bg-amber-50/70 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-950">Restricted Access (View-Only):</span>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  This reservation was created by <strong className="text-slate-900">{editingBooking.hostName} ({editingBooking.hostEmail})</strong>. To prevent accidental disruption, only the meeting owner or an authorized administrator can edit or cancel this booking.
                </p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* VISUAL OVERLAP & CONFLICT WARNING SYSTEM (Single-day mode) */}
          {isConflict && !isRecurring && directCollisions.length > 0 && (
            <div className="p-4 bg-gradient-to-br from-rose-50 via-rose-50/80 to-amber-50 border-2 border-rose-300 text-rose-950 rounded-2xl shadow-sm space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-600"></span>
                  </span>
                  <div>
                    <span className="text-xs font-black text-rose-900 tracking-tight uppercase flex items-center gap-1.5 font-mono">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                      Direct Room Booking Conflict Detected
                    </span>
                    <p className="text-[11px] text-rose-800 font-sans font-medium mt-0.5">
                      The selected time slot <strong className="font-mono bg-rose-100 px-1 py-0.5 rounded text-rose-900">{startTime} – {endTime}</strong> overlaps with {directCollisions.length} existing {directCollisions.length === 1 ? 'reservation' : 'reservations'} in <strong>{currentRoom?.name}</strong>.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-rose-200 text-rose-900 px-2.5 py-0.5 rounded-full font-bold uppercase shrink-0 border border-rose-300">
                  {directCollisions.length} {directCollisions.length === 1 ? 'Collision' : 'Collisions'}
                </span>
              </div>

              {/* Conflicting Booking Details with Overlap Span */}
              <div className="space-y-2">
                {detailedOverlapList.map((overlap) => (
                  <div 
                    key={overlap.booking.id} 
                    className="p-3 bg-white/95 rounded-xl border border-rose-200 text-xs shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between font-bold text-slate-800 gap-2 flex-wrap">
                      <span className="truncate max-w-[280px] text-rose-950 font-sans text-xs">
                        "{overlap.booking.title || 'Reserved Meeting'}"
                      </span>
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                          Booked: {overlap.booking.startTime} - {overlap.booking.endTime}
                        </span>
                        <span className="bg-rose-100 text-rose-900 px-2 py-0.5 rounded font-bold border border-rose-200">
                          ⚡ Overlaps: {overlap.overlapStart} - {overlap.overlapEnd} ({overlap.overlapMins} mins)
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between flex-wrap gap-1">
                      <span>Organizer: <strong className="text-slate-700">{overlap.booking.hostName || overlap.booking.hostEmail}</strong> ({overlap.booking.hostEmail})</span>
                      <span className="text-[10px] text-slate-400 font-mono">Room Level {overlap.booking.floor}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick 1-Click Available Open Slots on this Room */}
              {suggestedFreeSlots.length > 0 && (
                <div className="pt-2 border-t border-rose-200/80">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-rose-900 font-mono mb-1.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Suggested Open Slots Today for {currentRoom?.name}:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedFreeSlots.map((slot, sIdx) => (
                      <button
                        type="button"
                        key={sIdx}
                        onClick={() => {
                          setStartTime(slot.start);
                          setEndTime(slot.end);
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                      >
                        <Clock className="w-3 h-3" />
                        <span>Use {slot.start} – {slot.end}</span>
                        <span className="text-[10px] opacity-80 font-mono">({slot.duration}m)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Smart Alternative Rooms on the Same Floor */}
              {alternativeAvailableRoomsOnFloor.length > 0 && (
                <div className="pt-2 border-t border-rose-200/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-rose-800 font-mono mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>Available Alternative Spaces on Same Floor (Level {currentRoom?.floor}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {alternativeAvailableRoomsOnFloor.map((altRoom) => (
                      <button
                        type="button"
                        key={altRoom.id}
                        onClick={() => setRoomId(altRoom.id)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1 border border-slate-700"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Switch to {altRoom.name}</span>
                        <span className="text-[10px] text-slate-300">({altRoom.capacity} pax)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Smart Alternative Rooms on Other Floors in the Same Client Office */}
              {alternativeAvailableRoomsOtherFloors.length > 0 && (
                <div className="pt-2 border-t border-rose-200/60 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 font-mono flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-indigo-600" />
                    <span>Available Spaces on Other Floors of this Office:</span>
                  </div>
                  <div className="space-y-1.5">
                    {alternativeAvailableRoomsOtherFloors.map(({ floor, rooms: fRooms }) => (
                      <div key={floor} className="flex items-center gap-1.5 flex-wrap bg-white/70 p-1.5 rounded-lg border border-indigo-100">
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                          Level 0{floor}
                        </span>
                        {fRooms.map(altRoom => (
                          <button
                            type="button"
                            key={altRoom.id}
                            onClick={() => setRoomId(altRoom.id)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                            <span>Switch to {altRoom.name}</span>
                            <span className="text-[10px] text-indigo-200">({altRoom.capacity} pax)</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Room Selection and Base Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 font-mono flex items-center justify-between">
                <span>Meeting Room</span>
                {currentRoom && (
                  <span className="text-[10px] text-indigo-600 font-bold">
                    Level 0{currentRoom.floor} • Cap {currentRoom.capacity}
                  </span>
                )}
              </label>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white cursor-pointer"
              >
                {roomsByFloor.map(([floorNum, floorRooms]) => (
                  <optgroup key={floorNum} label={`Floor 0${floorNum} — ${floorRooms.length} Spaces`}>
                    {floorRooms.map(r => {
                      const isFree = isRoomAvailable(r.id, date, startTime, endTime, bookings, editingBooking?.id);
                      return (
                        <option key={r.id} value={r.id}>
                          {r.name} (Lvl {r.floor} • Cap {r.capacity}) — {isFree ? '✓ Available' : '⚠️ Busy'}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Base Date Picker */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 font-mono">
                {isRecurring ? 'First Session Date (Start Date)' : 'Date'}
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    const newDay = new Date(e.target.value).toLocaleDateString('en-US', { weekday: 'long' });
                    setRepeatDays([newDay]);
                  }}
                  className="w-full border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Cross-Floor Availability Matrix & Multi-Floor Quick Booking Explorer */}
          {crossFloorAvailabilitySummary.length > 1 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-800 font-mono uppercase tracking-wider">
                    Office Cross-Floor Availability
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    ({startTime} – {endTime})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCrossFloorExplorer(!showCrossFloorExplorer)}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                >
                  <span>{showCrossFloorExplorer ? 'Hide Details' : 'View All Floors'}</span>
                  {showCrossFloorExplorer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {/* Quick Floor Status Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {crossFloorAvailabilitySummary.map((fSummary) => {
                  const hasAvailable = fSummary.availableRooms.length > 0;
                  const isCurrent = fSummary.isCurrentFloor;

                  return (
                    <div
                      key={fSummary.floor}
                      className={`p-2 rounded-lg border text-xs flex flex-col justify-between transition-all ${
                        isCurrent
                          ? 'bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-300'
                          : hasAvailable
                          ? 'bg-white border-emerald-200 hover:border-emerald-300'
                          : 'bg-slate-100/70 border-slate-200 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold font-mono text-[10px] text-slate-700">
                          Lvl 0{fSummary.floor}
                        </span>
                        {isCurrent && (
                          <span className="text-[8px] font-mono bg-indigo-600 text-white px-1 rounded uppercase font-bold">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={hasAvailable ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                          {fSummary.availableRooms.length} / {fSummary.totalRooms} Free
                        </span>
                        {hasAvailable && !isCurrent && (
                          <button
                            type="button"
                            onClick={() => {
                              if (fSummary.availableRooms.length > 0) {
                                setRoomId(fSummary.availableRooms[0].id);
                              }
                            }}
                            className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                            title={`Switch to first available room on Level ${fSummary.floor}`}
                          >
                            Switch
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detailed Breakdown by Floor when expanded */}
              {showCrossFloorExplorer && (
                <div className="pt-2 border-t border-slate-200 space-y-2 mt-2">
                  <div className="text-[10px] font-mono font-bold uppercase text-slate-500">
                    Spaces on other floors for {date} from {startTime} to {endTime}:
                  </div>
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {crossFloorAvailabilitySummary.map((fSummary) => (
                      <div key={fSummary.floor} className="bg-white p-2 rounded-lg border border-slate-200 text-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-slate-800 flex items-center gap-1">
                            <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 font-bold">
                              Level 0{fSummary.floor}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              ({fSummary.availableRooms.length} available out of {fSummary.totalRooms})
                            </span>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {fSummary.availableRooms.map(r => (
                            <button
                              type="button"
                              key={r.id}
                              onClick={() => setRoomId(r.id)}
                              className={`px-2 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                                roomId === r.id
                                  ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              <span>{r.name}</span>
                              <span className="text-[9px] opacity-75 font-mono">({r.capacity} pax)</span>
                            </button>
                          ))}
                          {fSummary.busyRooms.map(r => (
                            <span
                              key={r.id}
                              className="px-2 py-1 rounded text-[11px] font-medium bg-slate-100 text-slate-400 border border-slate-200 flex items-center gap-1 cursor-not-allowed opacity-60"
                              title="Currently reserved for this time slot"
                            >
                              <AlertCircle className="w-3 h-3 text-slate-400" />
                              <span>{r.name}</span>
                              <span className="text-[9px] font-mono">(Busy)</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Holiday / Replacement Leave Notification Banner (Single Date Mode) */}
          {!isRecurring && selectedDateHoliday && (
            <div className={`p-4 rounded-2xl border transition-all space-y-2.5 animate-in fade-in zoom-in-95 duration-200 ${
              selectedDateHoliday.isHardBlock
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : selectedDateHoliday.type === 'public_holiday'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : selectedDateHoliday.type === 'replacement_leave'
                ? 'bg-violet-50 border-violet-300 text-violet-950'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl shrink-0">
                    {selectedDateHoliday.type === 'public_holiday' ? '🌴' : selectedDateHoliday.type === 'replacement_leave' ? '🏖️' : '🏢'}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black uppercase font-mono tracking-tight">
                        {selectedDateHoliday.type === 'public_holiday'
                          ? 'Gazetted Public Holiday'
                          : selectedDateHoliday.type === 'replacement_leave'
                          ? 'Company Replacement Leave (In-Lieu)'
                          : 'Company Office Closure'}
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                        selectedDateHoliday.type === 'public_holiday'
                          ? 'bg-emerald-200 text-emerald-900'
                          : selectedDateHoliday.type === 'replacement_leave'
                          ? 'bg-violet-200 text-violet-900'
                          : 'bg-amber-200 text-amber-900'
                      }`}>
                        {selectedDateHoliday.tenantId === 'ALL' ? 'Global Gazetted' : currentTenant?.name || 'Company Specific'}
                      </span>
                      {selectedDateHoliday.isHardBlock && (
                        <span className="text-[10px] bg-rose-200 text-rose-900 font-mono px-2 py-0.5 rounded font-black uppercase">
                          Strict Non-Booking Lockout
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-bold mt-0.5 text-slate-900">
                      {selectedDateHoliday.title}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-500 shrink-0">
                  {formatFriendlyDate(date)}
                </span>
              </div>

              {selectedDateHoliday.description && (
                <p className="text-xs opacity-90 leading-relaxed pl-9">
                  {selectedDateHoliday.description}
                </p>
              )}

              <div className={`text-[11px] font-medium rounded-xl p-2.5 flex items-center gap-2 ${
                selectedDateHoliday.isHardBlock
                  ? 'bg-rose-100/80 text-rose-900 font-semibold'
                  : 'bg-white/80 text-slate-700 border border-slate-200/60'
              }`}>
                <Info className="w-4 h-4 shrink-0 text-slate-600" />
                <span>
                  {selectedDateHoliday.isHardBlock
                    ? 'Room bookings are strictly disabled on this holiday / closure. Please choose another working date.'
                    : `Please note: The selected date is on a ${selectedDateHoliday.type === 'public_holiday' ? 'public holiday' : 'company replacement leave'}. Ensure all meeting attendees and office building access are confirmed.`}
                </span>
              </div>
            </div>
          )}

          {/* Times Selection & Dynamic Live Conflict Visualizer */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider font-mono">
                    Start Time
                  </label>
                  {isConflict && !isRecurring && (
                    <span className="text-[10px] font-bold text-rose-600 uppercase font-mono animate-pulse">
                      ⚠️ Conflict
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Clock className={`w-4 h-4 absolute left-3 top-3 transition-colors ${
                    isConflict && !isRecurring ? 'text-rose-500' : 'text-slate-400'
                  }`} />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    step="900" // 15-minute intervals
                    className={`w-full rounded-xl pl-10 pr-3 py-2 text-sm transition-all focus:outline-none ${
                      isConflict && !isRecurring
                        ? 'border-2 border-rose-400 focus:ring-2 focus:ring-rose-400 focus:border-rose-500 bg-rose-50/40 text-rose-950 font-bold shadow-xs'
                        : 'border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800'
                    }`}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider font-mono">
                    End Time
                  </label>
                  {timeToMinutes(endTime) > timeToMinutes(startTime) && (
                    <span className="text-[10px] font-bold text-slate-500 font-mono">
                      {Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime)) >= 60
                        ? `${Math.floor((timeToMinutes(endTime) - timeToMinutes(startTime)) / 60)}h ${(timeToMinutes(endTime) - timeToMinutes(startTime)) % 60 ? `${(timeToMinutes(endTime) - timeToMinutes(startTime)) % 60}m` : ''}`
                        : `${timeToMinutes(endTime) - timeToMinutes(startTime)}m`}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Clock className={`w-4 h-4 absolute left-3 top-3 transition-colors ${
                    isConflict && !isRecurring ? 'text-rose-500' : 'text-slate-400'
                  }`} />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    step="900" // 15-minute intervals
                    className={`w-full rounded-xl pl-10 pr-3 py-2 text-sm transition-all focus:outline-none ${
                      isConflict && !isRecurring
                        ? 'border-2 border-rose-400 focus:ring-2 focus:ring-rose-400 focus:border-rose-500 bg-rose-50/40 text-rose-950 font-bold shadow-xs'
                        : 'border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Time Validation & Room Availability Live Pill */}
            {!isRecurring && (
              <div className="space-y-2">
                {timeToMinutes(endTime) <= timeToMinutes(startTime) ? (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-semibold">End time must be later than the start time.</span>
                  </div>
                ) : isConflict ? (
                  <div className="p-3 bg-rose-50/90 border border-rose-200 rounded-xl text-xs text-rose-950 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Overlap with {detailedOverlapList.length} existing {detailedOverlapList.length === 1 ? 'reservation' : 'reservations'}:</span>
                      </div>
                      <span className="text-[10px] font-mono bg-rose-200 text-rose-900 px-2 py-0.5 rounded font-bold uppercase shrink-0">
                        Slot Unavailable
                      </span>
                    </div>

                    <div className="space-y-1">
                      {detailedOverlapList.map((overlap) => (
                        <div
                          key={overlap.booking.id}
                          className="flex items-center justify-between text-[11px] bg-white/90 px-2.5 py-1.5 rounded-lg border border-rose-200/80 font-medium text-slate-700"
                        >
                          <span className="truncate max-w-[220px]">
                            "{overlap.booking.title || 'Reserved'}" ({overlap.booking.hostName || overlap.booking.hostEmail})
                          </span>
                          <span className="font-mono text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded font-bold shrink-0">
                            Booked: {overlap.booking.startTime} - {overlap.booking.endTime} (Overlap: {overlap.overlapStart}-{overlap.overlapEnd})
                          </span>
                        </div>
                      ))}
                    </div>

                    {suggestedFreeSlots.length > 0 && (
                      <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-rose-900 uppercase font-mono">Suggested Open Slots:</span>
                        {suggestedFreeSlots.map((slot, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => {
                              setStartTime(slot.start);
                              setEndTime(slot.end);
                            }}
                            className="text-[10px] font-bold bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 hover:border-emerald-400 px-2 py-0.5 rounded-md transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <Clock className="w-2.5 h-2.5" />
                            <span>{slot.start} – {slot.end}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 text-emerald-950 rounded-xl text-xs flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{currentRoom?.name || 'Selected room'} is 100% available for this slot ({startTime} – {endTime})</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded uppercase">
                      Free Slot
                    </span>
                  </div>
                )}

                {/* Interactive Daily Room Timeline Strip (08:00 - 19:00) */}
                <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{currentRoom?.name} Daily Schedule ({formatFriendlyDate(date)})</span>
                    </span>
                    <span>08:00 – 19:00 Working Hours</span>
                  </div>

                  {/* Visual Bar Track */}
                  <div className="relative w-full h-8 bg-slate-200 rounded-lg overflow-hidden border border-slate-300">
                    {/* Background Hour Grid Lines */}
                    {[0, 120, 240, 360, 480, 600].map((minsOffset) => (
                      <div
                        key={minsOffset}
                        className="absolute top-0 bottom-0 border-r border-slate-300/80 pointer-events-none"
                        style={{ left: `${(minsOffset / 660) * 100}%` }}
                      />
                    ))}

                    {/* Existing Booked Slots on this Room */}
                    {currentRoomDayBookings.map((b) => {
                      const bStart = timeToMinutes(b.startTime);
                      const bEnd = timeToMinutes(b.endTime);
                      const left = Math.max(0, Math.min(100, ((bStart - 480) / 660) * 100));
                      const width = Math.max(2, Math.min(100 - left, ((bEnd - bStart) / 660) * 100));
                      return (
                        <div
                          key={b.id}
                          title={`Booked: ${b.title || 'Reserved'} (${b.startTime} - ${b.endTime})`}
                          className="absolute top-1 bottom-1 bg-slate-700 text-white rounded text-[9px] font-mono px-1 flex items-center justify-center truncate z-10 border border-slate-800 shadow-xs"
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          <span className="truncate opacity-90">{b.startTime}-{b.endTime}</span>
                        </div>
                      );
                    })}

                    {/* Current User Selection Preview Block */}
                    {timeToMinutes(endTime) > timeToMinutes(startTime) && (
                      (() => {
                        const selStart = timeToMinutes(startTime);
                        const selEnd = timeToMinutes(endTime);
                        const left = Math.max(0, Math.min(100, ((selStart - 480) / 660) * 100));
                        const width = Math.max(2, Math.min(100 - left, ((selEnd - selStart) / 660) * 100));
                        return (
                          <div
                            className={`absolute top-0 bottom-0 rounded-md z-20 transition-all border-2 flex items-center justify-center text-[9px] font-black font-mono shadow-sm ${
                              isConflict
                                ? 'bg-rose-500/50 border-rose-600 text-rose-950 backdrop-blur-xs animate-pulse'
                                : 'bg-emerald-500/40 border-emerald-600 text-emerald-950'
                            }`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                          >
                            <span className="truncate px-1 bg-white/90 rounded text-[9px] py-0.2 shadow-2xs">
                              {isConflict ? '⚠️ COLLISION' : '✓ SELECTED'}
                            </span>
                          </div>
                        );
                      })()
                    )}
                  </div>

                  {/* Time Legend Markers */}
                  <div className="flex justify-between text-[9px] font-mono text-slate-400 px-0.5">
                    <span>08:00</span>
                    <span>10:00</span>
                    <span>12:00</span>
                    <span>14:00</span>
                    <span>16:00</span>
                    <span>18:00</span>
                    <span>19:00</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* RECURRING BOOKING SERIES ENGINE (Days / Weeks / Months) */}
          {/* ========================================================================= */}
          {!editingBooking && (
            <div className="bg-gradient-to-b from-indigo-50/70 to-slate-50 border border-indigo-100 rounded-2xl p-4 space-y-4 shadow-2xs">
              
              {/* Header Toggle with Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl transition-colors ${isRecurring ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    <Repeat className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 tracking-tight font-sans">
                      Repeat this meeting (Recurring Series)
                    </h4>
                    <p className="text-[10px] text-slate-500 font-sans">
                      Book the same time slot across multiple days, weeks, or months with live conflict resolution.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="recurring-series-toggle"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* RECURRENCE BUILDER PANEL */}
              {isRecurring && (
                <div className="pt-3 border-t border-indigo-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                  
                  {/* 1-Click Quick Presets */}
                  <div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-2">
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span>Quick Presets</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyPreset('DAILY_5D')}
                        className="p-1.5 text-[10px] font-bold rounded-lg border border-indigo-200 bg-white/90 hover:bg-indigo-50 text-indigo-900 transition-all text-left truncate cursor-pointer shadow-2xs"
                      >
                        ⚡ Daily (5 Days)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('WEEKDAYS_1W')}
                        className="p-1.5 text-[10px] font-bold rounded-lg border border-indigo-200 bg-white/90 hover:bg-indigo-50 text-indigo-900 transition-all text-left truncate cursor-pointer shadow-2xs"
                      >
                        ⚡ Mon–Fri (5 days)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('WEEKLY_4W')}
                        className="p-1.5 text-[10px] font-bold rounded-lg border border-indigo-200 bg-white/90 hover:bg-indigo-50 text-indigo-900 transition-all text-left truncate cursor-pointer shadow-2xs"
                      >
                        ⚡ Weekly (4 Weeks / 1 Mo)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('WEEKLY_12W')}
                        className="p-1.5 text-[10px] font-bold rounded-lg border border-indigo-200 bg-white/90 hover:bg-indigo-50 text-indigo-900 transition-all text-left truncate cursor-pointer shadow-2xs"
                      >
                        ⚡ Weekly (12 Weeks / 3 Mo)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('BIWEEKLY_6S')}
                        className="p-1.5 text-[10px] font-bold rounded-lg border border-indigo-200 bg-white/90 hover:bg-indigo-50 text-indigo-900 transition-all text-left truncate cursor-pointer shadow-2xs"
                      >
                        ⚡ Bi-Weekly (6 Sessions)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('MONTHLY_6M')}
                        className="p-1.5 text-[10px] font-bold rounded-lg border border-indigo-200 bg-white/90 hover:bg-indigo-50 text-indigo-900 transition-all text-left truncate cursor-pointer shadow-2xs"
                      >
                        ⚡ Monthly (6 Months)
                      </button>
                    </div>
                  </div>

                  {/* Frequency Tabs */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-mono">
                      Recurrence Cadence
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 bg-slate-200/60 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setRecurrenceFreq('DAILY');
                          setRecurrenceInterval(1);
                        }}
                        className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                          recurrenceFreq === 'DAILY'
                            ? 'bg-white text-indigo-700 shadow-xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Daily
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRecurrenceFreq('WEEKDAYS');
                          setRecurrenceInterval(1);
                        }}
                        className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                          recurrenceFreq === 'WEEKDAYS'
                            ? 'bg-white text-indigo-700 shadow-xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Weekdays
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRecurrenceFreq('WEEKLY');
                          setRecurrenceInterval(1);
                        }}
                        className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                          recurrenceFreq === 'WEEKLY'
                            ? 'bg-white text-indigo-700 shadow-xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Weekly
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRecurrenceFreq('BIWEEKLY');
                          setRecurrenceInterval(1);
                        }}
                        className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                          recurrenceFreq === 'BIWEEKLY'
                            ? 'bg-white text-indigo-700 shadow-xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Bi-Weekly
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecurrenceFreq('MONTHLY_DATE')}
                        className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                          recurrenceFreq === 'MONTHLY_DATE' || recurrenceFreq === 'MONTHLY_DAY'
                            ? 'bg-white text-indigo-700 shadow-xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Monthly
                      </button>
                    </div>
                  </div>

                  {/* Custom Interval Stepper */}
                  <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase font-mono">Repeat every:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={recurrenceInterval}
                          onChange={(e) => setRecurrenceInterval(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
                          className="w-14 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-center bg-white text-slate-800"
                        />
                        <span className="font-semibold text-slate-700">
                          {recurrenceFreq === 'DAILY' 
                            ? (recurrenceInterval === 1 ? 'day' : 'days')
                            : recurrenceFreq === 'BIWEEKLY'
                              ? (recurrenceInterval === 1 ? 'fortnight (2 weeks)' : `${recurrenceInterval * 2} weeks`)
                              : recurrenceFreq === 'WEEKDAYS'
                                ? 'weekday cycle'
                                : recurrenceFreq.startsWith('MONTHLY')
                                  ? (recurrenceInterval === 1 ? 'month' : 'months')
                                  : (recurrenceInterval === 1 ? 'week' : 'weeks')
                          }
                        </span>
                      </div>
                    </div>

                    {/* Summary badge */}
                    <div className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md font-bold">
                      {recurrenceFreq === 'DAILY' && `Repeats every ${recurrenceInterval > 1 ? `${recurrenceInterval} days` : 'day'}`}
                      {recurrenceFreq === 'WEEKDAYS' && 'Repeats Mon through Fri'}
                      {recurrenceFreq === 'WEEKLY' && `Repeats every ${recurrenceInterval > 1 ? `${recurrenceInterval} weeks` : 'week'}`}
                      {recurrenceFreq === 'BIWEEKLY' && `Repeats bi-weekly (every ${recurrenceInterval * 2} weeks)`}
                      {recurrenceFreq.startsWith('MONTHLY') && `Repeats every ${recurrenceInterval > 1 ? `${recurrenceInterval} months` : 'month'}`}
                    </div>
                  </div>

                  {/* Monthly Sub-Options */}
                  {(recurrenceFreq === 'MONTHLY_DATE' || recurrenceFreq === 'MONTHLY_DAY') && (
                    <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100 flex items-center gap-3">
                      <span className="text-[10px] font-bold text-slate-500 uppercase font-mono">Monthly Rule:</span>
                      <div className="flex items-center gap-4 text-xs">
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-800">
                          <input
                            type="radio"
                            name="monthly_type"
                            checked={recurrenceFreq === 'MONTHLY_DATE'}
                            onChange={() => setRecurrenceFreq('MONTHLY_DATE')}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Same day of month (<strong>{date ? parseISODate(date).getDate() : '20'}th</strong> of each month)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-800">
                          <input
                            type="radio"
                            name="monthly_type"
                            checked={recurrenceFreq === 'MONTHLY_DAY'}
                            onChange={() => setRecurrenceFreq('MONTHLY_DAY')}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Relative day (<strong>{ordinalInfo.label}</strong> of each month)</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Days of the Week Selection (for Weekly, Bi-weekly, Custom) */}
                  {(recurrenceFreq === 'WEEKLY' || recurrenceFreq === 'BIWEEKLY' || recurrenceFreq === 'CUSTOM_DAYS') && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                          Repeat on Days of the Week
                        </label>
                        {/* Quick Day Presets */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setRepeatDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])}
                            className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                          >
                            Weekdays
                          </button>
                          <button
                            type="button"
                            onClick={() => setRepeatDays(['Monday', 'Wednesday', 'Friday'])}
                            className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                          >
                            MWF
                          </button>
                          <button
                            type="button"
                            onClick={() => setRepeatDays(['Tuesday', 'Thursday'])}
                            className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                          >
                            T/Th
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {DAYS_OF_WEEK.map(day => {
                          const isSelected = repeatDays.includes(day);
                          return (
                            <button
                              type="button"
                              key={day}
                              onClick={() => handleDayToggle(day)}
                              className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer border ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs font-black'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              {day.substring(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* End Condition Controls: Occurrences Count vs End Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white/90 p-3 rounded-xl border border-indigo-100">
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer mb-2">
                        <input
                          type="radio"
                          name="end_condition"
                          checked={endConditionType === 'count'}
                          onChange={() => setEndConditionType('count')}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-bold text-slate-800">End after Number of Sessions:</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={2}
                          max={52}
                          disabled={endConditionType !== 'count'}
                          value={occurrencesCount}
                          onChange={(e) => setOccurrencesCount(Math.max(2, Math.min(52, parseInt(e.target.value) || 2)))}
                          className="w-20 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white disabled:bg-slate-100 font-bold text-center"
                        />
                        <div className="flex gap-1">
                          {[4, 8, 12, 24].map(n => (
                            <button
                              type="button"
                              key={n}
                              onClick={() => {
                                setEndConditionType('count');
                                setOccurrencesCount(n);
                              }}
                              className={`text-[10px] font-bold px-2 py-1 rounded border transition-all cursor-pointer ${
                                endConditionType === 'count' && occurrencesCount === n
                                  ? 'bg-indigo-100 border-indigo-300 text-indigo-900 font-black'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {n}x
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 cursor-pointer mb-2">
                        <input
                          type="radio"
                          name="end_condition"
                          checked={endConditionType === 'until_date'}
                          onChange={() => setEndConditionType('until_date')}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-bold text-slate-800">End by Specific Date:</span>
                      </label>
                      <div className="relative">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="date"
                          min={date}
                          disabled={endConditionType !== 'until_date'}
                          value={recurrenceEndDate || addMonthsToDate(date, 3)}
                          onChange={(e) => setRecurrenceEndDate(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-xs text-slate-800 bg-white disabled:bg-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ========================================================================= */}
                  {/* GENERATED SERIES DATES & CONFLICT MATRIX PREVIEW */}
                  {/* ========================================================================= */}
                  <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3 shadow-md">
                    
                    {/* Header Summary & Smart Action */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <CalendarRange className="w-4 h-4 text-indigo-400" />
                          <span className="text-xs font-extrabold text-white">
                            Generated Recurring Schedule ({includedDates.length} of {generatedSeriesDates.length} Selected)
                          </span>
                        </div>
                        <div className="text-[10px] mt-0.5 space-y-0.5">
                          {activeIncludedConflicts.length === 0 ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <Check className="w-3 h-3" /> All {includedDates.length} selected sessions are 100% available!
                            </span>
                          ) : (
                            <span className="text-rose-400 font-bold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> {activeIncludedConflicts.length} of {includedDates.length} selected sessions have room conflicts!
                            </span>
                          )}
                          {activeIncludedHolidays.length > 0 && (
                            <div className="text-amber-300 font-bold flex items-center gap-1">
                              <span>🌴</span>
                              <span>{activeIncludedHolidays.length} selected date(s) are on public holidays or company replacement leave.</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Smart Filter Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {activeIncludedHolidays.length > 0 && (
                          <button
                            type="button"
                            onClick={handleExcludeHolidayDates}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                            title="Uncheck dates falling on holidays or replacement leave"
                          >
                            <span>🌴 Exclude Holidays ({activeIncludedHolidays.length})</span>
                          </button>
                        )}
                        {activeIncludedConflicts.length > 0 && (
                          <button
                            type="button"
                            onClick={handleSelectOnlyAvailableDates}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Select Only Available ({generatedSeriesDates.length - seriesDateConflictMap.size})</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleSelectAllDates}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                        >
                          Select All
                        </button>
                      </div>
                    </div>

                    {/* Interactive Scrollable Occurrence Dates Grid */}
                    <div className="max-h-40 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                      {generatedSeriesDates.map((dStr, idx) => {
                        const isIncluded = includedDates.includes(dStr);
                        const conflicts = seriesDateConflictMap.get(dStr);
                        const hasConflict = !!conflicts && conflicts.length > 0;
                        const dateHoliday = seriesHolidayMap.get(dStr);

                        return (
                          <div
                            key={dStr}
                            onClick={() => handleToggleDateInclusion(dStr)}
                            className={`p-2 rounded-xl border text-xs flex items-center justify-between transition-all cursor-pointer select-none ${
                              !isIncluded 
                                ? 'bg-slate-800/40 border-slate-800 text-slate-500 opacity-60'
                                : hasConflict
                                  ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                                  : dateHoliday
                                    ? dateHoliday.type === 'public_holiday'
                                      ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                                      : 'bg-violet-950/30 border-violet-800/60 text-violet-200'
                                    : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isIncluded}
                                onChange={() => handleToggleDateInclusion(dStr)}
                                className="rounded text-indigo-500 focus:ring-indigo-400 h-3.5 w-3.5 cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-[10px] font-mono text-slate-400 font-bold">
                                #{idx + 1}
                              </span>
                              <span className="font-bold font-sans">
                                {formatFriendlyDate(dStr)}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                ({dStr})
                              </span>
                              {dateHoliday && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 font-mono uppercase ${
                                  dateHoliday.type === 'public_holiday'
                                    ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                                    : 'bg-violet-900/60 text-violet-300 border border-violet-700'
                                }`} title={dateHoliday.description || dateHoliday.title}>
                                  <span>{dateHoliday.type === 'public_holiday' ? '🌴' : '🏖️'}</span>
                                  <span className="truncate max-w-[110px]">{dateHoliday.title}</span>
                                  {dateHoliday.isHardBlock && <span className="text-rose-400">(Locked)</span>}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {hasConflict ? (
                                <div className="text-right">
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-md">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    <span>Conflict ({conflicts[0]?.startTime}-{conflicts[0]?.endTime})</span>
                                  </span>
                                  <div className="text-[9px] text-rose-300/80 truncate max-w-[140px]">
                                    {conflicts[0]?.title || 'Reserved'}
                                  </div>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                                  <Check className="w-2.5 h-2.5" /> Free Slot
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Series Conflict Alternatives */}
                    {activeIncludedConflicts.length > 0 && seriesAlternativeRooms.length > 0 && (
                      <div className="pt-2 border-t border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center gap-1 mb-1.5">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          Recommended Rooms with Higher Availability for this Series:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {seriesAlternativeRooms.slice(0, 3).map(({ room: altR, availableCount, conflictCount }) => (
                            <button
                              type="button"
                              key={altR.id}
                              onClick={() => setRoomId(altR.id)}
                              className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-indigo-400/30"
                            >
                              <span>Switch to {altR.name} (Lvl {altR.floor})</span>
                              <span className="text-[10px] text-indigo-200 font-mono font-normal">
                                [{conflictCount === 0 ? '100% Free' : `${availableCount}/${includedDates.length} Free`}]
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>

                </div>
              )}

            </div>
          )}

          {/* Same-Floor Concurrent Booking Awareness Badge */}
          {!isConflict && !isRecurring && floorConcurrentBookings.length > 0 && (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="text-[11px]">
                  <strong>Floor {currentRoom?.floor} Activity:</strong> {floorConcurrentBookings.length} other {floorConcurrentBookings.length === 1 ? 'room is' : 'rooms are'} booked during this time ({floorConcurrentBookings.map(f => f.room.name).join(', ')})
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                This Room is Free
              </span>
            </div>
          )}

          {/* Meeting Details */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 font-mono">
              Meeting Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Product Sync / Sprint Planning"
              className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 font-mono">
              Description / Agenda
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly state meeting agenda and goals..."
              rows={2}
              className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Host Information */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1 font-mono">
              <UserCheck className="w-3.5 h-3.5" />
              Organizer Information
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                  Organizer Name
                </label>
                <input
                  type="text"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  className="w-full border border-slate-200 bg-white rounded-lg px-3 py-1.5 text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                  Organizer Email (Office Email)
                </label>
                <input
                  type="email"
                  value={hostEmail}
                  onChange={(e) => setHostEmail(e.target.value)}
                  className="w-full border border-slate-200 bg-white rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="name@company.com"
                />
                <p className="text-[9px] text-slate-400 mt-0.5 leading-none">
                  Confirmation email will be delivered to this address.
                </p>
              </div>
            </div>
          </div>

          {/* Attendee Management */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 font-mono flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              Attendees ({attendees.length})
            </label>
            
            {/* Form to add attendee */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={attendeeEmail}
                  onChange={(e) => setAttendeeEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAttendee(e);
                    }
                  }}
                  placeholder="collaborator@company.com"
                  className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="button"
                onClick={handleAddAttendee}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            {/* List of Attendees */}
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 border border-slate-100 p-3 rounded-xl bg-slate-50/50">
                {attendees.map((email, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 text-[11px] font-medium bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg border border-indigo-100"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttendee(index)}
                      className="text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100/50 rounded-full p-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Google Sync Toggles */}
          {googleSyncAvailable && (
            <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between border border-slate-100">
              <div className="flex gap-3">
                <Calendar className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Google Calendar Sync</h4>
                  <p className="text-[10px] text-slate-500">
                    Instantly sync this event series on your Google Calendar.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncGoogle}
                  onChange={(e) => setSyncGoogle(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            {editingBooking && !isOwner ? (
              <span className="flex items-center gap-1 text-slate-500 font-medium">
                <Lock className="w-3.5 h-3.5" /> Read-Only Mode
              </span>
            ) : isRecurring ? (
              <span className="flex items-center gap-1 text-indigo-600 font-bold">
                <Repeat className="w-3.5 h-3.5" />
                <span>{includedDates.length} sessions queued</span>
              </span>
            ) : (
              <>
                <Info className="w-3.5 h-3.5" />
                <span>Overlaps fully checked</span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {!isOwner ? (
              <button
                type="button"
                onClick={onClose}
                className="bg-slate-900 hover:bg-black text-white font-bold px-5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close Window
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSaving || isConflict || !!errorMessage}
                  className={`bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-md shadow-indigo-100 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    (isSaving || isConflict || !!errorMessage) ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : editingBooking ? (
                    'Update Booking'
                  ) : isRecurring ? (
                    <>
                      <span>Book Series ({includedDates.length} Sessions)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    'Book Room'
                  )}
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
