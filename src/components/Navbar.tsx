import React from 'react';
import { LogOut, ShieldCheck, Building2, ChevronDown } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { Office, Tenant } from '../types';

interface NavbarProps {
  user: FirebaseUser | null;
  onLogin: () => void;
  onLogout: () => void;
  isLoggingIn: boolean;
  googleToken: string | null;
  activeTenant?: Tenant | null;
  onOpenTenantSwitcher?: () => void;
  activeOffice?: Office | null;
  onSwitchOffice?: () => void;
  isAdminMode?: boolean;
  isMasterAdmin?: boolean;
  isFocalAdmin?: boolean;
  onOpenAdminAuth?: () => void;
  onExitAdminMode?: () => void;
  onOpenRoomFinder?: () => void;
  adminEmail?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogin,
  onLogout,
  isLoggingIn,
  googleToken,
  activeTenant,
  onOpenTenantSwitcher,
  activeOffice,
  onSwitchOffice,
  isAdminMode,
  isMasterAdmin = false,
  isFocalAdmin = false,
  onOpenAdminAuth,
  onExitAdminMode,
  onOpenRoomFinder,
  adminEmail = 'ammarthaqif.ar@gmail.com',
}) => {
  const hasAdminRights = isMasterAdmin || isFocalAdmin;

  return (
    <header id="app-header" className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between gap-3">
        
        {/* Left: Tenant Branding & Workspace Switcher */}
        <div className="flex items-center gap-3 shrink-0">
          {activeTenant ? (
            <button
              onClick={onOpenTenantSwitcher}
              className="flex items-center gap-2.5 p-1.5 -ml-1.5 rounded-xl hover:bg-slate-100 transition-all text-left group cursor-pointer"
              title="Click to Switch Company Workspace"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white shadow-xs ${
                activeTenant.themeColor === 'emerald' ? 'bg-emerald-600' :
                activeTenant.themeColor === 'violet' ? 'bg-violet-600' :
                activeTenant.themeColor === 'cyan' ? 'bg-cyan-600' :
                'bg-indigo-600'
              }`}>
                {activeTenant.logoBadge || 'TM'}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-bold text-xs sm:text-sm tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors truncate max-w-[150px] sm:max-w-[200px]">
                    {activeTenant.name}
                  </h1>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                  <span className="font-semibold text-slate-700">{activeTenant.code}</span>
                  <span>&bull;</span>
                  <span>{activeTenant.planTier}</span>
                </div>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-sm shadow-xs">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h1 className="font-bold text-sm text-slate-900 leading-tight">WORKSPACE MATRIX</h1>
                <p className="text-[10px] text-slate-500 font-mono">Multi-Tenant Corporate</p>
              </div>
            </div>
          )}
        </div>

        {/* Center: Office & Campus Switcher */}
        {activeOffice && onSwitchOffice && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-2xs max-w-sm">
            <span className="truncate" title={`${activeOffice.name} - ${activeOffice.location}`}>
              🏢 {activeOffice.name}
            </span>
            <button 
              onClick={onSwitchOffice} 
              className="text-[11px] text-indigo-600 hover:text-indigo-800 underline ml-1 shrink-0 font-bold cursor-pointer"
            >
              Switch Campus
            </button>
          </div>
        )}

        {/* Right: Actions & User Status */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
          {/* Smart Room Finder trigger button */}
          {activeOffice && onOpenRoomFinder && !isAdminMode && (
            <button
              onClick={onOpenRoomFinder}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-xs hover:shadow-sm"
              title="Find Available Rooms by Time & Duration"
            >
              <span className="text-amber-300">⚡</span>
              <span className="hidden sm:inline">Room Finder</span>
            </button>
          )}

          {/* Admin console button */}
          {onOpenAdminAuth && (
            <button
              onClick={isAdminMode ? onExitAdminMode : onOpenAdminAuth}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                isAdminMode 
                  ? 'bg-amber-950 text-amber-300 border-amber-900 hover:bg-amber-900 shadow-xs' 
                  : isMasterAdmin
                    ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 shadow-2xs'
                    : isFocalAdmin
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${isMasterAdmin ? 'text-indigo-600' : isFocalAdmin ? 'text-emerald-600' : 'text-slate-500'}`} />
              <span className="hidden xs:inline">
                {isAdminMode 
                  ? 'Exit Admin' 
                  : isMasterAdmin 
                    ? 'Superadmin' 
                    : isFocalAdmin 
                      ? 'Company Admin' 
                      : 'Admin'}
              </span>
            </button>
          )}

          <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

          {user ? (
            <div className="flex items-center gap-2.5 pl-1">
              <div className="text-right hidden sm:block">
                <div className="flex items-center justify-end gap-1.5">
                  <p className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[130px]">
                    {user.displayName || user.email?.split('@')[0] || 'Staff Member'}
                  </p>
                  {isMasterAdmin ? (
                    <span className="text-[8px] font-mono bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-black uppercase">
                      Superadmin
                    </span>
                  ) : isFocalAdmin ? (
                    <span className="text-[8px] font-mono bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded font-black uppercase">
                      Focal Admin
                    </span>
                  ) : null}
                </div>
                <p className="text-[9px] text-slate-400 font-mono">
                  {user.email}
                </p>
              </div>

              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-8 h-8 rounded-full border border-slate-300"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-slate-300">
                  {user.displayName ? user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U'}
                </div>
              )}

              <button
                id="btn-logout"
                onClick={onLogout}
                title="Sign Out"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="btn-login-google"
              onClick={onLogin}
              disabled={isLoggingIn}
              className={`flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-xl shadow-2xs hover:bg-slate-50 active:bg-slate-100 hover:border-slate-300 transition-all text-xs cursor-pointer ${
                isLoggingIn ? 'opacity-75 pointer-events-none' : ''
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 block">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
              </div>
              <span className="font-sans font-medium text-slate-700 hidden sm:inline">
                {isLoggingIn ? 'Connecting...' : 'Sign in'}
              </span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
};

