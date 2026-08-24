import React, { useState } from 'react';
import { 
  Building2, 
  X, 
  KeyRound, 
  CheckCircle2, 
  ArrowRight, 
  LogOut, 
  ShieldAlert, 
  Layers,
  Search,
  Sparkles,
  Lock
} from 'lucide-react';
import { Tenant, AccessKey } from '../types';
import { DEFAULT_TENANTS, DEFAULT_TENANT_ACCESS_KEYS } from '../data/defaultTenants';
import { 
  timingSafeEqual, 
  getRateLimitStatus, 
  recordFailedAttempt, 
  resetRateLimit,
  cleanAndNormalizeToken,
  isTokenMatch,
  healAndSanitizeAccessKeys,
  resolveAccessTokenOrPasskey
} from '../utils/security';

interface TenantSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenants: Tenant[];
  currentTenant: Tenant | null;
  accessKeys: AccessKey[];
  isMasterAdmin: boolean;
  onSwitchTenant: (tenant: Tenant, token?: string) => void;
  onLockTenant: () => void;
}

export const TenantSwitcherModal: React.FC<TenantSwitcherModalProps> = ({
  isOpen,
  onClose,
  tenants,
  currentTenant,
  accessKeys,
  isMasterAdmin,
  onSwitchTenant,
  onLockTenant,
}) => {
  const [tokenInput, setTokenInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const handleVerifyNewToken = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = cleanAndNormalizeToken(tokenInput);
    if (!cleanInput) return;

    const rateStatus = getRateLimitStatus();
    if (rateStatus.isLocked) {
      setErrorMsg(`Anti-Brute-Force Lockout active. Try again in ${rateStatus.remainingLockoutSeconds}s.`);
      return;
    }

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

    if (!resolved.valid || !resolved.tenant) {
      const penalty = recordFailedAttempt();
      if (penalty.isLocked) {
        setErrorMsg(`Security Lockout: Too many invalid attempts. Try again in ${penalty.remainingLockoutSeconds}s.`);
      } else if (penalty.warning) {
        setErrorMsg(penalty.warning);
      } else {
        setErrorMsg(resolved.reason || 'Invalid company access token. Please verify with your workspace administrator.');
      }
      return;
    }

    // Valid token
    resetRateLimit();

    const targetTenant = resolved.tenant;
    onSwitchTenant(targetTenant, resolved.token);
    onClose();
  };

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Tenant & Company Switcher
                {isMasterAdmin && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold px-2 py-0.5 rounded-full">
                    Super Admin Unlocked
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Active Tenant: <strong className="text-indigo-300">{currentTenant?.name || 'None'}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          
          {/* Quick Token Access Form */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <KeyRound className="w-4 h-4 text-indigo-400" />
              Switch via Company Access Token
            </div>
            <form onSubmit={handleVerifyNewToken} className="flex gap-2">
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Enter token (e.g. NEXUS-CAPITAL-777)"
                className="flex-1 bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-500 uppercase tracking-wider"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <span>Switch</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
            {errorMsg && (
              <p className="text-[11px] text-rose-400 font-medium">{errorMsg}</p>
            )}
          </div>

          {/* Tenant Directory (Direct Selection for Authorized Super Admin Only) */}
          {isMasterAdmin ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  Super Admin Tenant Directory ({tenants.length})
                </div>
                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filter companies..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredTenants.map((t) => {
                  const isSelected = currentTenant?.id === t.id;
                  const tenantKey = accessKeys.find(k => k.tenantId === t.id && k.active);

                  return (
                    <div
                      key={t.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                        isSelected 
                          ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/30' 
                          : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            t.themeColor === 'emerald' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                            t.themeColor === 'violet' ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' :
                            t.themeColor === 'cyan' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                            'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          }`}>
                            {t.logoBadge}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              {t.name}
                              {isSelected && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">{t.domain || t.code} &bull; {t.planTier}</div>
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400 line-clamp-2">
                        {t.description}
                      </p>

                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-slate-500">
                          {tenantKey ? `Key: ${tenantKey.token}` : 'Token Required'}
                        </span>

                        <button
                          onClick={() => {
                            onSwitchTenant(t, tenantKey?.token);
                            onClose();
                          }}
                          disabled={isSelected}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            isSelected
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                          }`}
                        >
                          {isSelected ? 'Current Workspace' : 'Select'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
              <Lock className="w-5 h-5 text-slate-500 mx-auto" />
              <div className="text-xs font-bold text-slate-300">Confidential Tenant Directory</div>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Other client organization portals and access tokens are kept strictly confidential. To switch to another organization, enter its private access token above.
              </p>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <button
            onClick={() => {
              onLockTenant();
              onClose();
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Lock & Exit Tenant Workspace
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
