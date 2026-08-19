import React, { useState } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Users, Plus, 
  CheckCircle2, Sparkles, Filter, AlertCircle, ArrowUpRight, Check, Flame
} from 'lucide-react';
import { Room, Booking } from '../types';
import { 
  getMonthCalendarGrid, formatMonthYear, addMonthsToDate, formatDateToISO, 
  parseISODate, formatFriendlyDate, getBookingStatus 
} from '../utils';

interface MonthlyAvailabilityViewProps {
  rooms: Room[];
  bookings: Booking[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onCellClick: (room: Room, hour: string, date: string) => void;
  onBookingClick: (booking: Booking) => void;
  currentUserUid?: string;
  onCancelBooking?: (bookingId: string) => void;
  onSwitchToDayView?: (date: string) => void;
}

export const MonthlyAvailabilityView: React.FC<MonthlyAvailabilityViewProps> = ({
  rooms,
  bookings,
  selectedDate,
  onSelectDate,
  onCellClick,
  onBookingClick,
  currentUserUid,
  onCancelBooking,
  onSwitchToDayView,
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string>('all');
  const [viewedMonthDate, setViewedMonthDate] = useState<string>(selectedDate);

  const monthLabel = formatMonthYear(viewedMonthDate);
  const calendarGrid = getMonthCalendarGrid(viewedMonthDate, selectedDate);

  const handlePrevMonth = () => {
    setViewedMonthDate(prev => addMonthsToDate(prev, -1));
  };

  const handleNextMonth = () => {
    setViewedMonthDate(prev => addMonthsToDate(prev, 1));
  };

  const handleCurrentMonth = () => {
    const todayISO = formatDateToISO(new Date());
    setViewedMonthDate(todayISO);
    onSelectDate(todayISO);
  };

  const activeRooms = selectedRoomId === 'all' 
    ? rooms 
    : rooms.filter(r => r.id === selectedRoomId);

  const activeRoomObj = rooms.find(r => r.id === selectedRoomId);

  // Filter bookings for the entire viewed month
  const viewedBase = parseISODate(viewedMonthDate);
  const currentMonthNum = viewedBase.getMonth();
  const currentYearNum = viewedBase.getFullYear();

  const monthBookings = bookings.filter(b => {
    const d = parseISODate(b.date);
    return d.getFullYear() === currentYearNum && d.getMonth() === currentMonthNum && activeRooms.some(r => r.id === b.roomId);
  });

  // Selected Day data for the inspector panel
  const selectedDayBookings = bookings.filter(b => 
    b.date === selectedDate && activeRooms.some(r => r.id === b.roomId)
  );

  const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  return (
    <div id="monthly-availability-view" className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-4">
      
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        
        {/* Navigation & Month Title */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-md p-0.5">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-white text-slate-600 hover:text-indigo-600 rounded transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleCurrentMonth}
              className="px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-white rounded transition-colors"
            >
              This Month
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-white text-slate-600 hover:text-indigo-600 rounded transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-sans font-bold text-slate-800 text-sm tracking-tight">
              {monthLabel}
            </span>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono px-2 py-0.5 rounded font-bold uppercase">
              Month View
            </span>
          </div>
        </div>

        {/* Room Filter Selector & Stats */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
            {monthBookings.length} reservation{monthBookings.length === 1 ? '' : 's'} this month
          </span>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Rooms ({rooms.length})</option>
              {rooms.map(room => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>
        </div>

      </div>

      {/* 7-Column Calendar Month Grid */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        
        {/* Weekday Labels */}
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center font-mono text-[9px] text-slate-400 font-black py-2 tracking-wider">
          {WEEKDAYS.map(day => (
            <div key={day} className="py-0.5">
              {day}
            </div>
          ))}
        </div>

        {/* 42 Calendar Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 bg-slate-100/30">
          {calendarGrid.map((day, idx) => {
            const dayBookings = bookings.filter(
              b => b.date === day.dateStr && activeRooms.some(r => r.id === b.roomId)
            );

            const hasBookings = dayBookings.length > 0;
            const isBusy = dayBookings.length >= 3;
            const isSelected = day.dateStr === selectedDate;

            return (
              <div
                key={day.dateStr + idx}
                onClick={() => {
                  onSelectDate(day.dateStr);
                  // If clicking a date from adjacent month, also sync viewed month
                  if (!day.isCurrentMonth) {
                    setViewedMonthDate(day.dateStr);
                  }
                }}
                className={`min-h-[85px] sm:min-h-[105px] p-1.5 flex flex-col justify-between transition-colors relative group cursor-pointer ${
                  !day.isCurrentMonth 
                    ? 'bg-slate-50/50 text-slate-300' 
                    : isSelected 
                    ? 'bg-indigo-50/40 ring-1 ring-inset ring-indigo-500' 
                    : 'bg-white hover:bg-slate-50'
                }`}
              >
                {/* Day Cell Top: Date Number & Activity Dot */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold font-mono inline-flex items-center justify-center w-5 h-5 rounded-full ${
                    day.isToday 
                      ? 'bg-indigo-600 text-white' 
                      : isSelected 
                      ? 'bg-indigo-100 text-indigo-800' 
                      : day.isCurrentMonth 
                      ? 'text-slate-700' 
                      : 'text-slate-300'
                  }`}>
                    {day.dayNum}
                  </span>

                  {day.isCurrentMonth && (
                    <div className="flex items-center gap-1">
                      {hasBookings && (
                        <span className={`text-[8px] font-mono font-bold px-1 rounded ${
                          isBusy 
                            ? 'bg-rose-100 text-rose-700' 
                            : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {dayBookings.length}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Day Cell Middle: Mini booking chips */}
                <div className="my-1 space-y-0.5 overflow-hidden">
                  {dayBookings.slice(0, 2).map(b => {
                    const room = rooms.find(r => r.id === b.roomId);
                    const isOwn = b.hostUid === currentUserUid;
                    return (
                      <div
                        key={b.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onBookingClick(b);
                        }}
                        className={`px-1 py-0.5 rounded text-[8px] truncate font-sans font-medium flex items-center gap-0.5 border ${
                          isOwn 
                            ? 'bg-indigo-600 text-white border-indigo-700' 
                            : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                        }`}
                        title={`${b.startTime}-${b.endTime} ${room?.name}: ${b.title}`}
                      >
                        <span className="font-mono font-bold shrink-0">{b.startTime}</span>
                        <span className="truncate">{room?.name || b.title}</span>
                      </div>
                    );
                  })}

                  {dayBookings.length > 2 && (
                    <div className="text-[8px] text-slate-400 font-mono pl-1">
                      +{dayBookings.length - 2} more
                    </div>
                  )}
                </div>

                {/* Day Cell Bottom: Quick Book Action on Hover */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center justify-between text-[8px] text-slate-400 pt-0.5 border-t border-slate-100">
                  <span className="font-mono">{dayBookings.length === 0 ? 'Free' : `${dayBookings.length} booked`}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const targetRoom = activeRooms[0] || rooms[0];
                      if (targetRoom) {
                        onCellClick(targetRoom, '09:00', day.dateStr);
                      }
                    }}
                    className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5"
                    title={`Reserve room on ${day.dateStr}`}
                  >
                    <Plus className="w-2.5 h-2.5" /> Book
                  </button>
                </div>

              </div>
            );
          })}
        </div>

      </div>

      {/* Selected Day Inspector / Detailed Room Breakdown Panel */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-indigo-600" />
            <div>
              <span className="font-bold text-xs text-slate-800">
                Floor Schedule for {formatFriendlyDate(selectedDate)}
              </span>
              <span className="text-[10px] text-slate-500 ml-2 font-mono">
                ({selectedDayBookings.length} {selectedDayBookings.length === 1 ? 'reservation' : 'reservations'})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSwitchToDayView && (
              <button
                onClick={() => onSwitchToDayView(selectedDate)}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-white border border-slate-200 hover:border-indigo-300 px-2.5 py-1 rounded transition-colors"
              >
                <span>Open Full Day Matrix</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => {
                const targetRoom = activeRooms[0] || rooms[0];
                if (targetRoom) {
                  onCellClick(targetRoom, '09:00', selectedDate);
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-3 py-1 rounded flex items-center gap-1 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> New Reservation
            </button>
          </div>
        </div>

        {/* Room By Room Availability Cards for Selected Day */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {activeRooms.map(room => {
            const roomBookings = selectedDayBookings.filter(b => b.roomId === room.id);
            const isFullyAvailable = roomBookings.length === 0;

            return (
              <div 
                key={room.id}
                className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 truncate">{room.name}</span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                      isFullyAvailable 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}>
                      {isFullyAvailable ? 'All Day Available' : `${roomBookings.length} Booked`}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                    Cap: {room.capacity} • {room.amenities.slice(0, 2).join(', ')}
                  </div>
                </div>

                {/* Reserved slots preview */}
                <div className="space-y-1">
                  {roomBookings.length === 0 ? (
                    <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 py-1">
                      <Check className="w-3 h-3" /> No meetings scheduled
                    </div>
                  ) : (
                    roomBookings.map(b => (
                      <div
                        key={b.id}
                        onClick={() => onBookingClick(b)}
                        className="bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 rounded p-1.5 text-[10px] cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between font-mono font-bold text-slate-700 text-[9px]">
                          <span>{b.startTime} - {b.endTime}</span>
                          <span className="truncate max-w-[80px] font-normal text-slate-400">{b.hostName}</span>
                        </div>
                        <div className="font-medium text-slate-800 truncate mt-0.5">
                          {b.title}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Quick book button for this room */}
                <button
                  onClick={() => onCellClick(room, '09:00', selectedDate)}
                  className="w-full py-1 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded text-slate-600 hover:text-indigo-600 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Book {room.name}
                </button>
              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
};
