import React from 'react';
import { Users, Tv, Wifi, Coffee, Compass, CheckCircle, HelpCircle, ShieldAlert, Video } from 'lucide-react';
import { Room, Booking } from '../types';

interface RoomCardProps {
  room: Room;
  bookings: Booking[];
  selectedDate: string;
  onBookClick: (room: Room) => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  bookings,
  selectedDate,
  onBookClick,
}) => {
  // Check if room is CURRENTLY in use right now
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMin = now.getHours() * 60 + now.getMinutes();

  const isToday = selectedDate === todayStr;
  const roomBookings = bookings.filter(b => b.roomId === room.id && b.date === selectedDate);
  
  let currentMeetingName = '';
  const isOccupiedRightNow = isToday && roomBookings.some(b => {
    const [sh, sm] = b.startTime.split(':').map(Number);
    const [eh, em] = b.endTime.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const match = currentMin >= startMin && currentMin < endMin;
    if (match) currentMeetingName = b.title;
    return match;
  });

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

  const getThemeColors = (color: string) => {
    switch (color) {
      case 'indigo': return { text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', fill: 'bg-indigo-600' };
      case 'emerald': return { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', fill: 'bg-emerald-600' };
      case 'sky': return { text: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100', fill: 'bg-sky-600' };
      case 'violet': return { text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', fill: 'bg-violet-600' };
      case 'rose': return { text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', fill: 'bg-rose-600' };
      case 'teal': return { text: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100', fill: 'bg-teal-600' };
      case 'cyan': return { text: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-100', fill: 'bg-cyan-600' };
      case 'fuchsia': return { text: 'text-fuchsia-600', bg: 'bg-fuchsia-50', border: 'border-fuchsia-100', fill: 'bg-fuchsia-600' };
      case 'purple': return { text: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', fill: 'bg-purple-600' };
      case 'blue': return { text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', fill: 'bg-blue-600' };
      default: return { text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100', fill: 'bg-slate-600' };
    }
  };

  const theme = getThemeColors(room.color);

  return (
    <div
      id={`room-card-${room.id}`}
      className={`bg-white border border-slate-200 rounded p-4 shadow-sm hover:shadow transition-all flex flex-col justify-between ${
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
          
          {/* Availability Status Badge */}
          {isOccupiedRightNow ? (
            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              Busy
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              FREE
            </span>
          )}
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

        {/* Current Meeting Overlay details */}
        {isOccupiedRightNow && currentMeetingName && (
          <div className="bg-rose-50/60 border border-rose-100 rounded p-2 mb-3 text-[10px] text-rose-800 font-medium">
            <span className="flex items-center gap-1 font-bold">
              <ShieldAlert className="w-3 h-3 shrink-0" />
              Active: {currentMeetingName}
            </span>
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
      <button
        id={`btn-book-room-${room.id}`}
        onClick={() => onBookClick(room)}
        className={`w-full py-2 px-3 rounded text-[10px] font-bold uppercase tracking-wider text-center transition-all cursor-pointer ${
          isOccupiedRightNow
            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
        }`}
      >
        {isOccupiedRightNow ? 'Book Next Slot' : 'Reserve Room'}
      </button>
    </div>
  );
};
