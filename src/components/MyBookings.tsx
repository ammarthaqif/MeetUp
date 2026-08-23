import React, { useState } from 'react';
import { Calendar, Trash2, Clock, MapPin, Download, Sparkles, RefreshCw, AlertCircle, Check, CalendarPlus } from 'lucide-react';
import { Booking, Room } from '../types';
import { formatFriendlyDate, getBookingStatus } from '../utils';
import { downloadIcsFile, downloadMultipleIcsFile } from '../outlookSync';

interface MyBookingsProps {
  bookings: Booking[];
  rooms: Room[];
  currentUserEmail: string | null;
  onCancelBooking: (booking: Booking) => void;
  onSyncGoogleNow?: (booking: Booking) => void;
  googleSyncAvailable: boolean;
}

export const MyBookings: React.FC<MyBookingsProps> = ({
  bookings,
  rooms,
  currentUserEmail,
  onCancelBooking,
  onSyncGoogleNow,
  googleSyncAvailable,
}) => {
  const [exportedId, setExportedId] = useState<string | null>(null);
  const [allExported, setAllExported] = useState(false);

  // If user is anonymous or not signed in, filter by email or list user's bookings
  const myBookings = bookings.filter(
    b => currentUserEmail && b.hostEmail.toLowerCase() === currentUserEmail.toLowerCase()
  );

  // Sort: Upcoming/ongoing first (asc date/time), then past (desc date/time)
  const activeBookings = myBookings
    .filter(b => getBookingStatus(b) !== 'past')
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const pastBookings = myBookings
    .filter(b => getBookingStatus(b) === 'past')
    .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));

  const handleExportIcs = (booking: Booking) => {
    const room = rooms.find(r => r.id === booking.roomId);
    downloadIcsFile(booking, room);
    setExportedId(booking.id);
    setTimeout(() => {
      setExportedId(prev => (prev === booking.id ? null : prev));
    }, 2500);
  };

  const handleExportAllIcs = () => {
    if (myBookings.length === 0) return;
    downloadMultipleIcsFile(myBookings, rooms);
    setAllExported(true);
    setTimeout(() => setAllExported(false), 2500);
  };

  return (
    <div id="my-bookings-container" className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <h2 className="font-sans font-bold text-slate-800 tracking-tight text-xs uppercase">
            My Reservations
          </h2>
          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded font-black uppercase">
            {myBookings.length} TOTAL
          </span>
        </div>

        {myBookings.length > 0 && (
          <button
            id="export-all-ics-btn"
            onClick={handleExportAllIcs}
            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-700 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-2.5 py-1.5 rounded-md transition-all cursor-pointer shadow-2xs"
            title="Export all reservations into a single .ics calendar file"
          >
            {allExported ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-700 font-black">All Exported (.ics)</span>
              </>
            ) : (
              <>
                <CalendarPlus className="w-3 h-3 text-indigo-600" />
                <span>Export All (.ics)</span>
              </>
            )}
          </button>
        )}
      </div>

      {!currentUserEmail ? (
        <div className="text-center py-6 bg-slate-50 rounded border border-slate-200 p-4">
          <AlertCircle className="w-6 h-6 text-amber-500 mx-auto mb-1.5" />
          <h4 className="text-xs font-black text-slate-800 uppercase">Sign In to Track Bookings</h4>
          <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            Please sign in with your Google account to secure, edit, and automatically sync your personal meeting room bookings.
          </p>
        </div>
      ) : myBookings.length === 0 ? (
        <div className="text-center py-8 bg-slate-50/50 rounded border border-dashed border-slate-200">
          <Calendar className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
          <p className="text-xs text-slate-400 font-bold uppercase">No active reservations.</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Select a floor and click on the timeline grid to lock in a slot!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active / Upcoming bookings */}
          {activeBookings.length > 0 && (
            <div>
              <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2 font-mono">
                Upcoming & Ongoing ({activeBookings.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeBookings.map(booking => {
                  const room = rooms.find(r => r.id === booking.roomId);
                  const status = getBookingStatus(booking);
                  const isExported = exportedId === booking.id;

                  return (
                    <div
                      key={booking.id}
                      className="border border-slate-200 rounded p-3 hover:border-slate-300 transition-all bg-white relative flex flex-col justify-between group shadow-2xs"
                    >
                      <div>
                        {/* Status tag */}
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="font-sans font-bold text-slate-900 text-xs truncate max-w-[70%]">
                            {booking.title}
                          </span>
                          <span className={`text-[8px] font-mono font-black uppercase px-1.5 py-0.5 rounded-sm ${
                            status === 'ongoing'
                              ? 'bg-rose-100 text-rose-700 animate-pulse'
                              : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {status === 'ongoing' ? 'Ongoing' : 'Upcoming'}
                          </span>
                        </div>

                        {/* Room info */}
                        <div className="space-y-1 text-[11px] text-slate-500 mt-2 font-sans">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-indigo-500" />
                            <span className="font-bold text-slate-700">
                              {room ? room.name : 'Unknown Room'}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span>Level {booking.floor}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span className="font-mono text-slate-600">
                              {formatFriendlyDate(booking.date)} ({booking.startTime} - {booking.endTime})
                            </span>
                          </div>
                        </div>

                        {/* Description if available */}
                        {booking.description && (
                          <p className="text-[10px] text-slate-400 italic mt-2 line-clamp-2">
                            "{booking.description}"
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-3 gap-2">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {/* Dedicated .ics Calendar Export button */}
                          <button
                            id={`export-ics-${booking.id}`}
                            onClick={() => handleExportIcs(booking)}
                            className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded border transition-all cursor-pointer ${
                              isExported
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 border-slate-200 hover:border-indigo-200'
                            }`}
                            title="Export reservation to .ics file for personal calendar (Apple, Google, Outlook)"
                          >
                            {isExported ? (
                              <>
                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Exported!</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-2.5 h-2.5 text-slate-500" />
                                <span>Export .ics</span>
                              </>
                            )}
                          </button>

                          {/* Manual Google Sync button if not yet synced */}
                          {googleSyncAvailable && !booking.googleEventId && onSyncGoogleNow && (
                            <button
                              onClick={() => onSyncGoogleNow(booking)}
                              className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded border border-indigo-200 transition-colors cursor-pointer"
                            >
                              <RefreshCw className="w-2.5 h-2.5" />
                              <span>Google Sync</span>
                            </button>
                          )}

                          {booking.googleEventId && (
                            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-mono">
                              Google Synced
                            </span>
                          )}
                        </div>

                        {/* Cancel button */}
                        <button
                          onClick={() => onCancelBooking(booking)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Cancel meeting reservation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Past bookings */}
          {pastBookings.length > 0 && (
            <div>
              <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2 font-mono">
                Past Meetings ({pastBookings.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pastBookings.slice(0, 6).map(booking => {
                  const room = rooms.find(r => r.id === booking.roomId);
                  const isExported = exportedId === booking.id;

                  return (
                    <div
                      key={booking.id}
                      className="border border-slate-200 rounded p-3 bg-slate-50/40 opacity-85 relative flex flex-col justify-between hover:opacity-100 transition-opacity"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-sans font-bold text-slate-700 text-[11px] truncate max-w-[80%]">
                            {booking.title}
                          </span>
                          <span className="text-[8px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                            Past
                          </span>
                        </div>
                        <div className="space-y-1 text-[10px] text-slate-400 font-sans">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5" />
                            <span>{room ? room.name : 'Unknown Room'} (Lvl {booking.floor})</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{booking.date} • {booking.startTime} - {booking.endTime}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons for past meetings */}
                      <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-3 gap-2">
                        <button
                          id={`export-ics-past-${booking.id}`}
                          onClick={() => handleExportIcs(booking)}
                          className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded border transition-all cursor-pointer ${
                            isExported
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'text-slate-600 hover:text-indigo-600 hover:bg-white border-slate-200'
                          }`}
                          title="Export reservation to .ics file"
                        >
                          {isExported ? (
                            <>
                              <Check className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Exported!</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-2.5 h-2.5 text-slate-400" />
                              <span>Export .ics</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

