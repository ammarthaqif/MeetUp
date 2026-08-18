import React from 'react';
import { Calendar, Trash2, Clock, MapPin, Download, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { Booking, Room } from '../types';
import { formatFriendlyDate, getBookingStatus } from '../utils';
import { downloadIcsFile } from '../outlookSync';

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
  // If user is anonymous or not signed in, we can filter by the name entered or list all bookings if they are using local guest profiles.
  // Let's filter bookings where the email matches the currentUserEmail.
  // In addition, if no user is signed in, we can display guest mode and show recent bookings.
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

  const handleOutlookExport = (booking: Booking) => {
    const room = rooms.find(r => r.id === booking.roomId);
    if (!room) return;
    downloadIcsFile(booking, room);
  };

  return (
    <div id="my-bookings-container" className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <h2 className="font-sans font-bold text-slate-800 tracking-tight text-xs uppercase">
            My Reservations
          </h2>
        </div>
        <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded font-black uppercase">
          {myBookings.length} TOTAL
        </span>
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

                  return (
                    <div
                      key={booking.id}
                      className="border border-slate-200 rounded p-3 hover:border-slate-300 transition-all bg-white relative flex flex-col justify-between group"
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
                        <div className="flex gap-1">
                          {/* Outlook / .ics Export */}
                          <button
                            onClick={() => handleOutlookExport(booking)}
                            className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded border border-slate-200 transition-colors cursor-pointer"
                            title="Export to Outlook (ICS file)"
                          >
                            <Download className="w-2.5 h-2.5" />
                            <span>Outlook</span>
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
                {pastBookings.slice(0, 4).map(booking => {
                  const room = rooms.find(r => r.id === booking.roomId);

                  return (
                    <div
                      key={booking.id}
                      className="border border-slate-200 rounded p-3 bg-slate-50/40 opacity-75 relative flex flex-col justify-between"
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
