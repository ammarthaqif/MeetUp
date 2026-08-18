import React, { useState, useEffect } from 'react';
import { Mail, ChevronUp, ChevronDown, Calendar, Clock, MapPin, Building2, User, Users, CheckCircle, HelpCircle } from 'lucide-react';
import { Booking, Room } from '../types';

export interface SimulatedEmail {
  id: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  details: {
    title: string;
    roomName: string;
    floor: number;
    startTime: string;
    endTime: string;
    officeName: string;
    officeLocation: string;
    dates: string[];
    hostName: string;
    attendees: string[];
  };
}

interface SimulatedInboxProps {
  emails: SimulatedEmail[];
  onClear: () => void;
}

export const SimulatedInbox: React.FC<SimulatedInboxProps> = ({ emails, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<SimulatedEmail | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Auto-expand and update unread count when new email arrives
  useEffect(() => {
    if (emails.length > 0) {
      setUnreadCount(prev => prev + 1);
      setSelectedEmail(emails[0]); // Select the latest email
      setIsOpen(true); // Automatically expand the tray so the user notices!
    }
  }, [emails]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-md shadow-2xl transition-all duration-300 ease-in-out font-sans">
      
      {/* Inbox Header / Bar */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`px-4 py-3 cursor-pointer select-none rounded-t-2xl flex items-center justify-between border ${
          unreadCount > 0 
            ? 'bg-indigo-600 text-white border-indigo-700 animate-pulse' 
            : 'bg-slate-900 text-slate-100 border-slate-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider font-mono">
            Simulated Office Mail Client
          </span>
          {unreadCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-bounce">
              {unreadCount} New
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </div>
      </div>

      {/* Inbox Content Area */}
      {isOpen && (
        <div className="bg-slate-50 border border-t-0 border-slate-300 rounded-b-2xl overflow-hidden flex flex-col h-[480px]">
          {emails.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
              <Mail className="w-10 h-10 text-slate-300 stroke-[1.5]" />
              <div>
                <p className="text-xs font-bold text-slate-700">Inbox is empty</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Book a meeting room and input your office email to receive real-time confirmations here!
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">
              
              {/* Left Column: Email List (1/3 width) */}
              <div className="w-1/3 border-r border-slate-200 bg-white overflow-y-auto divide-y divide-slate-100 shrink-0">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`p-2.5 text-left cursor-pointer transition-colors ${
                      selectedEmail?.id === email.id 
                        ? 'bg-indigo-50 border-l-4 border-indigo-600' 
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-[10px] font-bold text-slate-800 truncate" title={email.to}>
                      To: {email.to.split('@')[0]}
                    </p>
                    <p className="text-[9px] text-slate-500 font-medium truncate mt-0.5">
                      {email.subject}
                    </p>
                    <p className="text-[8px] text-slate-400 mt-1 font-mono">{email.date}</p>
                  </div>
                ))}
              </div>

              {/* Right Column: Email Viewer (2/3 width) */}
              <div className="flex-1 bg-slate-100 p-4 overflow-y-auto flex flex-col justify-between">
                {selectedEmail ? (
                  <div className="space-y-4">
                    {/* Header Details */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1 text-[11px]">
                      <div>
                        <span className="font-bold text-slate-500">From:</span>{' '}
                        <span className="font-mono text-slate-800">reservations@workspacematrix.com</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-500">To:</span>{' '}
                        <span className="font-mono text-indigo-700 font-bold">{selectedEmail.to}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-500">Subject:</span>{' '}
                        <span className="font-semibold text-slate-900">{selectedEmail.subject}</span>
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono border-t border-slate-100 pt-1 mt-1">
                        Received: {selectedEmail.date}
                      </div>
                    </div>

                    {/* Email Body - HTML Styled */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 shadow-sm text-slate-800">
                      
                      {/* Brand Banner */}
                      <div className="flex items-center gap-1.5 border-b border-indigo-50 pb-3">
                        <div className="w-5 h-5 bg-indigo-600 text-white rounded font-black text-xs flex items-center justify-center">O</div>
                        <span className="text-[10px] font-black tracking-tight text-indigo-900 uppercase">OFFICESYNC MATRICES</span>
                      </div>

                      {/* Heading */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs">
                          <CheckCircle className="w-4 h-4" />
                          <span>Reservation Confirmed</span>
                        </div>
                        <h4 className="font-sans font-extrabold text-sm text-slate-900 leading-tight">
                          {selectedEmail.details.title}
                        </h4>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Hello <strong className="text-slate-900">{selectedEmail.details.hostName}</strong>, your meeting room reservation has been successfully locked into our live scheduler!
                      </p>

                      {/* Details Table */}
                      <div className="bg-slate-50 rounded-xl border border-slate-100 p-3.5 space-y-2.5 text-[10px]">
                        
                        <div className="flex items-start gap-2">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-slate-800">{selectedEmail.details.officeName}</p>
                            <p className="text-[9px] text-slate-500">{selectedEmail.details.officeLocation}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <p className="text-slate-700">
                            Room: <strong className="text-indigo-950">{selectedEmail.details.roomName}</strong> (Floor {selectedEmail.details.floor})
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <p className="text-slate-700">
                            Time Slot: <strong className="text-slate-900">{selectedEmail.details.startTime} - {selectedEmail.details.endTime}</strong>
                          </p>
                        </div>

                        <div className="flex items-start gap-2 border-t border-slate-200/55 pt-2.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-slate-800">
                              Booked Date{selectedEmail.details.dates.length > 1 ? 's' : ''} ({selectedEmail.details.dates.length}):
                            </p>
                            <div className="text-[9px] text-indigo-700 font-mono font-bold mt-0.5 flex flex-wrap gap-1">
                              {selectedEmail.details.dates.map(d => (
                                <span key={d} className="bg-indigo-50 border border-indigo-100 px-1 py-0.5 rounded">{d}</span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {selectedEmail.details.attendees.length > 0 && (
                          <div className="flex items-start gap-2 border-t border-slate-200/55 pt-2.5">
                            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold text-slate-800">Attendees Invitation Delivered:</p>
                              <p className="text-[9px] text-slate-500 mt-0.5">{selectedEmail.details.attendees.join(', ')}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer Signature */}
                      <div className="border-t border-slate-100 pt-3 text-[9px] text-slate-400 space-y-0.5">
                        <p>Sincerely,</p>
                        <p className="font-bold text-slate-700">OfficeSync Automated Concierge</p>
                        <p>No-Reply System • MBFC Block C</p>
                      </div>

                    </div>

                    {/* Download ICS widget */}
                    <div className="text-center text-[10px] text-slate-500">
                      📅 Cal invite generated and synced safely.
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-12 text-xs">
                    Select an email on the left to read details
                  </div>
                )}

                {/* Clear Button */}
                <div className="mt-4 pt-3 border-t border-slate-200 flex justify-end">
                  <button
                    onClick={onClear}
                    className="text-[9px] font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer bg-white px-2 py-1 rounded border border-slate-200 transition-colors"
                  >
                    Clear All Mail
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

    </div>
  );
};
