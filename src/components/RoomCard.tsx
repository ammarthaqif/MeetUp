import React, { useState } from 'react';
import { 
  Users, Tv, Wifi, Coffee, Compass, CheckCircle, HelpCircle, 
  ShieldAlert, Video, Clock, Sparkles, ArrowRight, Calendar, Info
} from 'lucide-react';
import { Room, Booking } from '../types';
import { timeToMinutes, minutesToTime, addDaysToDate, formatDateToISO } from '../utils';

interface RoomCardProps {
  room: Room;
  bookings: Booking[];
  selectedDate: string;
  onBookClick: (room: Room, startTime?: string, endTime?: string) => void;
}

interface UpcomingSlotInfo {
  slotLabel: string;
  timeRange: string;
  duration: string;
  context: string;
  rawStart: string;
  rawEnd: string;
  dateStr: string;
  dayLabel: string;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  bookings,
  selectedDate,
  onBookClick,
}) => {
  const [isTooltipHovered, setIsTooltipHovered] = useState(false);

  // Check if room is CURRENTLY in use right now
  const now = new Date();
  const todayStr = formatDateToISO(now);
  const currentMin = now.getHours() * 60 + now.getMinutes();

  const isToday = selectedDate === todayStr;
  const allRoomBookings = bookings.filter(b => b.roomId === room.id);
  const todayRoomBookings = allRoomBookings.filter(b => b.date === todayStr);
  const selectedDateBookings = allRoomBookings.filter(b => b.date === selectedDate);
  
  // Identify active current meeting if today
  let currentMeeting: Booking | undefined;
  const isOccupiedRightNow = isToday && todayRoomBookings.some(b => {
    const startMin = timeToMinutes(b.startTime);
    const endMin = timeToMinutes(b.endTime);
    const match = currentMin >= startMin && currentMin < endMin;
    if (match) currentMeeting = b;
    return match;
  });

  // Calculate the next upcoming availability slot for this room
  const computeNextAvailability = (): UpcomingSlotInfo | null => {
    // 1. If currently occupied today
    if (isToday && isOccupiedRightNow && currentMeeting) {
      const sortedToday = [...todayRoomBookings].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      
      // Advance past any back-to-back chained meetings
      let freeStartsMin = timeToMinutes(currentMeeting.endTime);
      let hasChained = true;
      while (hasChained) {
        const chainedBooking = sortedToday.find(b => {
          const bStart = timeToMinutes(b.startTime);
          const bEnd = timeToMinutes(b.endTime);
          return bStart <= freeStartsMin && bEnd > freeStartsMin;
        });
        if (chainedBooking) {
          freeStartsMin = timeToMinutes(chainedBooking.endTime);
        } else {
          hasChained = false;
        }
      }

      // Check for subsequent bookings today after freeStartsMin
      const nextBooking = sortedToday.find(b => timeToMinutes(b.startTime) > freeStartsMin);

      if (nextBooking) {
        const nextStartMin = timeToMinutes(nextBooking.startTime);
        const durationMin = nextStartMin - freeStartsMin;
        const durHours = Math.floor(durationMin / 60);
        const durRemainingMins = durationMin % 60;
        const durationStr = durHours > 0 
          ? `${durHours}h ${durRemainingMins > 0 ? `${durRemainingMins}m` : ''}` 
          : `${durRemainingMins} min`;

        return {
          slotLabel: `${formatTime12Hour(minutesToTime(freeStartsMin))} – ${formatTime12Hour(nextBooking.startTime)}`,
          timeRange: `${minutesToTime(freeStartsMin)} – ${nextBooking.startTime}`,
          duration: `${durationStr} free window`,
          context: `Before "${nextBooking.title}" at ${formatTime12Hour(nextBooking.startTime)}`,
          rawStart: minutesToTime(freeStartsMin),
          rawEnd: nextBooking.startTime,
          dateStr: todayStr,
          dayLabel: 'Today'
        };
      } else {
        // Free for remainder of the day
        if (freeStartsMin < 18 * 60) {
          const durationMin = (18 * 60) - freeStartsMin;
          const durHours = Math.floor(durationMin / 60);
          const durRemainingMins = durationMin % 60;
          const durationStr = durHours > 0 
            ? `${durHours}h ${durRemainingMins > 0 ? `${durRemainingMins}m` : ''}` 
            : `${durRemainingMins} min`;

          return {
            slotLabel: `${formatTime12Hour(minutesToTime(freeStartsMin))} onwards`,
            timeRange: `${minutesToTime(freeStartsMin)} – 18:00`,
            duration: `${durationStr} available`,
            context: 'Free for the rest of today until closing',
            rawStart: minutesToTime(freeStartsMin),
            rawEnd: '18:00',
            dateStr: todayStr,
            dayLabel: 'Today'
          };
        } else {
          // Room is booked till closing today - check tomorrow
          const tomorrowStr = addDaysToDate(todayStr, 1);
          const tomorrowBookings = allRoomBookings
            .filter(b => b.date === tomorrowStr)
            .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

          if (tomorrowBookings.length === 0) {
            return {
              slotLabel: 'Tomorrow, 08:00 AM onwards',
              timeRange: '08:00 – 18:00',
              duration: 'Full day open',
              context: 'No scheduled meetings tomorrow',
              rawStart: '08:00',
              rawEnd: '18:00',
              dateStr: tomorrowStr,
              dayLabel: 'Tomorrow'
            };
          } else {
            const firstBookingTomorrow = tomorrowBookings[0];
            const firstStartMin = timeToMinutes(firstBookingTomorrow.startTime);
            if (firstStartMin > 8 * 60) {
              return {
                slotLabel: `Tomorrow, 08:00 AM – ${formatTime12Hour(firstBookingTomorrow.startTime)}`,
                timeRange: `08:00 – ${firstBookingTomorrow.startTime}`,
                duration: `${Math.floor((firstStartMin - 480) / 60)}h open`,
                context: `Before "${firstBookingTomorrow.title}"`,
                rawStart: '08:00',
                rawEnd: firstBookingTomorrow.startTime,
                dateStr: tomorrowStr,
                dayLabel: 'Tomorrow'
              };
            } else {
              return {
                slotLabel: `Tomorrow after ${formatTime12Hour(firstBookingTomorrow.endTime)}`,
                timeRange: `${firstBookingTomorrow.endTime} – 18:00`,
                duration: 'After morning meeting',
                context: `Following "${firstBookingTomorrow.title}"`,
                rawStart: firstBookingTomorrow.endTime,
                rawEnd: '18:00',
                dateStr: tomorrowStr,
                dayLabel: 'Tomorrow'
              };
            }
          }
        }
      }
    }

    // 2. If viewing a specific date and the room has booked slots
    if (selectedDateBookings.length > 0) {
      const sortedSelected = [...selectedDateBookings].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      // Earliest morning gap
      if (timeToMinutes(sortedSelected[0].startTime) > 8 * 60) {
        return {
          slotLabel: `08:00 AM – ${formatTime12Hour(sortedSelected[0].startTime)}`,
          timeRange: `08:00 – ${sortedSelected[0].startTime}`,
          duration: 'Morning open slot',
          context: `Before "${sortedSelected[0].title}"`,
          rawStart: '08:00',
          rawEnd: sortedSelected[0].startTime,
          dateStr: selectedDate,
          dayLabel: isToday ? 'Today' : selectedDate
        };
      }
      
      // Gap between meetings
      for (let i = 0; i < sortedSelected.length - 1; i++) {
        const endCurrent = timeToMinutes(sortedSelected[i].endTime);
        const startNext = timeToMinutes(sortedSelected[i + 1].startTime);
        if (startNext - endCurrent >= 30) {
          return {
            slotLabel: `${formatTime12Hour(sortedSelected[i].endTime)} – ${formatTime12Hour(sortedSelected[i + 1].startTime)}`,
            timeRange: `${sortedSelected[i].endTime} – ${sortedSelected[i + 1].startTime}`,
            duration: `${startNext - endCurrent} min window`,
            context: `Between scheduled sessions`,
            rawStart: sortedSelected[i].endTime,
            rawEnd: sortedSelected[i + 1].startTime,
            dateStr: selectedDate,
            dayLabel: isToday ? 'Today' : selectedDate
          };
        }
      }

      // After last meeting
      const lastBooking = sortedSelected[sortedSelected.length - 1];
      const lastEndMin = timeToMinutes(lastBooking.endTime);
      if (lastEndMin < 18 * 60) {
        return {
          slotLabel: `${formatTime12Hour(lastBooking.endTime)} onwards`,
          timeRange: `${lastBooking.endTime} – 18:00`,
          duration: `${18 * 60 - lastEndMin} min available`,
          context: `After "${lastBooking.title}"`,
          rawStart: lastBooking.endTime,
          rawEnd: '18:00',
          dateStr: selectedDate,
          dayLabel: isToday ? 'Today' : selectedDate
        };
      }
    }

    return null;
  };

  const nextSlot = computeNextAvailability();

  // Helper to format 24h string into 12-hour AM/PM
  function formatTime12Hour(timeStr?: string | null): string {
    if (!timeStr || typeof timeStr !== 'string') return '';
    const parts = timeStr.split(':');
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    const validH = isNaN(h) ? 0 : h;
    const validM = isNaN(m) ? 0 : m;
    const period = validH >= 12 ? 'PM' : 'AM';
    const displayH = validH % 12 === 0 ? 12 : validH % 12;
    return `${displayH}:${String(validM).padStart(2, '0')} ${period}`;
  }

  // Helper to resolve icon for room amenities
  const getAmenityIcon = (amenity: string) => {
    const lower = amenity.toLowerCase();
    if (lower.includes('screen') || lower.includes('tv') || lower.includes('monitor')) {
      return <Tv className="w-3.5 h-3.5" />;
    }
    if (lower.includes('video') || lower.includes('conferencing') || lower.includes('camera')) {
      return <Video className="w-3.5 h-3.5" />;
    }
    if (lower.includes('whiteboard')) {
      return <Compass className="w-3.5 h-3.5" />;
    }
    if (lower.includes('catering') || lower.includes('coffee')) {
      return <Coffee className="w-3.5 h-3.5" />;
    }
    return <Wifi className="w-3.5 h-3.5" />;
  };

  return (
    <div
      id={`room-card-${room.id}`}
      className={`bg-white border border-slate-200 rounded p-4 shadow-sm hover:shadow transition-all flex flex-col justify-between relative group/card ${
        isOccupiedRightNow ? 'bg-indigo-50/10 border-l-4 border-l-indigo-500' : ''
      }`}
    >
      <div>
        {/* Top header line */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h3 className="font-sans font-bold text-slate-800 text-sm tracking-tight leading-tight">
              {room.name}
            </h3>
            <span className="text-[9px] text-slate-400 font-mono">FLOOR 0{room.floor} • RM {room.id.toUpperCase()}</span>
          </div>
          
          {/* Availability Status Badge with Hover Tooltip */}
          <div 
            className="relative"
            onMouseEnter={() => setIsTooltipHovered(true)}
            onMouseLeave={() => setIsTooltipHovered(false)}
          >
            {isOccupiedRightNow ? (
              <span className="flex items-center gap-1 text-[9px] font-black uppercase text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-sm cursor-help transition-all hover:bg-rose-100/80">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                Busy
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                FREE
              </span>
            )}

            {/* Hover Tooltip for Occupied Room Next Upcoming Slot */}
            {isOccupiedRightNow && nextSlot && isTooltipHovered && (
              <div 
                className="absolute right-0 top-full mt-1.5 w-64 bg-slate-900 text-white rounded-xl p-3 shadow-2xl border border-slate-700/80 z-50 animate-in fade-in zoom-in-95 duration-150 pointer-events-none"
                style={{ filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.3))' }}
              >
                {/* Arrow Pointer */}
                <div className="absolute -top-1.5 right-4 w-3 h-3 bg-slate-900 border-l border-t border-slate-700/80 rotate-45" />

                <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 mb-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Next Upcoming Availability</span>
                </div>

                <div className="text-xs font-extrabold text-slate-100 mb-0.5">
                  {nextSlot.slotLabel}
                </div>

                <div className="text-[10px] text-slate-300 font-sans leading-relaxed mb-2">
                  {nextSlot.context} • <strong className="text-emerald-300">{nextSlot.duration}</strong>
                </div>

                {currentMeeting && (
                  <div className="pt-1.5 border-t border-slate-800 text-[9px] text-slate-400 flex items-center justify-between">
                    <span>Active until {formatTime12Hour(currentMeeting.endTime)}</span>
                    <span className="font-mono text-indigo-300">Lvl 0{room.floor}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Capacity */}
        <div className="flex items-center gap-1 text-[10px] text-slate-600 mb-2 bg-slate-50 px-2 py-1 rounded border border-slate-200/50 w-fit font-mono">
          <Users className="w-3 h-3 text-indigo-500" />
          <span>CAPACITY: <strong className="text-slate-900 font-bold">{room.capacity} SEATS</strong></span>
        </div>

        {/* Description */}
        <p className="text-[11px] text-slate-500 leading-normal font-sans mb-3">
          {room.description}
        </p>

        {/* Current Meeting Overlay details with Next Slot preview */}
        {isOccupiedRightNow && currentMeeting && (
          <div className="bg-rose-50/70 border border-rose-100 rounded-lg p-2.5 mb-3 text-[10px] text-rose-900 space-y-1.5">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1 truncate">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Active: {currentMeeting.title}</span>
              </span>
              <span className="text-[9px] font-mono font-semibold text-rose-700 shrink-0">
                Ends {formatTime12Hour(currentMeeting.endTime)}
              </span>
            </div>

            {/* Next Availability Slot Banner with Hover Tooltip */}
            {nextSlot && (
              <div 
                onClick={() => onBookClick(room, nextSlot.rawStart, nextSlot.rawEnd)}
                className="group/next relative bg-white/90 hover:bg-emerald-50 border border-emerald-200 rounded p-1.5 text-[10px] text-slate-700 flex items-center justify-between transition-all cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="text-slate-600">Next Slot: <strong className="text-emerald-700 font-bold">{nextSlot.slotLabel}</strong></span>
                </div>
                <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-700 uppercase tracking-wide">
                  <span>Book</span>
                  <ArrowRight className="w-3 h-3 group-hover/next:translate-x-0.5 transition-transform" />
                </div>

                {/* Floating Tooltip on Hover */}
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 bg-slate-900 text-white p-2.5 rounded-xl shadow-2xl border border-slate-700 text-xs opacity-0 group-hover/next:opacity-100 transition-all duration-150 z-40">
                  <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase text-emerald-400 mb-1">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>Upcoming Availability Window</span>
                  </div>
                  <div className="text-xs font-bold text-white mb-0.5">
                    {nextSlot.slotLabel} ({nextSlot.dayLabel})
                  </div>
                  <div className="text-[10px] text-slate-300">
                    {nextSlot.context} ({nextSlot.duration})
                  </div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-r border-b border-slate-700 rotate-45" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Amenities Icons Row */}
        <div className="border-t border-slate-100 pt-2 mb-3">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block font-mono">
            Room Facilities
          </span>
          <div className="flex flex-wrap gap-1">
            {room.amenities.map((amenity, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded"
              >
                {getAmenityIcon(amenity)}
                <span>{amenity}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Booking button */}
      <div className="relative group/btn">
        <button
          id={`btn-book-room-${room.id}`}
          onClick={() => {
            if (isOccupiedRightNow && nextSlot) {
              onBookClick(room, nextSlot.rawStart, nextSlot.rawEnd);
            } else {
              onBookClick(room);
            }
          }}
          className={`w-full py-2 px-3 rounded text-[10px] font-bold uppercase tracking-wider text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            isOccupiedRightNow
              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-2xs'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
          }`}
        >
          {isOccupiedRightNow && <Clock className="w-3.5 h-3.5 text-slate-500" />}
          <span>{isOccupiedRightNow ? 'Book Next Slot' : 'Reserve Room'}</span>
        </button>

        {/* Tooltip on button hover when occupied */}
        {isOccupiedRightNow && nextSlot && (
          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-900/95 text-white p-2 rounded-lg shadow-xl border border-slate-700 text-[10px] opacity-0 group-hover/btn:opacity-100 transition-all duration-150 z-30 text-center">
            <span>Next Free Slot: <strong className="text-emerald-400 font-mono font-bold">{nextSlot.slotLabel}</strong></span>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-r border-b border-slate-700 rotate-45" />
          </div>
        )}
      </div>
    </div>
  );
};
