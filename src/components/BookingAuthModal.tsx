import React, { useState, useEffect } from 'react';
import { ShieldCheck, Key, Lock, AlertCircle, CheckCircle2, ArrowRight, UserCheck, Sparkles, X, ShieldAlert } from 'lucide-react';
import { AccessKey } from '../types';
import { getRateLimitStatus } from '../utils/security';

interface BookingAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginGoogle: () => Promise<void>;
  onVerifyToken: (tokenString: string) => boolean;
  currentUserEmail?: string | null;
  adminEmail: string;
}

export const BookingAuthModal: React.FC<BookingAuthModalProps> = ({
  isOpen,
  onClose,
  onLoginGoogle,
  onVerifyToken,
  currentUserEmail,
  adminEmail,
}) => {
  const [tokenInput, setTokenInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [rateLimit, setRateLimit] = useState<{ isLocked: boolean; remainingLockoutSeconds: number }>(() => getRateLimitStatus());

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setRateLimit(getRateLimitStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rateLimit.isLocked) {
      setErrorMsg(`Anti-Brute-Force Lockout active. Please wait ${rateLimit.remainingLockoutSeconds}s before retrying.`);
      return;
    }

    if (!tokenInput.trim()) {
      setErrorMsg('Please enter a valid secret access token.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    const success = onVerifyToken(tokenInput.trim());
    setIsVerifying(false);

    if (!success) {
      const updatedStatus = getRateLimitStatus();
      setRateLimit(updatedStatus);
      if (updatedStatus.isLocked) {
        setErrorMsg(`Security Lockout: Too many invalid attempts. Try again in ${updatedStatus.remainingLockoutSeconds}s.`);
      } else {
        setErrorMsg('Invalid, expired, or inactive Secret Access Token. Please contact the administrator.');
      }
    } else {
      setTokenInput('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div 
        id="booking-auth-modal"
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full space-y-5 animate-in fade-in zoom-in-95 duration-150"
      >
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-sans font-bold text-slate-800 text-sm tracking-tight uppercase">
                Booking Permission Required
              </h3>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Restricted Corporate Workspace Access
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informational Banner */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs text-slate-600 leading-relaxed">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Authorization Gate</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Meeting room reservations are restricted to approved accounts whitelist or users possessing an Admin-generated Secret Access Token.
          </p>
        </div>

        {/* Current status if signed in with an unwhitelisted email */}
        {currentUserEmail && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px]">
              <span className="font-bold">Signed in as: </span>
              <span className="font-mono">{currentUserEmail}</span>
              <p className="text-[10px] text-amber-700 mt-0.5">
                This email is not yet in the approved list. Enter an access token below to unlock booking.
              </p>
            </div>
          </div>
        )}

        {/* Anti-Brute-Force Lockout Banner */}
        {rateLimit.isLocked && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-900 animate-pulse">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-[11px]">
              <span className="font-bold">Anti-Brute-Force Lockout Active</span>
              <p className="text-[10px] text-rose-700 mt-0.5">
                Multiple invalid verification attempts detected. Submissions are temporarily blocked for <strong className="font-mono text-rose-900">{rateLimit.remainingLockoutSeconds}s</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Option 1: Secret Token Form */}
        <form onSubmit={handleTokenSubmit} className="space-y-3 pt-1">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
              Enter Secret Access Token
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                disabled={rateLimit.isLocked}
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                  setErrorMsg('');
                }}
                placeholder={rateLimit.isLocked ? `Locked (${rateLimit.remainingLockoutSeconds}s)` : "e.g. SEC-A93F-K82L"}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs font-mono font-bold text-slate-800 uppercase placeholder:normal-case placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white disabled:opacity-50"
              />
            </div>
            {errorMsg && (
              <p className="text-[10px] text-rose-600 font-semibold mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-rose-600" /> {errorMsg}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isVerifying || rateLimit.isLocked}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider py-2.5 rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span>{rateLimit.isLocked ? `Locked (${rateLimit.remainingLockoutSeconds}s)` : 'Verify & Unlock Booking'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-2">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-white px-2 text-[10px] font-mono text-slate-400 font-bold uppercase shrink-0">
            OR
          </span>
        </div>

        {/* Option 2: Sign in with Approved Account */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={onLoginGoogle}
            className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <UserCheck className="w-4 h-4 text-indigo-600" />
            <span>Sign in with Authorized Google Email</span>
          </button>

          <p className="text-[9px] text-center text-slate-400 font-mono">
            Access protected by workspace authorization policy
          </p>
        </div>

      </div>
    </div>
  );
};
