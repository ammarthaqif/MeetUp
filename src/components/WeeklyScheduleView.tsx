import React, { useState } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Users, Plus, 
  CheckCircle2, Sparkles, Filter, AlertCircle, ArrowUpRight
} from 'lucide-react';
import { Room, Booking, BlockedDate, Tenant } from '../types';
import { 
  getWeekDates, formatWeekRange, addDaysToDate, formatDateToISO, 
  timeToMinutes, getBookingStatus 
} from '../utils';

interface WeeklyScheduleViewProps {
  rooms: Room[];
  bookings: Booking[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onCellClick: (room: Room, hour: string, date: string) => void;
  onBookingClick: (booking: Booking) => void;
  currentUserUid?: string;
  onCancelBooking?: (bookingId: string) => void;
  onSwitchToDayView?: (date: string) => void;
  blockedDates?: BlockedDate[];
  currentTenant?: Tenant | null;
}

export const WeeklyScheduleView: React.FC<WeeklyScheduleViewProps> = ({
  rooms,
  bookings,
  selectedDate,
  onSelectDate,
  onCellClick,
  onBookingClick,
  currentUserUid,
  onCancelBooking,
  onSwitchToDayView,
  blockedDates = [],
  currentTenant = null,
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string>('all');
  const [viewLayout, setViewLayout] = useState<'grid' | 'timeline'>('timeline');

  const getHolidayForDay = (dateStr: string): BlockedDate | null => {
    return blockedDates.find(b => {
      if (!b.active) return false;
      const matchesTenant = b.tenantId === 'ALL' || b.tenantId === currentTenant?.id;
      if (!matchesTenant) return false;
      if (b.date === dateStr) return true;
      if (b.endDate && dateStr >= b.date && dateStr <= b.endDate) return true;
      return false;
    }) || null;
  };

  const weekDays = getWeekDates(selectedDate, selectedDate);
  const weekRangeLabel = formatWeekRange(weekDays);

  const startHour = 8;
  const endHour = 19;
  const totalHours = endHour - startHour;
  const startMinutes = startHour * 60;
  const totalMinutes = totalHours * 60;

  const hoursArray = Array.from({ length: totalHours }, (_, i) => {
    const hr = startHour + i;
    const period = hr >= 12 ? 'PM' : 'AM';
    const displayHr = hr > 12 ? hr - 12 : hr;
    return `${displayHr}:00 ${period}`;
  });

  const hoursRaw = Array.from({ length: totalHours }, (_, i) => {
    const hr = startHour + i;
    return `${String(hr).padStart(2, '0')}:00`;
  });

  const handlePrevWeek = () => {
    onSelectDate(addDaysToDate(selectedDate, -7));
  };

  const handleNextWeek = () => {
    onSelectDate(addDaysToDate(selectedDate, 7));
  };

  const handleToday = () => {
    onSelectDate(formatDateToISO(new Date()));
  };

  const activeRooms = selectedRoomId === 'all' 
    ? rooms 
    : rooms.filter(r => r.id === selectedRoomId);

  const activeRoomObj = rooms.find(r => r.id === selectedRoomId);

  return (
    <div id="weekly-schedule-view" className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-4">
      
      {/* Top Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        
        {/* Navigation & Title */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-md p-0.5">
            <button
              onClick={handlePrevWeek}
              className="p-1 hover:bg-white text-slate-600 hover:text-indigo-600 rounded transition-colors"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-white rounded transition-colors"
            >
              This Week
            </button>
            <button
              onClick={handleNextWeek}
              className="p-1 hover:bg-white text-slate-600 hover:text-indigo-600 rounded transition-colors"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-sans font-bold text-slate-800 text-sm tracking-tight">
              {weekRangeLabel}
            </span>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono px-2 py-0.5 rounded font-bold uppercase">
              Week View
            </span>
          </div>
        </div>

        {/* Room Filter Selector & Layout Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
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
                  {room.name} (Cap: {room.capacity})
                </option>
              ))}
            </select>
          </div>

          {selectedRoomId !== 'all' && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-md text-[10px] font-bold">
              <button
                onClick={() => setViewLayout('timeline')}
                className={`px-2 py-1 rounded transition-colors ${
                  viewLayout === 'timeline' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
                }`}
              >
                Hourly Grid
              </button>
              <button
                onClick={() => setViewLayout('grid')}
                className={`px-2 py-1 rounded transition-colors ${
                  viewLayout === 'grid' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
                }`}
              >
                Cards
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Mode 1: Selected Single Room 7-Day Timeline Matrix (Detailed Hourly View) */}
      {selectedRoomId !== 'all' && activeRoomObj && viewLayout === 'timeline' ? (
        <div className="space-y-3">
          {/* Room quick banner */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-600" />
              <span className="font-bold text-xs text-slate-800">{activeRoomObj.name}</span>
              <span className="text-[10px] font-mono text-slate-400">| Capacity: {activeRoomObj.capacity}</span>
              <span className="text-[10px] text-slate-500 hidden sm:inline">• {activeRoomObj.amenities.slice(0, 2).join(', ')}</span>
            </div>
            <button
              onClick={() => onCellClick(activeRoomObj, '09:00', selectedDate)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-2.5 py-1 rounded flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" /> Book {activeRoomObj.name}
            </button>
          </div>

          {/* 7-Day Matrix for this single room */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <div className="min-w-[800px]">
              
              {/* Header row: 7 days */}
              <div className="grid grid-cols-8 bg-slate-50 border-b border-slate-200 text-center font-mono text-[9px] text-slate-500 font-bold py-2">
                <div className="text-slate-400 border-r border-slate-200 flex items-center justify-center">
                  TIME
                </div>
                {weekDays.map(day => {
                  const dayHoliday = getHolidayForDay(day.dateStr);
                  return (
                    <div 
                      key={day.dateStr}
                      onClick={() => onSelectDate(day.dateStr)}
                      className={`px-1 py-1 cursor-pointer transition-colors border-r last:border-r-0 border-slate-200 ${
                        day.isSelected ? 'bg-indigo-50/80 text-indigo-900 font-black' : dayHoliday ? (dayHoliday.type === 'public_holiday' ? 'bg-emerald-50/40' : 'bg-violet-50/40') : 'hover:bg-slate-100'
                      }`}
                    >
                      <div className="uppercase tracking-wider flex items-center justify-center gap-1">
                        <span>{day.shortDay}</span>
                        {dayHoliday && (
                          <span title={`${dayHoliday.title} (${dayHoliday.type === 'public_holiday' ? 'Public Holiday' : 'Replacement Leave'})`}>
                            {dayHoliday.type === 'public_holiday' ? '🌴' : '🏖️'}
                          </span>
                        )}
                      </div>
                      <div className={`text-xs inline-block px-1.5 py-0.5 rounded-full font-bold mt-0.5 ${
                        day.isToday ? 'bg-indigo-600 text-white' : ''
                      }`}>
                        {day.dayNum}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Rows: Each hour */}
              <div className="divide-y divide-slate-100 relative">
                {hoursRaw.map((hour, hrIdx) => {
                  const hourStartMin = timeToMinutes(hour);
                  const hourEndMin = hourStartMin + 60;

                  return (
                    <div key={hour} className="grid grid-cols-8 h-12 relative group">
                      
                      {/* Hour label */}
                      <div className="text-[10px] font-mono text-slate-400 border-r border-slate-200 flex items-center justify-center bg-slate-50/30 px-1 select-none">
                        {hoursArray[hrIdx]}
                      </div>

                      {/* 7 Day slots */}
                      {weekDays.map(day => {
                        const dayBookings = bookings.filter(
                          b => b.roomId === activeRoomObj.id && b.date === day.dateStr
                        );

                        // Find booking that starts in this hour or overlaps
                        const matchingBooking = dayBookings.find(b => {
                          const bStart = timeToMinutes(b.startTime);
                          const bEnd = timeToMinutes(b.endTime);
                          return bStart < hourEndMin && bEnd > hourStartMin;
                        });

                        const isStartHour = matchingBooking && timeToMinutes(matchingBooking.startTime) >= hourStartMin && timeToMinutes(matchingBooking.startTime) < hourEndMin;

                        return (
                          <div
                            key={day.dateStr}
                            onClick={() => {
                              if (!matchingBooking) {
                                onCellClick(activeRoomObj, hour, day.dateStr);
                              }
                            }}
                            className={`border-r last:border-r-0 border-slate-100 p-0.5 relative transition-colors ${
                              matchingBooking ? '' : 'hover:bg-indigo-50/40 cursor-pointer'
                            } ${day.isSelected ? 'bg-indigo-50/10' : ''}`}
                          >
                            {matchingBooking && isStartHour && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onBookingClick(matchingBooking);
                                }}
                                className={`h-full rounded px-1.5 py-0.5 text-[9px] font-sans flex flex-col justify-center overflow-hidden cursor-pointer shadow-xs transition-all hover:ring-1 hover:ring-slate-800 ${
                                  matchingBooking.hostUid === currentUserUid
                                    ? 'bg-indigo-600 text-white'
                                    : getBookingStatus(matchingBooking) === 'past'
                                    ? 'bg-slate-200 text-slate-600'
                                    : 'bg-indigo-700 text-white'
                                }`}
                              >
                                <span className="font-bold truncate uppercase">{matchingBooking.title}</span>
                                <span className="text-[8px] opacity-80 font-mono truncate">{matchingBooking.startTime}-{matchingBooking.endTime}</span>
                              </div>
                            )}

                            {!matchingBooking && (
                              <div className="opacity-0 group-hover:hover:opacity-100 absolute inset-0 flex items-center justify-center pointer-events-none">
                                <Plus className="w-3 h-3 text-indigo-400" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </div>
      ) : (
        
        /* Mode 2: Multi-Room Weekly Schedule Columns (Shows all days with room booking cards & availability) */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
          {weekDays.map(day => {
            const dayBookings = bookings.filter(b => b.date === day.dateStr);
            const floorDayBookings = dayBookings.filter(b => 
              activeRooms.some(r => r.id === b.roomId)
            );

            // Compute busy rooms count on this day
            const busyRoomIds = new Set(floorDayBookings.map(b => b.roomId));
            const availableRoomsCount = activeRooms.length - busyRoomIds.size;

            const dayHoliday = getHolidayForDay(day.dateStr);

            return (
              <div 
                key={day.dateStr}
                className={`flex flex-col bg-slate-50/50 border rounded-lg overflow-hidden transition-all ${
                  day.isSelected 
                    ? 'border-indigo-400 ring-1 ring-indigo-400 shadow-sm bg-white' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Column Header */}
                <div 
                  onClick={() => onSelectDate(day.dateStr)}
                  className={`p-2.5 border-b cursor-pointer flex items-center justify-between ${
                    day.isToday 
                      ? 'bg-indigo-600 text-white' 
                      : day.isSelected 
                      ? 'bg-indigo-50 border-indigo-100 text-indigo-900' 
                      : dayHoliday
                      ? (dayHoliday.type === 'public_holiday' ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950' : 'bg-violet-50/90 border-violet-200 text-violet-950')
                      : 'bg-slate-100/80 border-slate-200 text-slate-800'
                  }`}
                >
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider font-mono flex items-center gap-1">
                      <span>{day.shortDay}</span>
                      {dayHoliday && (
                        <span className="text-[10px]" title={`${dayHoliday.title} (${dayHoliday.type === 'public_holiday' ? 'Public Holiday' : 'Replacement Leave'})`}>
                          {dayHoliday.type === 'public_holiday' ? '🌴' : '🏖️'}
                        </span>
                      )}
                    </div>
                    <div className="text-base font-black leading-none mt-0.5 flex items-center gap-1.5">
                      <span>{day.dayNum}</span>
                      {dayHoliday && (
                        <span className="text-[9px] font-normal truncate max-w-[85px] opacity-80">
                          {dayHoliday.title}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      day.isToday 
                        ? 'bg-white/20 text-white' 
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {floorDayBookings.length} {floorDayBookings.length === 1 ? 'Booking' : 'Bookings'}
                    </span>
                    {onSwitchToDayView && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDate(day.dateStr);
                          onSwitchToDayView(day.dateStr);
                        }}
                        className="block text-[8px] underline font-bold mt-1 opacity-80 hover:opacity-100"
                        title="Jump to full day timeline"
                      >
                        Day matrix ↗
                      </button>
                    )}
                  </div>
                </div>

                {/* Day reservations list */}
                <div className="p-2 flex-1 space-y-1.5 min-h-[180px] max-h-[320px] overflow-y-auto">
                  {floorDayBookings.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-3 text-slate-400">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-1 opacity-70" />
                      <span className="text-[10px] font-bold text-slate-600">All Rooms Free</span>
                      <span className="text-[9px] text-slate-400 mt-0.5">No reservations scheduled</span>
                    </div>
                  ) : (
                    floorDayBookings.map(booking => {
                      const room = rooms.find(r => r.id === booking.roomId);
                      const isOwn = booking.hostUid === currentUserUid;
                      const status = getBookingStatus(booking);

                      return (
                        <div
                          key={booking.id}
                          onClick={() => onBookingClick(booking)}
                          className={`p-2 rounded border text-left cursor-pointer transition-all hover:shadow-xs group ${
                            isOwn
                              ? 'bg-indigo-50/80 border-indigo-200 hover:border-indigo-300'
                              : status === 'past'
                              ? 'bg-slate-100/70 border-slate-200 text-slate-500'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-100/60 px-1 py-0.2 rounded truncate">
                              {booking.startTime} - {booking.endTime}
                            </span>
                            {isOwn && (
                              <span className="text-[7px] font-mono font-black bg-indigo-600 text-white px-1 rounded uppercase">
                                ME
                              </span>
                            )}
                          </div>

                          <div className="font-bold text-[11px] text-slate-800 truncate leading-tight">
                            {booking.title}
                          </div>

                          <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1 font-mono">
                            <span className="truncate max-w-[90px] font-semibold text-slate-600">
                              {room?.name || 'Room'}
                            </span>
                            <span className="truncate">{booking.hostName}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Quick Add Button on bottom of each day */}
                <div className="p-2 border-t border-slate-150 bg-white">
                  <button
                    onClick={() => {
                      const targetRoom = activeRooms[0] || rooms[0];
                      if (targetRoom) {
                        onCellClick(targetRoom, '09:00', day.dateStr);
                      }
                    }}
                    className="w-full py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded text-slate-600 hover:text-indigo-600 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Book on {day.shortDay}
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Quick Summary Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
            <span>Reserved Slot</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Free Day / Open Time</span>
          </div>
        </div>
        <div className="text-[10px] text-slate-400">
          Showing availability across {activeRooms.length} room{activeRooms.length === 1 ? '' : 's'} on Floor. Click any slot to reserve.
        </div>
      </div>

    </div>
  );
};
