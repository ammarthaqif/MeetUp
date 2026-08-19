import React, { useState } from 'react';
import { 
  History, Search, Download, Trash2, Filter, Calendar, Clock, 
  User, Building, AlertCircle, CheckCircle2, Shield, Layers, FileText
} from 'lucide-react';
import { AuditLog, AuditActionType } from '../types';

interface AdminAuditLogsProps {
  logs: AuditLog[];
  onClearLogs: () => Promise<void>;
}

export const AdminAuditLogs: React.FC<AdminAuditLogsProps> = ({
  logs,
  onClearLogs,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'bookings' | 'security' | 'config'>('all');
  const [isClearing, setIsClearing] = useState(false);

  const getActionBadge = (action: AuditActionType) => {
    switch (action) {
      case 'BOOKING_CREATED':
        return { label: 'Reservation Created', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'BOOKING_UPDATED':
        return { label: 'Reservation Modified', bg: 'bg-sky-100 text-sky-800 border-sky-200' };
      case 'BOOKING_CANCELLED':
        return { label: 'Reservation Cancelled', bg: 'bg-rose-100 text-rose-800 border-rose-200' };
      case 'TOKEN_ACCESS_GRANTED':
        return { label: 'Token Access Verified', bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      case 'APPROVED_USER_ADDED':
        return { label: 'User Whitelisted', bg: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'APPROVED_USER_REMOVED':
        return { label: 'User Access Revoked', bg: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'ACCESS_KEY_GENERATED':
        return { label: 'Access Token Created', bg: 'bg-teal-100 text-teal-800 border-teal-200' };
      case 'ACCESS_KEY_REVOKED':
        return { label: 'Access Token Revoked', bg: 'bg-rose-100 text-rose-800 border-rose-200' };
      case 'ROOM_MODIFIED':
        return { label: 'Room Config Updated', bg: 'bg-slate-100 text-slate-800 border-slate-300' };
      case 'ROOM_DELETED':
        return { label: 'Room Removed', bg: 'bg-rose-100 text-rose-800 border-rose-200' };
      case 'OFFICE_MODIFIED':
        return { label: 'Office Workspace Updated', bg: 'bg-slate-100 text-slate-800 border-slate-300' };
      default:
        return { label: action, bg: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const filteredLogs = logs.filter(log => {
    // Category match
    if (categoryFilter === 'bookings') {
      if (!['BOOKING_CREATED', 'BOOKING_UPDATED', 'BOOKING_CANCELLED'].includes(log.action)) return false;
    } else if (categoryFilter === 'security') {
      if (!['TOKEN_ACCESS_GRANTED', 'APPROVED_USER_ADDED', 'APPROVED_USER_REMOVED', 'ACCESS_KEY_GENERATED', 'ACCESS_KEY_REVOKED'].includes(log.action)) return false;
    } else if (categoryFilter === 'config') {
      if (!['ROOM_MODIFIED', 'ROOM_DELETED', 'OFFICE_MODIFIED'].includes(log.action)) return false;
    }

    // Search query match
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchActor = log.actorEmail.toLowerCase().includes(q) || log.actorName.toLowerCase().includes(q);
      const matchRoom = log.roomName && log.roomName.toLowerCase().includes(q);
      const matchDetails = log.details.toLowerCase().includes(q);
      const matchTarget = log.targetTitle && log.targetTitle.toLowerCase().includes(q);
      const matchDate = log.bookingDateTime && log.bookingDateTime.toLowerCase().includes(q);
      const matchAction = log.action.toLowerCase().includes(q);
      return matchActor || matchRoom || matchDetails || matchTarget || matchDate || matchAction;
    }

    return true;
  });

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `workspace-audit-logs-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Action', 'Actor Name', 'Actor Email', 'Meeting Schedule', 'Room', 'Details'];
    const rows = logs.map(l => [
      `"${l.formattedTimestamp}"`,
      `"${l.action}"`,
      `"${l.actorName.replace(/"/g, '""')}"`,
      `"${l.actorEmail.replace(/"/g, '""')}"`,
      `"${(l.bookingDateTime || '').replace(/"/g, '""')}"`,
      `"${(l.roomName || '').replace(/"/g, '""')}"`,
      `"${l.details.replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", `workspace-audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all audit history records? This cannot be undone.')) {
      return;
    }
    setIsClearing(true);
    try {
      await onClearLogs();
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Export Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-sans font-bold text-slate-900 text-sm tracking-tight uppercase flex items-center gap-2">
            <History className="w-4.5 h-4.5 text-indigo-600" />
            System Audit & Activity Logs
          </h3>
          <p className="text-[11px] text-slate-500 font-sans mt-0.5">
            Immutable log trails tracking all room bookings, edits, cancellations, and access authorizations.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>Export JSON</span>
          </button>
          {logs.length > 0 && (
            <button
              type="button"
              disabled={isClearing}
              onClick={handleClearAll}
              className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by user email, room, date, or activity details..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
          {[
            { id: 'all', label: `All (${logs.length})` },
            { id: 'bookings', label: 'Bookings' },
            { id: 'security', label: 'Security & Access' },
            { id: 'config', label: 'Config' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id as any)}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                categoryFilter === cat.id
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

      </div>

      {/* Logs Timeline Card List */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-2">
          <History className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-600">No activity log entries found</p>
          <p className="text-[11px] text-slate-400">Activity trails will appear automatically as reservations and access permissions are managed.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
          {filteredLogs.map((log) => {
            const badge = getActionBadge(log.action);
            return (
              <div
                key={log.id}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 transition-all shadow-2xs space-y-2.5"
              >
                {/* Top line: Badge + Timestamp */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border ${badge.bg}`}>
                    {badge.label}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {log.formattedTimestamp}
                  </span>
                </div>

                {/* Main Body */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap text-xs text-slate-800">
                    <span className="font-bold flex items-center gap-1 text-slate-900">
                      <User className="w-3.5 h-3.5 text-indigo-600" />
                      {log.actorName}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">({log.actorEmail})</span>
                    {log.roomName && (
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                        {log.roomName} {log.floor ? `(Lvl ${log.floor})` : ''}
                      </span>
                    )}
                  </div>

                  {log.bookingDateTime && (
                    <div className="text-[11px] font-mono text-indigo-700 font-bold bg-indigo-50/70 border border-indigo-100 rounded-md px-2 py-1 flex items-center gap-1.5 w-fit">
                      <Calendar className="w-3 h-3" />
                      <span>Meeting Slot: {log.bookingDateTime}</span>
                    </div>
                  )}

                  <p className="text-xs text-slate-600 leading-relaxed font-sans pt-0.5">
                    {log.details}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
