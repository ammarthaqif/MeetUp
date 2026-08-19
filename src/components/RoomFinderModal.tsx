import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Clock, Calendar, Users, MapPin, Sparkles, CheckCircle2, 
  AlertCircle, ArrowRight, X, Filter, Zap, ChevronRight, ShieldCheck,
  CalendarCheck, CalendarClock, Building2, SlidersHorizontal, RotateCcw
} from 'lucide-react';
import { Room, Booking } from '../types';
import { 
  timeToMinutes, minutesToTime, isRoomAvailable, 
  formatDateToISO, parseISODate, formatFriendlyDate, addDaysToDate 
} from '../utils';

interface RoomFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
  bookings: Booking[];
  currentFloor: number;
  initialDate: string;
  onProceedWithBooking: (room: Room, date: string, startTime: string, endTime: string) => void;
}

const DURATION_OPTIONS = [
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hour', minutes: 60 },
  { label: '1.5 hrs', minutes: 90 },
  { label: '2 hours', minutes: 120 },
  { label: '3 hours', minutes: 180 },
  { label: '4 hours', minutes: 240 },
  { label: 'Full Day (8 hrs)', minutes: 480 },
];

const POPULAR_START_TIMES = [
  '08:30', '09:00', '09:30', '10:00', '10:30', 
  '11:00', '11:30', '13:00', '13:30', '14:00', 
  '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
];

export const RoomFinderModal: React.FC<RoomFinderModalProps> = ({
  isOpen,
  onClose,
  rooms,
  bookings,
  currentFloor,
  initialDate,
  onProceedWithBooking,
}) => {
  const todayStr = useMemo(() => formatDateToISO(new Date()), []);
  const tomorrowStr = useMemo(() => addDaysToDate(todayStr, 1), [todayStr]);

  // Form parameters
  const [startTime, setStartTime] = useState<string>('10:00');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [dateMode, setDateMode] = useState<'specific' | 'earliest'>('specific');
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayStr);

  // Filters
  const [minCapacity, setMinCapacity] = useState<number>(0);
  const [selectedFloor, setSelectedFloor] = useState<number | 'all'>('all');
  const [requiredAmenities, setRequiredAmenities] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Calculated End Time
  const endTime = useMemo(() => {
    const startMin = timeToMinutes(startTime);
    const endMin = startMin + durationMinutes;
    return minutesToTime(Math.min(endMin, 23 * 60 + 59));
  }, [startTime, durationMinutes]);

  // Update selectedDate when modal opens or initialDate changes
  useEffect(() => {
    if (isOpen && initialDate) {
      setSelectedDate(initialDate);
    }
  }, [isOpen, initialDate]);

  // Extract all unique amenities in available rooms
  const allAmenities = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach(r => r.amenities?.forEach(a => set.add(a)));
    return Array.from(set);
  }, [rooms]);

  // Filter eligible rooms based on capacity, floor, amenities
  const eligibleRooms = useMemo(() => {
    return rooms.filter(room => {
      if (minCapacity > 0 && room.capacity < minCapacity) return false;
      if (selectedFloor !== 'all' && room.floor !== selectedFloor) return false;
      if (requiredAmenities.length > 0) {
        const hasAll = requiredAmenities.every(req => 
          room.amenities.some(a => a.toLowerCase().includes(req.toLowerCase()))
        );
        if (!hasAll) return false;
      }
      return true;
    });
  }, [rooms, minCapacity, selectedFloor, requiredAmenities]);

  // -------------------------------------------------------------
  // Availability Scan Engine
  // -------------------------------------------------------------

  // Check availability on the currently selected date
  const availableRoomsOnSelectedDate = useMemo(() => {
    if (!selectedDate || eligibleRooms.length === 0) return [];
    return eligibleRooms.filter(room => 
      isRoomAvailable(room.id, selectedDate, startTime, endTime, bookings)
    );
  }, [eligibleRooms, selectedDate, startTime, endTime, bookings]);

  // Search for the Earliest Available Date (Scanning next 30 days)
  const earliestAvailableResult = useMemo(() => {
    if (eligibleRooms.length === 0) return null;

    const startSearchDate = dateMode === 'earliest' ? todayStr : selectedDate;
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();

    // Check up to 30 days ahead
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const checkDate = addDaysToDate(todayStr, dayOffset);
      
      // If checking today, ensure start time is not in the past
      if (checkDate === todayStr) {
        const startMin = timeToMinutes(startTime);
        if (startMin <= currentMin) {
          continue; // Skip past times today
        }
      }

      const freeRooms = eligibleRooms.filter(room => 
        isRoomAvailable(room.id, checkDate, startTime, endTime, bookings)
      );

      if (freeRooms.length > 0) {
        return {
          date: checkDate,
          rooms: freeRooms,
          daysAway: dayOffset,
        };
      }
    }

    return null;
  }, [eligibleRooms, startTime, endTime, bookings, todayStr, dateMode, selectedDate]);

  // Alternative available time slots on the selected date if currently requested time is full
  const alternativeTimeSlotsOnDate = useMemo(() => {
    if (availableRoomsOnSelectedDate.length > 0 || !selectedDate || eligibleRooms.length === 0) {
      return [];
    }

    const alternatives: { startTime: string; endTime: string; freeRooms: Room[] }[] = [];
    const checkSlots = [
      '08:30', '09:00', '09:30', '10:00', '10:30', 
      '11:00', '11:30', '13:00', '13:30', '14:00', 
      '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
    ];

    for (const slotStart of checkSlots) {
      if (slotStart === startTime) continue;
      const slotStartMin = timeToMinutes(slotStart);
      const slotEndMin = slotStartMin + durationMinutes;
      if (slotEndMin > 19 * 60) continue; // Exclude after 7 PM
      const slotEnd = minutesToTime(slotEndMin);

      const free = eligibleRooms.filter(room => 
        isRoomAvailable(room.id, selectedDate, slotStart, slotEnd, bookings)
      );

      if (free.length > 0) {
        alternatives.push({
          startTime: slotStart,
          endTime: slotEnd,
          freeRooms: free,
        });
        if (alternatives.length >= 3) break; // Offer top 3 alternatives
      }
    }

    return alternatives;
  }, [availableRoomsOnSelectedDate, selectedDate, eligibleRooms, startTime, durationMinutes, bookings]);

  if (!isOpen) return null;

  const toggleAmenity = (amenity: string) => {
    setRequiredAmenities(prev => 
      prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
    );
  };

  const resetFilters = () => {
    setMinCapacity(0);
    setSelectedFloor('all');
    setRequiredAmenities([]);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 10 }}
        transition={{ duration: 0.15 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]"
      >
        
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-indigo-300 shadow-inner">
              <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight font-sans text-white">
                  Smart Room Finder
                </h2>
                <span className="text-[10px] font-mono font-bold uppercase bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
                  Instant Match
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 font-sans mt-0.5">
                Input your start time and duration to find available spaces and confirm reservations instantly.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Scroll Area */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Controls Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
            
            {/* Row 1: Start Time & Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Start Time Picker */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 font-mono flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Start Time</span>
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  />
                </div>

                {/* Popular Times Quick Chips */}
                <div className="flex items-center gap-1 flex-wrap mt-2">
                  {['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setStartTime(t)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                        startTime === t
                          ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Meeting Duration */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 font-mono flex items-center gap-1.5">
                    <HourglassIcon className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Duration</span>
                  </label>
                  <span className="text-[11px] font-bold font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    {startTime} → {endTime} ({durationMinutes >= 60 ? `${durationMinutes / 60}h` : `${durationMinutes}m`})
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {DURATION_OPTIONS.slice(0, 4).map(opt => (
                    <button
                      key={opt.minutes}
                      type="button"
                      onClick={() => setDurationMinutes(opt.minutes)}
                      className={`text-[11px] font-bold py-1.5 rounded-xl border transition-all text-center cursor-pointer ${
                        durationMinutes === opt.minutes
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                  {DURATION_OPTIONS.slice(4).map(opt => (
                    <button
                      key={opt.minutes}
                      type="button"
                      onClick={() => setDurationMinutes(opt.minutes)}
                      className={`text-[10px] font-bold py-1 rounded-xl border transition-all text-center cursor-pointer ${
                        durationMinutes === opt.minutes
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Row 2: Target Date Strategy (Earliest Recommended vs Defined Specific Date) */}
            <div className="pt-3 border-t border-slate-200/80">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setDateMode('specific')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      dateMode === 'specific'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Choose Specific Date</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDateMode('earliest')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      dateMode === 'earliest'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Earliest Available Date</span>
                  </button>
                </div>

                {/* Specific Date input if selected */}
                {dateMode === 'specific' && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedDate(todayStr)}
                      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        selectedDate === todayStr
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(tomorrowStr)}
                      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        selectedDate === tomorrowStr
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Tomorrow
                    </button>
                    <div className="relative flex items-center bg-white border border-slate-200 rounded-lg px-2.5 py-1 shadow-2xs">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="text-xs font-bold font-mono text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                      />
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Collapsible Advanced Filters (Capacity, Floor, Amenities) */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{showAdvancedFilters ? 'Hide Room Filters' : 'Refine by Floor, Capacity, & Amenities'}</span>
                {(minCapacity > 0 || selectedFloor !== 'all' || requiredAmenities.length > 0) && (
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                )}
              </button>

              <AnimatePresence>
                {showAdvancedFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden space-y-3 pt-3 mt-2 border-t border-slate-200"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      
                      {/* Min Capacity */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 font-mono mb-1">
                          Minimum Attendees
                        </label>
                        <select
                          value={minCapacity}
                          onChange={(e) => setMinCapacity(Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value={0}>Any Size</option>
                          <option value={4}>4+ People</option>
                          <option value={8}>8+ People</option>
                          <option value={12}>12+ People (Conference)</option>
                          <option value={20}>20+ People (Boardroom)</option>
                        </select>
                      </div>

                      {/* Floor filter */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 font-mono mb-1">
                          Building Floor
                        </label>
                        <select
                          value={selectedFloor}
                          onChange={(e) => setSelectedFloor(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="all">All Floors</option>
                          <option value={1}>Floor 1 (Guest & Events)</option>
                          <option value={2}>Floor 2 (Creative & Co-Working)</option>
                          <option value={3}>Floor 3 (Engineering & Quiet)</option>
                          <option value={4}>Floor 4 (Executive)</option>
                        </select>
                      </div>

                    </div>

                    {/* Amenities list */}
                    {allAmenities.length > 0 && (
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 font-mono mb-1.5">
                          Required Features
                        </label>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {allAmenities.map(amenity => {
                            const isSelected = requiredAmenities.includes(amenity);
                            return (
                              <button
                                key={amenity}
                                type="button"
                                onClick={() => toggleAmenity(amenity)}
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {amenity}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(minCapacity > 0 || selectedFloor !== 'all' || requiredAmenities.length > 0) && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="text-[10px] text-rose-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset Filter Settings
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>

          {/* ------------------------------------------------------------- */}
          {/* SEARCH RESULTS & RECOMMENDATION MATRIX */}
          {/* ------------------------------------------------------------- */}

          {/* Mode 1: Defined Specific Date Results */}
          {dateMode === 'specific' && (
            <div className="space-y-4">
              
              {/* Outcome A: Rooms ARE Available on this date */}
              {availableRoomsOnSelectedDate.length > 0 ? (
                <div className="space-y-3">
                  
                  {/* Status Banner */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-start justify-between gap-3 text-emerald-950">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-emerald-600 text-white rounded-xl shadow-xs mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black uppercase tracking-tight text-emerald-900">
                            Available Now: {availableRoomsOnSelectedDate.length} {availableRoomsOnSelectedDate.length === 1 ? 'Space' : 'Spaces'} Found
                          </h4>
                          <span className="bg-emerald-200/60 text-emerald-800 text-[10px] font-bold px-2 py-0.2 rounded font-mono">
                            Ready to Book
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-800 mt-0.5">
                          Rooms are open on <span className="font-bold">{formatFriendlyDate(selectedDate)}</span> for <span className="font-bold">{startTime} – {endTime}</span> ({durationMinutes >= 60 ? `${durationMinutes / 60}h` : `${durationMinutes}m`}).
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Available Room Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availableRoomsOnSelectedDate.map(room => (
                      <div
                        key={room.id}
                        className="bg-white border border-slate-200 hover:border-indigo-500 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3 group"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div>
                              <span className="text-[9px] font-bold font-mono px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100">
                                FLOOR 0{room.floor}
                              </span>
                              <h4 className="font-sans font-black text-slate-900 text-sm tracking-tight mt-1 group-hover:text-indigo-600 transition-colors">
                                {room.name}
                              </h4>
                            </div>
                            <span className="text-xs font-bold font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded-lg flex items-center gap-1 shrink-0">
                              <Users className="w-3.5 h-3.5 text-slate-500" />
                              {room.capacity}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {room.description}
                          </p>

                          {room.amenities && room.amenities.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap pt-2">
                              {room.amenities.slice(0, 3).map(a => (
                                <span key={a} className="text-[9px] font-mono text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                                  {a}
                                </span>
                              ))}
                              {room.amenities.length > 3 && (
                                <span className="text-[9px] font-mono text-slate-400">
                                  +{room.amenities.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onProceedWithBooking(room, selectedDate, startTime, endTime);
                            onClose();
                          }}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider py-2.5 rounded-xl transition-all shadow-xs hover:shadow flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>Proceed with Reservation</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                </div>
              ) : (
                
                /* Outcome B: NO Rooms Available on this specific date */
                <div className="space-y-4">
                  
                  {/* Alert banner */}
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-950 space-y-2">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-tight text-rose-900">
                          No Rooms Available on {formatFriendlyDate(selectedDate)} for {startTime} – {endTime}
                        </h4>
                        <p className="text-[11px] text-rose-700 mt-0.5">
                          All rooms meeting your criteria are already booked for this time window. See smart recommendations below:
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Recommendation 1: Earliest Available Date */}
                  {earliestAvailableResult && (
                    <div className="bg-gradient-to-br from-indigo-50/70 to-violet-50/70 border border-indigo-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4.5 h-4.5 text-indigo-600" />
                          <h4 className="font-sans font-bold text-xs text-indigo-950 uppercase tracking-tight">
                            Earliest Available Date for {startTime} – {endTime}
                          </h4>
                        </div>
                        <span className="text-[10px] font-bold font-mono bg-indigo-600 text-white px-2 py-0.5 rounded-md">
                          {earliestAvailableResult.daysAway === 1 ? 'Tomorrow' : `${earliestAvailableResult.daysAway} days away`}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700">
                        The requested time slot is completely open on <span className="font-black text-indigo-900">{formatFriendlyDate(earliestAvailableResult.date)}</span> across <span className="font-bold">{earliestAvailableResult.rooms.length} rooms</span>:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {earliestAvailableResult.rooms.slice(0, 2).map(r => (
                          <div key={r.id} className="bg-white rounded-xl p-3 border border-indigo-100 flex items-center justify-between shadow-2xs">
                            <div>
                              <div className="text-xs font-bold text-slate-800">{r.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">Floor 0{r.floor} • {r.capacity} Seats</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                onProceedWithBooking(r, earliestAvailableResult.date, startTime, endTime);
                                onClose();
                              }}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              Book
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedDate(earliestAvailableResult.date)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 pt-1 cursor-pointer"
                      >
                        <span>Switch view to {formatFriendlyDate(earliestAvailableResult.date)}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Recommendation 2: Alternative Time Slots on the SAME Date */}
                  {alternativeTimeSlotsOnDate.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-slate-700" />
                        <h4 className="font-sans font-bold text-xs text-slate-800 uppercase tracking-tight">
                          Alternative Free Slots on {formatFriendlyDate(selectedDate)}
                        </h4>
                      </div>

                      <div className="space-y-2">
                        {alternativeTimeSlotsOnDate.map(alt => (
                          <div
                            key={alt.startTime}
                            className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-colors"
                          >
                            <div>
                              <div className="text-xs font-black font-mono text-slate-800">
                                {alt.startTime} – {alt.endTime}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {alt.freeRooms.length} room{alt.freeRooms.length > 1 ? 's' : ''} free ({alt.freeRooms.map(r => r.name).join(', ')})
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setStartTime(alt.startTime);
                              }}
                              className="bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 font-bold text-[11px] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              Select Slot
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          )}

          {/* Mode 2: Earliest Available Date Strategy Results */}
          {dateMode === 'earliest' && (
            <div className="space-y-4">
              {earliestAvailableResult ? (
                <div className="space-y-3">
                  
                  {/* Earliest Banner */}
                  <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-4 shadow-sm flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                        <Sparkles className="w-5 h-5 fill-amber-400" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase text-amber-400 tracking-wider">
                          Earliest Available Match
                        </span>
                        <h3 className="text-sm font-black tracking-tight text-white mt-0.5">
                          {formatFriendlyDate(earliestAvailableResult.date)} ({earliestAvailableResult.daysAway === 0 ? 'Today' : earliestAvailableResult.daysAway === 1 ? 'Tomorrow' : `${earliestAvailableResult.daysAway} days ahead`})
                        </h3>
                        <p className="text-[11px] text-indigo-200 font-mono mt-0.5">
                          Time Slot: {startTime} – {endTime} ({durationMinutes >= 60 ? `${durationMinutes / 60}h` : `${durationMinutes}m`})
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-bold font-mono bg-white/10 px-2.5 py-1 rounded-lg border border-white/15 shrink-0">
                      {earliestAvailableResult.rooms.length} Rooms
                    </span>
                  </div>

                  {/* Room Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {earliestAvailableResult.rooms.map(room => (
                      <div
                        key={room.id}
                        className="bg-white border border-slate-200 hover:border-indigo-500 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3 group"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div>
                              <span className="text-[9px] font-bold font-mono px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100">
                                FLOOR 0{room.floor}
                              </span>
                              <h4 className="font-sans font-black text-slate-900 text-sm tracking-tight mt-1 group-hover:text-indigo-600 transition-colors">
                                {room.name}
                              </h4>
                            </div>
                            <span className="text-xs font-bold font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded-lg flex items-center gap-1 shrink-0">
                              <Users className="w-3.5 h-3.5 text-slate-500" />
                              {room.capacity}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {room.description}
                          </p>

                          {room.amenities && room.amenities.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap pt-2">
                              {room.amenities.slice(0, 3).map(a => (
                                <span key={a} className="text-[9px] font-mono text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                                  {a}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onProceedWithBooking(room, earliestAvailableResult.date, startTime, endTime);
                            onClose();
                          }}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider py-2.5 rounded-xl transition-all shadow-xs hover:shadow flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>Proceed with Reservation</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center space-y-2">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                  <h4 className="text-xs font-bold text-slate-700 uppercase">No Available Slots Found</h4>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    No matching rooms could be found for {startTime} – {endTime} in the next 30 days. Try relaxing your filters or adjusting meeting duration.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-mono shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Instant conflict checking active</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </motion.div>
    </div>
  );
};

// Helper Mini Icon
function HourglassIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 22h14" />
      <path d="M5 2h14" />
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </svg>
  );
}
