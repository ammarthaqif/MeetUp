import React from 'react';
import { Clock, Plus, Users, ShieldAlert, Monitor, Video, Pencil, Trash, ChevronLeft, ChevronRight, Sparkles, AlertCircle } from 'lucide-react';
import { Room, Booking, BlockedDate, Tenant } from '../types';
import { timeToMinutes, getBookingStatus, addDaysToDate, formatDateToISO, formatFriendlyDate } from '../utils';

interface BookingTimelineProps {
  rooms: Room[];
  bookings: Booking[];
  selectedDate: string;
  onSelectDate?: (date: string) => void;
  onCellClick: (room: Room, hour: string, date?: string) => void;
  onBookingClick: (booking: Booking) => void;
  currentUserUid?: string;
  onCancelBooking?: (bookingId: string) => void;
  blockedDates?: BlockedDate[];
  currentTenant?: Tenant | null;
}

export const BookingTimeline: React.FC<BookingTimelineProps> = ({
  rooms,
  bookings,
  selectedDate,
  onSelectDate,
  onCellClick,
  onBookingClick,
  currentUserUid,
  onCancelBooking,
  blockedDates = [],
  currentTenant = null,
}) => {
  const startHour = 8; // 08:00 AM
  const endHour = 19;  // 07:00 PM
  const totalHours = endHour - startHour;
  const startMinutes = startHour * 60; // 480
  const totalMinutes = totalHours * 60; // 660

  const handlePrevDay = () => {
    if (onSelectDate) onSelectDate(addDaysToDate(selectedDate, -1));
  };

  const handleNextDay = () => {
    if (onSelectDate) onSelectDate(addDaysToDate(selectedDate, 1));
  };

  const handleToday = () => {
    if (onSelectDate) onSelectDate(formatDateToISO(new Date()));
  };

  // Find matching holiday / replacement leave for the selected date
  const activeHoliday = blockedDates.find(b => {
    if (!b.active) return false;
    const matchesTenant = b.tenantId === 'ALL' || b.tenantId === currentTenant?.id;
    if (!matchesTenant) return false;
    if (b.date === selectedDate) return true;
    if (b.endDate && selectedDate >= b.date && selectedDate <= b.endDate) return true;
    return false;
  });

  // Generate hourly labels for header
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

  // Check if selected date is today to draw current time vertical line
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const isToday = selectedDate === todayStr;
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const showCurrentTimeLine = isToday && currentMin >= startMinutes && currentMin <= (startMinutes + totalMinutes);
  const currentTimeLinePercent = showCurrentTimeLine ? ((currentMin - startMinutes) / totalMinutes) * 100 : null;

  return (
    <div id="booking-timeline-card" className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm overflow-hidden space-y-3">
      
      {/* Holiday / Replacement Leave Notification Ribbon */}
      {activeHoliday && (
        <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs animate-in fade-in duration-150 ${
          activeHoliday.type === 'public_holiday' 
            ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950' 
            : activeHoliday.type === 'replacement_leave'
            ? 'bg-violet-50/90 border-violet-200 text-violet-950'
            : 'bg-amber-50/90 border-amber-200 text-amber-950'
        }`}>
          <div className="flex items-center gap-2.5">
            <span className="text-xl shrink-0">
              {activeHoliday.type === 'public_holiday' ? '🌴' : activeHoliday.type === 'replacement_leave' ? '🏖️' : '🏢'}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold uppercase font-sans tracking-tight">
                  {activeHoliday.type === 'public_holiday' ? 'Public Holiday Notice' : activeHoliday.type === 'replacement_leave' ? 'Company Replacement Leave' : 'Company Closure Notice'}
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                  activeHoliday.type === 'public_holiday' ? 'bg-emerald-200 text-emerald-900' : 'bg-violet-200 text-violet-900'
                }`}>
                  {activeHoliday.tenantId === 'ALL' ? 'Gazetted' : currentTenant?.name || 'Company Specific'}
                </span>
                {activeHoliday.isHardBlock && (
                  <span className="text-[10px] bg-rose-100 text-rose-800 border border-rose-200 px-1.5 py-0.5 rounded font-bold">
                    Strict Lockout
                  </span>
                )}
              </div>
              <p className="text-[11px] opacity-90 mt-0.5">
                <strong className="font-bold">{activeHoliday.title}</strong> — {activeHoliday.description || 'Marked as company block date.'}
              </p>
            </div>
          </div>
          <div className="text-[10px] font-mono font-bold opacity-75 shrink-0">
            {formatFriendlyDate(selectedDate)}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {onSelectDate && (
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-md p-0.5 mr-1">
              <button
                onClick={handlePrevDay}
                className="p-1 hover:bg-white text-slate-600 hover:text-indigo-600 rounded transition-colors"
                title="Previous Day"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleToday}
                className="px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-white rounded transition-colors"
              >
                Today
              </button>
              <button
                onClick={handleNextDay}
                className="p-1 hover:bg-white text-slate-600 hover:text-indigo-600 rounded transition-colors"
                title="Next Day"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <h2 className="font-sans font-bold text-slate-800 tracking-tight text-xs uppercase">
              Daily Timeline Matrix
            </h2>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono px-2 py-0.5 rounded-sm font-bold">
              {formatFriendlyDate(selectedDate)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600 inline-block" />
            <span>Reserved</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
            <span>Active/Busy</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 inline-block" />
            <span>Past</span>
          </div>
        </div>
      </div>


      {/* Grid Container with horizontal scroll */}
      <div className="overflow-x-auto border border-slate-200 rounded">
        <div className="min-w-[950px] relative">
          
          {/* Grid Header */}
          <div className="flex bg-slate-50 border-b border-slate-200 font-mono text-[9px] text-slate-400 font-black uppercase tracking-[0.1em] py-2">
            <div className="w-[140px] px-3 flex items-center shrink-0">Meeting Room</div>
            <div className="flex w-full justify-between pr-4">
              {hoursArray.map((hour, idx) => (
                <div key={idx} className="flex-1 text-center border-l border-slate-200 min-w-[65px] font-bold py-0.5">
                  {hour}
                </div>
              ))}
            </div>
          </div>
 
          {/* Grid Rows */}
          <div className="divide-y divide-slate-150 relative">
            
            {rooms.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs font-medium bg-slate-50/20">
                No rooms found on this floor matching current criteria.
              </div>
            ) : (
              rooms.map(room => {
                // Filter bookings for this room today
                const roomBookings = bookings.filter(
                  b => b.roomId === room.id && b.date === selectedDate
                );

                return (
                  <div key={room.id} className="flex h-16 items-stretch relative group">
                    
                    {/* Left Column: Room Card details */}
                    <div className="w-[140px] px-3 py-2 bg-slate-50/40 border-r border-slate-200 flex flex-col justify-between shrink-0 relative z-10">
                      <div>
                        <h4 className="font-sans font-bold text-slate-800 text-[11px] truncate leading-tight">
                          {room.name}
                        </h4>
                        <span className="flex items-center gap-1 text-[9px] font-mono text-slate-400 mt-0.5">
                          CAP: {room.capacity}
                        </span>
                      </div>
                      
                      {/* Tiny quick tags */}
                      <div className="flex gap-1 overflow-hidden mt-0.5">
                        {room.amenities.includes('Video Conferencing') && (
                          <span title="Video Conferencing">
                            <Video className="w-3 h-3 text-slate-400" />
                          </span>
                        )}
                        {room.amenities.includes('Dual 85" Screens') && (
                          <span title="Monitor">
                            <Monitor className="w-3 h-3 text-slate-400" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Time Grid Blocks */}
                    <div className="flex-1 flex relative items-stretch pr-4 select-none bg-white">
                      
                      {/* Current Time vertical red/indigo indicator bar */}
                      {currentTimeLinePercent !== null && (
                        <div 
                          style={{ left: `${currentTimeLinePercent}%` }}
                          className="absolute top-0 bottom-0 w-px bg-indigo-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(99,102,241,0.6)]" 
                        />
                      )}

                      {/* Visual Hour Grid Lines */}
                      {hoursRaw.map((hour, index) => (
                        <div
                          key={index}
                          onClick={() => onCellClick(room, hour)}
                          className="flex-1 border-l border-slate-100 hover:bg-slate-50/80 cursor-pointer flex items-center justify-center transition-colors relative"
                          title={`Book ${room.name} starting at ${hour}`}
                        >
                          {/* Hover action indicator */}
                          <div className="opacity-0 group-hover:hover:opacity-100 absolute inset-0 flex items-center justify-center transition-opacity pointer-events-none">
                            <div className="p-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200">
                              <Plus className="w-2.5 h-2.5" />
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Absolute overlay bookings pills */}
                      {roomBookings.map(booking => {
                        const startMin = timeToMinutes(booking.startTime);
                        const endMin = timeToMinutes(booking.endTime);
                        
                        // Bound within 08:00 to 19:00
                        const boundedStart = Math.max(startMinutes, startMin);
                        const boundedEnd = Math.min(startMinutes + totalMinutes, endMin);
                        
                        // Check if booking has any overlap with the timeline window
                        if (boundedStart >= boundedEnd) return null;

                        const leftPct = ((boundedStart - startMinutes) / totalMinutes) * 100;
                        const widthPct = ((boundedEnd - boundedStart) / totalMinutes) * 100;

                        const status = getBookingStatus(booking);
                        const isOwnBooking = currentUserUid === booking.hostUid;

                        let statusColors = 'bg-indigo-600 text-white border border-indigo-700';
                        if (status === 'past') {
                          statusColors = 'bg-slate-150 text-slate-500 border border-slate-200 opacity-80';
                        } else if (status === 'ongoing') {
                          statusColors = 'bg-rose-500 text-white border border-rose-600 animate-pulse';
                        }

                        return (
                          <div
                            key={booking.id}
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                            }}
                            className={`absolute top-1.5 bottom-1.5 px-2 py-1 rounded shadow-sm text-[10px] font-sans flex flex-col justify-center overflow-hidden cursor-pointer transition-all hover:ring-1 hover:ring-slate-900 select-none z-20 ${statusColors}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onBookingClick(booking);
                            }}
                          >
                            <span className="font-bold truncate leading-none uppercase text-[9px]">
                              {booking.title}
                            </span>
                            <div className="flex items-center gap-1 text-[8px] opacity-90 truncate font-mono mt-0.5">
                              <span>{booking.startTime}-{booking.endTime}</span>
                              <span>•</span>
                              <span className="truncate">{booking.hostName}</span>
                            </div>

                            {/* Self badge */}
                            {isOwnBooking && (
                              <span className="absolute top-0.5 right-1 bg-white/20 text-white text-[7px] font-bold px-1 rounded uppercase font-mono leading-none font-black">
                                ME
                              </span>
                            )}
                          </div>
                        );
                      })}

                    </div>
                  </div>
                );
              })
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
};
