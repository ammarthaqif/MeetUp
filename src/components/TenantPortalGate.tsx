import React, { useState } from 'react';
import { 
  Building2, 
  KeyRound, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  Lock, 
  LogIn, 
  CheckCircle2, 
  AlertCircle,
  Briefcase,
  Layers,
  Crown,
  Shield,
  HelpCircle,
  UserCheck
} from 'lucide-react';
import { Tenant, AccessKey } from '../types';
import { DEFAULT_TENANTS, DEFAULT_TENANT_ACCESS_KEYS } from '../data/defaultTenants';
import { 
  timingSafeEqual, 
  getRateLimitStatus, 
  recordFailedAttempt, 
  resetRateLimit,
  cleanAndNormalizeToken,
  cleanAlphaNumericToken,
  isTokenMatch,
  healAndSanitizeAccessKeys,
  resolveAccessTokenOrPasskey
} from '../utils/security';

interface TenantPortalGateProps {
  tenants: Tenant[];
  accessKeys: AccessKey[];
  onUnlockTenant: (tenant: Tenant, token: string, role: 'company_admin' | 'staff' | 'guest') => void;
  onUnlockMasterAdmin: (token: string) => void;
  user: any;
  onLoginGoogle: () => void;
  isLoggingIn: boolean;
}

const SUPER_ADMIN_EMAIL = 'ammarthaqif.ar@gmail.com';

export const TenantPortalGate: React.FC<TenantPortalGateProps> = ({
  tenants,
  accessKeys,
  onUnlockTenant,
  onUnlockMasterAdmin,
  user,
  onLoginGoogle,
  isLoggingIn,
}) => {
  const [tokenInput, setTokenInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showLoginHelp, setShowLoginHelp] = useState(false);
  const [activeTab, setActiveTab] = useState<'token' | 'superadmin'>('token');

  const isSuperAdmin = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  // Find if user is assigned focal admin for any tenant
  const userFocalTenants = user?.email
    ? tenants.filter(t => t.focalAdminEmails?.some(e => e.toLowerCase() === user.email.toLowerCase()))
    : [];

  const handleVerifyToken = (tokenToVerify?: string) => {
    const cleanInput = cleanAndNormalizeToken(tokenToVerify || tokenInput);

    if (!cleanInput) {
      setErrorMsg('Please enter a valid company access token.');
      setIsVerifying(false);
      return;
    }

    const rateStatus = getRateLimitStatus();
    if (rateStatus.isLocked) {
      setErrorMsg(`Anti-Brute-Force Lockout active. Please wait ${rateStatus.remainingLockoutSeconds}s before retrying.`);
      setIsVerifying(false);
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const delayMs = Math.max(250, rateStatus.penaltyDelayMs);

    setTimeout(() => {
      // Read fresh keys from state and localStorage
      let rawKeys: AccessKey[] = accessKeys;
      try {
        const saved = localStorage.getItem('office_sync_access_keys');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            rawKeys = parsed;
          }
        }
      } catch {}

      const resolved = resolveAccessTokenOrPasskey(cleanInput, rawKeys, tenants);

      // If not valid, record attempt and display clear guidance
      if (!resolved.valid || !resolved.tenant) {
        const penalty = recordFailedAttempt();
        if (penalty.isLocked) {
          setErrorMsg(`Security Lockout: Too many invalid attempts. Try again in ${penalty.remainingLockoutSeconds}s.`);
        } else if (penalty.warning) {
          setErrorMsg(penalty.warning);
        } else {
          setErrorMsg(resolved.reason || 'Invalid company access token. Please verify or use a shortcut below.');
        }
        setIsVerifying(false);
        return;
      }

      // Reset rate limit counter on valid key
      resetRateLimit();

      // Master Super Admin bypass or universal key
      if (resolved.isSuperAdmin || resolved.key?.tenantId === 'ALL') {
        const targetTenant = resolved.tenant || tenants[0] || DEFAULT_TENANTS[0];
        setSuccessMsg(`Authenticated Master Administrator via ${resolved.token}`);
        setTimeout(() => {
          onUnlockMasterAdmin(resolved.token);
          if (targetTenant) {
            onUnlockTenant(targetTenant, resolved.token, 'company_admin');
          }
        }, 300);
        setIsVerifying(false);
        return;
      }

      // Standard Tenant Unlock
      const targetTenant = resolved.tenant;
      const roleToAssign = resolved.role || 'staff';
      setSuccessMsg(`Verified! Unlocking ${targetTenant.name} workspace (${roleToAssign === 'company_admin' ? 'Admin' : 'Staff'})...`);
      setTimeout(() => {
        onUnlockTenant(targetTenant, resolved.token, roleToAssign);
      }, 300);
      setIsVerifying(false);
    }, delayMs);
  };

  const handleLaunchSuperAdmin = () => {
    const defaultTenant = tenants[0];
    onUnlockMasterAdmin('SUPERADMIN-AUTH');
    if (defaultTenant) {
      onUnlockTenant(defaultTenant, 'SUPERADMIN-AUTH', 'company_admin');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white font-sans">
      {/* Ambient background lighting */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent blur-3xl rounded-full" />
        <div className="absolute -bottom-40 right-10 w-[500px] h-[400px] bg-cyan-600/10 blur-3xl rounded-full" />
      </div>

      {/* Top minimal header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-600/30 ring-1 ring-white/20">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Workspace Matrix
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Multi-Tenant Enterprise
              </span>
            </h1>
            <p className="text-xs text-slate-400">Confidential Corporate Meeting Room Orchestrator</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-medium">{user.email}</span>
              {isSuperAdmin ? (
                <span className="text-[9px] font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/40 font-bold uppercase flex items-center gap-1">
                  <Crown className="w-2.5 h-2.5" />
                  Super Admin
                </span>
              ) : (
                <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                  SSO Connected
                </span>
              )}
            </div>
          ) : (
            <button
              onClick={onLoginGoogle}
              disabled={isLoggingIn}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 font-medium transition-all cursor-pointer shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5 text-indigo-400" />
              {isLoggingIn ? 'Connecting...' : 'Sign In with Google'}
            </button>
          )}
        </div>
      </header>

      {/* Main Gateway Card Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6 my-6">
        <div className="max-w-xl w-full space-y-4">

          {/* Superadmin Dedicated Banner (if logged in as Super Admin) */}
          {isSuperAdmin && (
            <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-500/20 via-slate-900 to-indigo-950 border border-amber-500/50 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                    Platform Super Administrator
                    <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1.5 py-0.2 rounded font-mono font-bold">
                      VERIFIED
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Authenticated with Master Administrator Privileges
                  </p>
                  <p className="text-[11px] text-slate-400">
                    You have global privileges over all client organizations, subscriptions, and system settings.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLaunchSuperAdmin}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 active:scale-[0.98]"
              >
                <span>Enter Master Console</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Assigned Focal Admin Banner (if logged in user is focal admin for tenants) */}
          {!isSuperAdmin && userFocalTenants.length > 0 && (
            <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-500/20 via-slate-900 to-indigo-950 border border-emerald-500/40 shadow-xl space-y-2.5 animate-fadeIn">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Assigned Company Administrator</span>
              </div>
              <p className="text-xs text-slate-300">
                Your account (<span className="font-mono text-emerald-300">{user.email}</span>) is assigned as Admin for the following workspace:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {userFocalTenants.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      const tKey = accessKeys.find(k => k.tenantId === t.id && k.active)?.token || `${t.code}-ADMIN`;
                      onUnlockTenant(t, tKey, 'company_admin');
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/50 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Enter {t.name} Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-300" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Central Access Box */}
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-black/80 space-y-7">
            
            {/* Title & Badge */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                Confidential Enterprise Gateway
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Workspace Matrix Portal
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                Secure multi-tenant workspace orchestrator. Sign in with your authorized Super Admin account or provide your company access token.
              </p>
            </div>

            {/* Authentication Mode Tabs */}
            <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('token');
                  setErrorMsg(null);
                }}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'token'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Company Access Token</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('superadmin');
                  setErrorMsg(null);
                }}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'superadmin'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Super Admin Login</span>
              </button>
            </div>

            {/* Tab 1: Token Form for Company Employees */}
            {activeTab === 'token' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVerifyToken();
                }}
                className="space-y-4 animate-fadeIn"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Company Access Token / Passkey
                    </label>
                    <span className="text-[11px] text-slate-500">Confidential Key</span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                      <KeyRound className="w-5 h-5 text-indigo-400" />
                    </div>
                    <input
                      type="password"
                      value={tokenInput}
                      onChange={(e) => {
                        setTokenInput(e.target.value);
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      placeholder="Enter private company token"
                      className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 rounded-2xl pl-12 pr-4 py-3.5 text-sm sm:text-base font-mono font-medium text-white placeholder-slate-500 transition-all uppercase tracking-wider"
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Issued directly by your company's Workplace Administrator. Client tokens are confidential and not exposed publicly.
                  </p>
                </div>

                {/* Status alerts */}
                {errorMsg && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs animate-fadeIn">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isVerifying || !tokenInput.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-bold text-sm py-3.5 rounded-2xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  {isVerifying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying Token Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Unlock Organization Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Quick Demo Access Token Presets */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Quick Demo Token Shortcuts:
                    </span>
                    <span className="text-slate-500 font-mono text-[10px]">Click to auto-fill & unlock</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {tenants.slice(0, 4).map(t => {
                      const key = accessKeys.find(k => k.tenantId === t.id && k.active)?.token || `${t.code}-CORP-2025`;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setTokenInput(key);
                            handleVerifyToken(key);
                          }}
                          className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 text-left transition-all cursor-pointer group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200 group-hover:text-indigo-300 truncate">
                              {t.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono group-hover:text-slate-300">
                              {t.code}
                            </span>
                          </div>
                          <div className="text-[10px] text-indigo-400 font-mono mt-0.5">
                            {key}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </form>
            )}

            {/* Tab 2: Super Admin & SSO Login Instructions */}
            {activeTab === 'superadmin' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span>Super Admin Access Policy</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Platform Super Admin privileges are restricted exclusively to authorized master administrators.
                  </p>
                  <ul className="text-[11px] text-slate-400 space-y-1 pl-4 list-disc">
                    <li>Sign in with your authorized Google administrator account.</li>
                    <li>The system will automatically authenticate your Super Admin role without needing client tokens.</li>
                    <li>Manage all client organizations, subscription contracts, room setups, and access keys.</li>
                  </ul>
                </div>

                {isSuperAdmin ? (
                  <div className="space-y-2 pt-2">
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>You are currently authenticated as the Platform Super Administrator.</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleLaunchSuperAdmin}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm py-3.5 rounded-2xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                    >
                      <Crown className="w-4 h-4" />
                      <span>Launch Master Super Admin Console</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <button
                      type="button"
                      onClick={onLoginGoogle}
                      disabled={isLoggingIn}
                      className="w-full bg-slate-100 hover:bg-white text-slate-900 font-bold text-sm py-3.5 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3 cursor-pointer active:scale-[0.99]"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>{isLoggingIn ? 'Connecting to Google...' : 'Sign In with Google (Super Admin)'}</span>
                    </button>
                    <p className="text-[11px] text-center text-slate-500">
                      Sign in with your authorized Google administrator account to activate Super Admin mode.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Help / Guidance accordion */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowLoginHelp(!showLoginHelp)}
                className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-300 py-1 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                  <span>How does authentication work?</span>
                </span>
                <span className="text-[10px] text-indigo-400 font-semibold">
                  {showLoginHelp ? 'Hide' : 'View Guide'}
                </span>
              </button>

              {showLoginHelp && (
                <div className="mt-2.5 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-2 animate-fadeIn">
                  <div>
                    <strong className="text-amber-300 block mb-0.5">1. Platform Super Administrator</strong>
                    Sign in with your authorized Super Admin Google account. You gain instant master control across all corporate tenants.
                  </div>
                  <div>
                    <strong className="text-indigo-300 block mb-0.5">2. Company Staff & Guests</strong>
                    Enter your organization's confidential access token (e.g. issued by your company admin).
                  </div>
                  <div>
                    <strong className="text-emerald-300 block mb-0.5">3. Assigned Company Administrators</strong>
                    Company admins can either use their designated company admin token or sign in via Google SSO if their email was whitelisted by the Super Admin.
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Privacy & Enterprise Trust Highlights */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800/60">
              <Lock className="w-4 h-4 text-indigo-400 mx-auto mb-1.5" />
              <div className="text-[11px] font-bold text-slate-300">Confidential Gateway</div>
              <div className="text-[10px] text-slate-500">Zero public tenant listings</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800/60">
              <ShieldCheck className="w-4 h-4 text-emerald-400 mx-auto mb-1.5" />
              <div className="text-[11px] font-bold text-slate-300">RBAC Isolation</div>
              <div className="text-[10px] text-slate-500">Super Admin & Focal roles</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800/60">
              <Briefcase className="w-4 h-4 text-purple-400 mx-auto mb-1.5" />
              <div className="text-[11px] font-bold text-slate-300">Enterprise Sync</div>
              <div className="text-[10px] text-slate-500">Multi-campus isolation</div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 text-center text-xs text-slate-500 border-t border-slate-900">
        Workspace Matrix &bull; Multi-Tenant Enterprise Meeting Orchestrator &bull; Confidential Gateway
      </footer>
    </div>
  );
};
