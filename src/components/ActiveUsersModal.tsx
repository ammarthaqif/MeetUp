import React, { useState } from 'react';
import { 
  Users, 
  X, 
  Search, 
  Circle, 
  Laptop, 
  Smartphone, 
  Clock, 
  MapPin, 
  Shield, 
  Sparkles, 
  Building2, 
  CalendarCheck2, 
  Eye, 
  Filter,
  CheckCircle2
} from 'lucide-react';
import { ActivePresenceUser, Tenant, Office } from '../types';
import { SESSION_TAB_ID } from '../utils/presenceManager';

interface ActiveUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUsers: ActivePresenceUser[];
  activeTenant?: Tenant | null;
  activeOffice?: Office | null;
  isMasterAdmin?: boolean;
  onSwitchTenant?: (tenant: Tenant, token?: string, initialOffice?: Office) => void;
}

export const ActiveUsersModal: React.FC<ActiveUsersModalProps> = ({
  isOpen,
  onClose,
  activeUsers,
  activeTenant,
  activeOffice,
  isMasterAdmin = false,
  onSwitchTenant,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'staff'>('all');
  const [scopeFilter, setScopeFilter] = useState<'tenant' | 'all'>('tenant');

  if (!isOpen) return null;

  // Filter users by scope, search, and role
  const filteredUsers = activeUsers.filter(u => {
    // Scope filter (Master admin can see all; otherwise default to tenant scope)
    if (scopeFilter === 'tenant' && activeTenant && u.tenantId !== activeTenant.id) {
      return false;
    }

    // Role filter
    if (roleFilter === 'admin' && u.role !== 'company_admin' && u.role !== 'super_admin') {
      return false;
    }
    if (roleFilter === 'staff' && (u.role === 'company_admin' || u.role === 'super_admin')) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = u.displayName.toLowerCase().includes(q);
      const matchEmail = u.email.toLowerCase().includes(q);
      const matchTenant = u.tenantName?.toLowerCase().includes(q);
      const matchOffice = u.officeName?.toLowerCase().includes(q);
      const matchView = u.currentView?.toLowerCase().includes(q);
      const matchRoom = u.activeRoomName?.toLowerCase().includes(q);
      return matchName || matchEmail || matchTenant || matchOffice || matchView || matchRoom;
    }

    return true;
  });

  const tenantUsersCount = activeTenant 
    ? activeUsers.filter(u => u.tenantId === activeTenant.id).length 
    : activeUsers.length;

  const totalOnlineCount = activeUsers.length;

  const formatTimeAgo = (timestamp: number) => {
    const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    return `${diffMin}m ago`;
  };

  const formatSessionDuration = (joinedAt?: number) => {
    if (!joinedAt) return '< 1m';
    const diffMin = Math.floor((Date.now() - joinedAt) / 60000);
    if (diffMin < 1) return 'Just joined';
    if (diffMin < 60) return `${diffMin}m active`;
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 leading-tight">
                  Active Staff & Live Sessions
                </h2>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {scopeFilter === 'tenant' && activeTenant ? `${tenantUsersCount} in ${activeTenant.code}` : `${totalOnlineCount} Online`}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time concurrent collaborators connected to the workspace matrix
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Field */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, office, or view..."
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            )}
          </div>

          {/* Scope & Role Pills */}
          <div className="flex items-center gap-2">
            {isMasterAdmin && (
              <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-[11px] font-semibold">
                <button
                  onClick={() => setScopeFilter('tenant')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    scopeFilter === 'tenant' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {activeTenant?.code || 'This Workspace'}
                </button>
                <button
                  onClick={() => setScopeFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    scopeFilter === 'all' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Tenants ({totalOnlineCount})
                </button>
              </div>
            )}

            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-[11px] font-semibold">
              <button
                onClick={() => setRoleFilter('all')}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  roleFilter === 'all' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setRoleFilter('admin')}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  roleFilter === 'admin' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Admins
              </button>
              <button
                onClick={() => setRoleFilter('staff')}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  roleFilter === 'staff' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Staff
              </button>
            </div>
          </div>
        </div>

        {/* Active Users List */}
        <div className="p-6 overflow-y-auto space-y-3 divide-y divide-slate-100">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No active staff found</p>
              <p className="text-xs text-slate-500 mt-1">
                {searchQuery ? 'Try clearing your search query' : 'Sessions will appear as staff join the workspace.'}
              </p>
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isCurrentTabSession = u.sessionId === SESSION_TAB_ID || u.id === SESSION_TAB_ID;
              const isBooking = u.status === 'in_booking';
              const isIdle = u.status === 'idle';

              return (
                <div 
                  key={u.id || u.sessionId} 
                  className={`pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl transition-all ${
                    isCurrentTabSession 
                      ? 'bg-indigo-50/50 border border-indigo-200/80' 
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  {/* Left: Avatar, Name, Email, Tenant */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      {u.photoURL ? (
                        <img 
                          src={u.photoURL} 
                          alt={u.displayName} 
                          className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                          {u.displayName ? u.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'ST'}
                        </div>
                      )}
                      {/* Status indicator dot */}
                      <span 
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                          isBooking ? 'bg-amber-500' : isIdle ? 'bg-slate-400' : 'bg-emerald-500'
                        }`} 
                        title={isBooking ? 'In Booking Flow' : isIdle ? 'Idle' : 'Active Online'}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 truncate">
                          {u.displayName}
                        </span>
                        
                        {isCurrentTabSession && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-indigo-600 text-white tracking-wider uppercase">
                            You
                          </span>
                        )}

                        {/* Role pill */}
                        {u.role === 'super_admin' ? (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200">
                            Superadmin
                          </span>
                        ) : u.role === 'company_admin' ? (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-200">
                            Company Admin
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                            Staff
                          </span>
                        )}

                        {/* Organization badge if multiple tenants shown */}
                        {u.tenantName && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            🏢 {u.tenantCode || u.tenantName}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                        <span className="font-mono text-[11px] truncate max-w-[200px]">{u.email}</span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1 text-[11px]">
                          {u.device?.includes('Mobile') ? (
                            <Smartphone className="w-3 h-3 text-slate-400" />
                          ) : (
                            <Laptop className="w-3 h-3 text-slate-400" />
                          )}
                          <span>{u.device || 'Desktop'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Activity & Live View Location */}
                  <div className="sm:text-right shrink-0 flex flex-col sm:items-end justify-center pl-13 sm:pl-0">
                    <div className="flex items-center gap-1.5">
                      {isBooking ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <CalendarCheck2 className="w-3 h-3 text-amber-600 animate-pulse" />
                          Booking {u.activeRoomName || 'Room'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
                          <Eye className="w-3 h-3 text-slate-500" />
                          {u.currentView || 'Day Timeline'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-1">
                      {u.officeName && (
                        <>
                          <span className="truncate max-w-[130px]">📍 {u.officeName}</span>
                          <span>&bull;</span>
                        </>
                      )}
                      <span>Active {formatTimeAgo(u.lastActive)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-semibold text-slate-800">{totalOnlineCount} total staff session{totalOnlineCount !== 1 ? 's' : ''} connected</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
