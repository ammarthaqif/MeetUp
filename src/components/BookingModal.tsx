import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Info, UserCheck, AlertTriangle, Users, Mail, Plus, Trash2 } from 'lucide-react';
import { Room, Booking } from '../types';
import { isRoomAvailable, timeToMinutes, minutesToTime } from '../utils';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  rooms: Room[]; // List of all rooms for selection
  selectedDate: string;
  selectedHour?: string;
  onSave: (bookingData: Omit<Booking, 'id' | 'createdAt'> & { id?: string; multiDates?: string[] }) => Promise<void>;
  editingBooking: Booking | null;
  currentUser: { displayName: string | null; email: string | null; uid: string } | null;
  bookings: Booking[]; // Used for live conflict checking
  googleSyncAvailable: boolean;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  room,
  rooms,
  selectedDate,
  selectedHour = '09:00',
  onSave,
  editingBooking,
  currentUser,
  bookings,
  googleSyncAvailable,
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

  // Multi-day states
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [repeatDays, setRepeatDays] = useState<string[]>([]);
  const [multiDayConflicts, setMultiDayConflicts] = useState<string[]>([]);

  const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Initialize values when modal opens or inputs change
  useEffect(() => {
    if (isOpen) {
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
        
        setIsMultiDay(false);
        setEndDate(editingBooking.date);
        setRepeatDays([]);
        setMultiDayConflicts([]);
      } else {
        setRoomId(room?.id || rooms[0]?.id || '');
        setDate(selectedDate);
        setStartTime(selectedHour);
        // Default end time to 1 hour after start time
        const startMin = timeToMinutes(selectedHour);
        setEndTime(minutesToTime(startMin + 60));
        setTitle('');
        setDescription('');
        setHostName(currentUser?.displayName || '');
        setHostEmail(currentUser?.email || '');
        setAttendees([]);
        setSyncGoogle(googleSyncAvailable);
        setErrorMessage('');

        setIsMultiDay(false);
        setEndDate(selectedDate);
        const dayName = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });
        setRepeatDays([dayName]);
        setMultiDayConflicts([]);
      }
    }
  }, [isOpen, room, selectedDate, selectedHour, editingBooking, currentUser, rooms, googleSyncAvailable]);

  // Live conflict checking when dates, times, or rooms change
  useEffect(() => {
    if (!roomId || !date || !startTime || !endTime) return;
    
    // Auto-validate end time is after start time
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (endMin <= startMin) {
      setErrorMessage('End time must be after the start time.');
      setIsConflict(false);
      return;
    } else {
      setErrorMessage('');
    }

    if (isMultiDay && endDate && !editingBooking) {
      const datesToCheck: string[] = [];
      const start = new Date(date);
      const end = new Date(endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
        const current = new Date(start);
        while (current <= end) {
          const dayName = current.toLocaleDateString('en-US', { weekday: 'long' });
          if (repeatDays.includes(dayName)) {
            datesToCheck.push(current.toISOString().split('T')[0]);
          }
          current.setDate(current.getDate() + 1);
        }
      }

      const conflicts: string[] = [];
      for (const d of datesToCheck) {
        const available = isRoomAvailable(
          roomId,
          d,
          startTime,
          endTime,
          bookings,
          editingBooking?.id
        );
        if (!available) {
          conflicts.push(d);
        }
      }
      setMultiDayConflicts(conflicts);
      setIsConflict(conflicts.length > 0);
    } else {
      const hasConflict = !isRoomAvailable(
        roomId,
        date,
        startTime,
        endTime,
        bookings,
        editingBooking?.id
      );
      setIsConflict(hasConflict);
      setMultiDayConflicts([]);
    }
  }, [roomId, date, startTime, endTime, bookings, editingBooking, isMultiDay, endDate, repeatDays]);

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
      setRepeatDays(repeatDays.filter(d => d !== day));
    } else {
      setRepeatDays([...repeatDays, day]);
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

    if (isMultiDay && !editingBooking) {
      const start = new Date(date);
      const end = new Date(endDate);
      const datesToBook: string[] = [];
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
        const current = new Date(start);
        while (current <= end) {
          const dayName = current.toLocaleDateString('en-US', { weekday: 'long' });
          if (repeatDays.includes(dayName)) {
            datesToBook.push(current.toISOString().split('T')[0]);
          }
          current.setDate(current.getDate() + 1);
        }
      }
      
      if (datesToBook.length === 0) {
        setErrorMessage('No valid days of the week found in the selected date range.');
        return;
      }

      // Check conflicts
      const conflicts: string[] = [];
      for (const d of datesToBook) {
        const available = isRoomAvailable(roomId, d, startTime, endTime, bookings);
        if (!available) {
          conflicts.push(d);
        }
      }

      if (conflicts.length > 0) {
        setErrorMessage(`Conflict detected on the following dates: ${conflicts.join(', ')}. Please adjust your schedule.`);
        return;
      }

      multiDates = datesToBook;
      confirmMessage = `Are you sure you want to book ${currentRoom?.name} for ${startTime} - ${endTime} on ${datesToBook.length} selected days (${date} to ${endDate})?`;
    } else {
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
    }

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsSaving(true);
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
      onClose();
    } catch (err: any) {
      console.error('Failed to save booking:', err);
      setErrorMessage(err.message || 'An error occurred while saving the booking.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-xl shadow-xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-100 px-6 py-5 flex items-center justify-between">
          <div>
            <h3 className="font-sans font-bold text-slate-950 text-lg">
              {editingBooking ? 'Edit Meeting Room Reservation' : 'Book a Meeting Room'}
            </h3>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              Secure real-time floor availability sync.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isConflict && !isMultiDay && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <div>
                <span className="font-bold">Time Slot Conflict:</span> The room is already booked for this period. Please select a different room, date, or time.
              </div>
            </div>
          )}

          {isConflict && isMultiDay && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex flex-col gap-1.5">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>Multi-Day Conflicts Detected ({multiDayConflicts.length} dates):</span>
              </div>
              <p className="text-[11px] text-rose-700 leading-normal pl-6">
                The room is already reserved for this slot on: <span className="font-mono font-bold text-rose-900">{multiDayConflicts.join(', ')}</span>. Please change the time slot, date range, or select a different room.
              </p>
            </div>
          )}

          {/* Room Selection and Start Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 font-mono">
                Meeting Room
              </label>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              >
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} (Lvl {r.floor} • Cap {r.capacity})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 font-mono">
                {isMultiDay ? 'Start Date' : 'Date'}
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Multi-Day Option Toggle */}
          {!editingBooking && (
            <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="multi-day-toggle"
                  checked={isMultiDay}
                  onChange={(e) => {
                    setIsMultiDay(e.target.checked);
                    if (e.target.checked && !endDate) {
                      setEndDate(date);
                    }
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                />
                <label htmlFor="multi-day-toggle" className="text-xs font-bold text-indigo-950 cursor-pointer select-none">
                  Book across multiple days (Recurring Meeting)
                </label>
              </div>

              {isMultiDay && (
                <div className="pt-2 border-t border-indigo-100/60 space-y-3 animate-fadeIn">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-mono">
                      End Date
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="date"
                        value={endDate}
                        min={date}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl pl-10 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-mono">
                      Repeat on Days of the Week
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS_OF_WEEK.map(day => {
                        const isSelected = repeatDays.includes(day);
                        return (
                          <button
                            type="button"
                            key={day}
                            onClick={() => handleDayToggle(day)}
                            className={`text-[10px] font-bold px-2 py-1 rounded transition-all cursor-pointer border ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-700 font-black'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {day.substring(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Times Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 font-mono">
                Start Time
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  step="900" // 15-minute intervals
                  className="w-full border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 font-mono">
                End Time
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  step="900" // 15-minute intervals
                  className="w-full border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Meeting Details */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 font-mono">
              Meeting Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design Review / Weekly Sync"
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
              placeholder="Briefly state meeting focus..."
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
                      className="text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100/50 rounded-full p-0.5"
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
                    Instantly sync this event on your Google Calendar.
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
            <Info className="w-3.5 h-3.5" />
            <span>Overlaps fully checked</span>
          </div>
          <div className="flex gap-2">
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
              className={`bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-md shadow-indigo-100 transition-colors cursor-pointer ${
                (isSaving || isConflict || !!errorMessage) ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {isSaving ? 'Processing...' : editingBooking ? 'Update Booking' : 'Book Room'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
