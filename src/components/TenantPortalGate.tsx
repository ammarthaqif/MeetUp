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
  Layers
} from 'lucide-react';
import { Tenant, AccessKey } from '../types';

interface TenantPortalGateProps {
  tenants: Tenant[];
  accessKeys: AccessKey[];
  onUnlockTenant: (tenant: Tenant, token: string, role: 'company_admin' | 'staff' | 'guest') => void;
  onUnlockMasterAdmin: (token: string) => void;
  user: any;
  onLoginGoogle: () => void;
  isLoggingIn: boolean;
}

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

  const handleVerifyToken = (tokenToVerify?: string) => {
    const raw = (tokenToVerify || tokenInput).trim();
    if (!raw) {
      setErrorMsg('Please enter a valid company access token.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    setTimeout(() => {
      // 1. Check Master Platform Super Admin Key
      const upper = raw.toUpperCase();
      if (upper === 'MASTER-PLATFORM-ADMIN-2026') {
        const defaultTenant = tenants[0] || {
          id: 'tenant-acme',
          name: 'Acme Global Technologies',
          slug: 'acme',
          code: 'ACME',
          description: 'Enterprise Cloud Infrastructure & AI',
          contactEmail: 'admin@acme.com',
          logoBadge: 'AG',
          themeColor: 'indigo',
          planTier: 'Enterprise',
          createdAt: Date.now(),
          active: true,
        };
        setSuccessMsg('Master Platform Super Administrator authenticated! Accessing enterprise fleet.');
        setTimeout(() => {
          onUnlockMasterAdmin(upper);
          onUnlockTenant(defaultTenant, upper, 'company_admin');
        }, 600);
        setIsVerifying(false);
        return;
      }

      // 2. Find matching Access Key
      const matchedKey = accessKeys.find(
        k => k.active && k.token.toLowerCase() === raw.toLowerCase()
      );

      if (!matchedKey) {
        setErrorMsg('Invalid or expired company access token. Please check and try again.');
        setIsVerifying(false);
        return;
      }

      // Check max uses
      if (matchedKey.maxUses && matchedKey.usedCount >= matchedKey.maxUses) {
        setErrorMsg('This company access token has reached its maximum utilization threshold.');
        setIsVerifying(false);
        return;
      }

      // Master key registered in accessKeys
      if (matchedKey.tenantId === 'ALL') {
        const defaultTenant = tenants[0];
        setSuccessMsg(`Authenticated via ${matchedKey.label}`);
        setTimeout(() => {
          onUnlockMasterAdmin(matchedKey.token);
          if (defaultTenant) {
            onUnlockTenant(defaultTenant, matchedKey.token, 'company_admin');
          }
        }, 500);
        setIsVerifying(false);
        return;
      }

      // Find tenant
      const targetTenant = tenants.find(t => t.id === matchedKey.tenantId && t.active);
      if (!targetTenant) {
        setErrorMsg('The organization associated with this token is currently deactivated or unavailable.');
        setIsVerifying(false);
        return;
      }

      setSuccessMsg(`Verified! Unlocking ${targetTenant.name} workspace...`);
      setTimeout(() => {
        onUnlockTenant(targetTenant, matchedKey.token, matchedKey.role || 'staff');
      }, 500);
      setIsVerifying(false);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white font-sans">
      {/* Background ambient lighting */}
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
            <p className="text-xs text-slate-400">Next-Gen Corporate Meeting Room Orchestrator</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-medium">{user.email}</span>
            </div>
          ) : (
            <button
              onClick={onLoginGoogle}
              disabled={isLoggingIn}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 font-medium transition-all cursor-pointer shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5 text-indigo-400" />
              {isLoggingIn ? 'Connecting...' : 'Corporate Google SSO'}
            </button>
          )}
        </div>
      </header>

      {/* Main Gateway Card Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6 my-6">
        <div className="max-w-xl w-full">
          {/* Central Access Box */}
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-black/80 space-y-8">
            
            {/* Title & Badge */}
            <div className="text-center space-y-2.5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                Tenant Access Control Gate
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Enter Company Access Token
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                Provide your company or department passkey to unlock your dedicated meeting rooms, live floor plans, and schedules.
              </p>
            </div>

            {/* Token Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerifyToken();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Access Token / Passkey
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                    <KeyRound className="w-5 h-5 text-indigo-400" />
                  </div>
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => {
                      setTokenInput(e.target.value);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    placeholder="e.g. ACME-CORP-2025 or NEXUS-CAPITAL-777"
                    className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 rounded-2xl pl-12 pr-4 py-3.5 text-sm sm:text-base font-mono font-medium text-white placeholder-slate-500 transition-all uppercase tracking-wide"
                    autoFocus
                  />
                </div>
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
                    <span>Verifying Company Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Unlock Organization Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Switcher Section */}
            <div className="pt-6 border-t border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Quick-Access Demo Workspaces
                </div>
                <span className="text-[11px] text-slate-500">1-click token fill</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {tenants.map((t) => {
                  const demoKey = accessKeys.find(k => k.tenantId === t.id && k.active);
                  const tokenVal = demoKey?.token || `${t.code}-CORP-2025`;

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setTokenInput(tokenVal);
                        handleVerifyToken(tokenVal);
                      }}
                      className="group p-3 rounded-2xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition-all text-left flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                          t.themeColor === 'emerald' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                          t.themeColor === 'violet' ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' :
                          t.themeColor === 'cyan' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                          'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}>
                          {t.logoBadge}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                            {t.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {tokenVal}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 transition-colors" />
                    </button>
                  );
                })}

                {/* Master Platform Admin Key */}
                <button
                  type="button"
                  onClick={() => {
                    setTokenInput('MASTER-PLATFORM-ADMIN-2026');
                    handleVerifyToken('MASTER-PLATFORM-ADMIN-2026');
                  }}
                  className="sm:col-span-2 group p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-950/60 hover:from-amber-500/20 hover:to-slate-800/80 border border-amber-500/30 transition-all text-left flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
                      👑
                    </div>
                    <div>
                      <div className="text-xs font-bold text-amber-200 flex items-center gap-2">
                        Master Platform Super Administrator
                        <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/20 rounded border border-amber-500/30 text-amber-300 font-mono">
                          ALL TENANTS
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        MASTER-PLATFORM-ADMIN-2026
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>

          </div>

          {/* Privacy & Enterprise Trust Highlights */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-2xl bg-slate-900/40 border border-slate-800/60">
              <Lock className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
              <div className="text-[11px] font-bold text-slate-300">Tenant Isolation</div>
              <div className="text-[10px] text-slate-500">Zero data crossover</div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900/40 border border-slate-800/60">
              <Layers className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
              <div className="text-[11px] font-bold text-slate-300">Multi-Office Campuses</div>
              <div className="text-[10px] text-slate-500">Global floor matrix</div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900/40 border border-slate-800/60">
              <Briefcase className="w-4 h-4 text-purple-400 mx-auto mb-1" />
              <div className="text-[11px] font-bold text-slate-300">Enterprise Sync</div>
              <div className="text-[10px] text-slate-500">Google & Outlook ready</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 text-center text-xs text-slate-500 border-t border-slate-900">
        Workspace Matrix &bull; Multi-Tenant Enterprise Meeting Orchestrator &bull; Secure Tokenized Architecture
      </footer>
    </div>
  );
};
