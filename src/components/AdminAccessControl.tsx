import React, { useState } from 'react';
import { 
  ShieldCheck, Key, UserPlus, Users, Trash2, Copy, Check, 
  Plus, Search, AlertCircle, RefreshCw, UploadCloud, Lock, CheckCircle2,
  Shield, UserCheck, X, Building2, Crown
} from 'lucide-react';
import { ApprovedUser, AccessKey, Tenant } from '../types';

interface AdminAccessControlProps {
  approvedUsers: ApprovedUser[];
  accessKeys: AccessKey[];
  adminEmail: string;
  currentTenant?: Tenant | null;
  isMasterAdmin?: boolean;
  onSaveTenant?: (tenant: Tenant) => void;
  onAddApprovedUser: (email: string, name?: string, department?: string) => Promise<void>;
  onBulkAddApprovedUsers: (emails: string[]) => Promise<number>;
  onRemoveApprovedUser: (userId: string) => Promise<void>;
  onGenerateAccessKey: (data: { label: string; expiresAt?: string; maxUses?: number }) => Promise<AccessKey>;
  onToggleAccessKey: (keyId: string) => Promise<void>;
  onRevokeAccessKey: (keyId: string) => Promise<void>;
}

export const AdminAccessControl: React.FC<AdminAccessControlProps> = ({
  approvedUsers,
  accessKeys,
  adminEmail,
  currentTenant,
  isMasterAdmin = false,
  onSaveTenant,
  onAddApprovedUser,
  onBulkAddApprovedUsers,
  onRemoveApprovedUser,
  onGenerateAccessKey,
  onToggleAccessKey,
  onRevokeAccessKey,
}) => {
  const [subTab, setSubTab] = useState<'focals' | 'users' | 'keys'>('focals');
  
  // Focal Admin Assignment state (by Superadmin)
  const [newFocalEmail, setNewFocalEmail] = useState('');
  const [focalSearch, setFocalSearch] = useState('');

  // Single user add state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Bulk import state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  // Key generator state
  const [keyLabel, setKeyLabel] = useState('');
  const [keyExpiresAt, setKeyExpiresAt] = useState('');
  const [keyMaxUses, setKeyMaxUses] = useState<string>('');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [keySearch, setKeySearch] = useState('');

  // Notification state
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleAddFocalAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant || !onSaveTenant) return;
    const raw = newFocalEmail.trim().toLowerCase();
    if (!raw) {
      showNotice('error', 'Please enter a valid focal admin email.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(raw)) {
      showNotice('error', 'Invalid email address format.');
      return;
    }
    const currentFocals = currentTenant.focalAdminEmails ? [...currentTenant.focalAdminEmails] : [];
    if (currentFocals.includes(raw)) {
      showNotice('error', 'This user is already an assigned focal admin for this company.');
      return;
    }

    const updated: Tenant = {
      ...currentTenant,
      focalAdminEmails: [...currentFocals, raw]
    };
    onSaveTenant(updated);
    setNewFocalEmail('');
    showNotice('success', `Assigned focal admin role to ${raw} for ${currentTenant.name}`);
  };

  const handleRemoveFocalAdmin = (emailToRemove: string) => {
    if (!currentTenant || !onSaveTenant) return;
    if (window.confirm(`Revoke company focal admin permissions for "${emailToRemove}"?`)) {
      const currentFocals = currentTenant.focalAdminEmails ? [...currentTenant.focalAdminEmails] : [];
      const updated: Tenant = {
        ...currentTenant,
        focalAdminEmails: currentFocals.filter(e => e !== emailToRemove)
      };
      onSaveTenant(updated);
      showNotice('success', `Revoked company admin role for ${emailToRemove}`);
    }
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email) {
      showNotice('error', 'Please enter a valid email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showNotice('error', 'Invalid email address format.');
      return;
    }

    if (approvedUsers.some(u => u.email.toLowerCase() === email) || email === adminEmail.toLowerCase()) {
      showNotice('error', 'This user is already approved.');
      return;
    }

    setIsAddingUser(true);
    try {
      await onAddApprovedUser(email, newName.trim() || undefined, newDept.trim() || undefined);
      setNewEmail('');
      setNewName('');
      setNewDept('');
      showNotice('success', `Approved access for ${email}`);
    } catch {
      showNotice('error', 'Failed to approve user.');
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleBulkImportSubmit = async () => {
    if (!bulkInput.trim()) return;
    const lines = bulkInput.split(/[\n,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
    const validEmails = lines.filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    if (validEmails.length === 0) {
      showNotice('error', 'No valid email addresses parsed.');
      return;
    }

    const count = await onBulkAddApprovedUsers(validEmails);
    setBulkInput('');
    setShowBulkModal(false);
    showNotice('success', `Successfully imported and whitelisted ${count} new user accounts.`);
  };

  const handleGenerateKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyLabel.trim()) {
      showNotice('error', 'Please enter a descriptive label or team name for this token.');
      return;
    }

    setIsGeneratingKey(true);
    try {
      const maxUses = keyMaxUses ? parseInt(keyMaxUses, 10) : undefined;
      const newKey = await onGenerateAccessKey({
        label: keyLabel.trim(),
        expiresAt: keyExpiresAt || undefined,
        maxUses: isNaN(maxUses as number) ? undefined : maxUses,
      });
      setKeyLabel('');
      setKeyExpiresAt('');
      setKeyMaxUses('');
      showNotice('success', `Generated new secret key token: ${newKey.token}`);
    } catch {
      showNotice('error', 'Failed to generate token.');
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const copyToClipboard = (token: string, id: string) => {
    navigator.clipboard.writeText(token);
    setCopiedKeyId(id);
    showNotice('success', 'Token copied to clipboard.');
    setTimeout(() => setCopiedKeyId(null), 2500);
  };

  const filteredUsers = approvedUsers.filter(u => 
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase())) ||
    (u.department && u.department.toLowerCase().includes(userSearch.toLowerCase()))
  );

  const filteredKeys = accessKeys.filter(k =>
    k.label.toLowerCase().includes(keySearch.toLowerCase()) ||
    k.token.toLowerCase().includes(keySearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Sub Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-sans font-bold text-slate-900 text-sm tracking-tight uppercase flex items-center gap-2">
            <ShieldCheck className="w-4.5 h-4.5 text-indigo-600" />
            Access Control & Role Permissions
          </h3>
          <p className="text-[11px] text-slate-500 font-sans mt-0.5">
            {currentTenant ? `Managing permissions for ${currentTenant.name} workspace.` : 'Manage authorized staff whitelist and security keys.'}
          </p>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setSubTab('focals')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              subTab === 'focals'
                ? 'bg-white text-indigo-600 shadow-xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-500" />
            <span>Focal Admins ({(currentTenant?.focalAdminEmails || []).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('users')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              subTab === 'users'
                ? 'bg-white text-indigo-600 shadow-xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Approved Whitelist ({approvedUsers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('keys')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              subTab === 'keys'
                ? 'bg-white text-indigo-600 shadow-xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Secret Tokens ({accessKeys.length})</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
          notification.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* SUBTAB 0: COMPANY FOCAL ADMINISTRATORS */}
      {subTab === 'focals' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-50/70 via-slate-50 to-purple-50/40 border border-indigo-100 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                  <Crown className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    {currentTenant ? `${currentTenant.name} Focal Administrators` : 'Company Focal Administrators'}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200">
                      Company Admin Role
                    </span>
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Assigned focal personnel who hold administrative authority restricted to manage this company's dashboard, offices, rooms, bookings, and staff access.
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 text-white text-[11px] font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Master Superadmin Control
                </span>
              </div>
            </div>

            {/* Superadmin Assignment Form if Superadmin or onSaveTenant is provided */}
            {isMasterAdmin && onSaveTenant && (
              <form onSubmit={handleAddFocalAdmin} className="pt-3 border-t border-indigo-100/80 flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                  <UserPlus className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={newFocalEmail}
                    onChange={(e) => setNewFocalEmail(e.target.value)}
                    placeholder="Enter email to grant Focal Admin access (e.g. director@company.com)..."
                    className="w-full bg-white border border-indigo-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Assign Company Admin</span>
                </button>
              </form>
            )}
          </div>

          {/* Focal Admins List */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                Active Company Focal Admins ({(currentTenant?.focalAdminEmails || []).length})
              </span>
              <span className="text-[11px] text-slate-500">
                {isMasterAdmin ? 'Managed by Master Superadmin' : 'Delegated Admin Scope'}
              </span>
            </div>

            {(!currentTenant?.focalAdminEmails || currentTenant.focalAdminEmails.length === 0) ? (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 space-y-2">
                <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-700">No designated company focal admin assigned yet</div>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  Only the Master System Super Administrator can manage and assign focal administrators for each tenant organization.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentTenant.focalAdminEmails.map((email, idx) => {
                  const isCurrentAdmin = email.toLowerCase() === adminEmail.toLowerCase();
                  return (
                    <div
                      key={email}
                      className={`p-4 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                        isCurrentAdmin 
                          ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-300/50'
                          : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                          {email.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                            <span>{email}</span>
                            {isCurrentAdmin && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-600 text-white font-semibold">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Authorized Focal Admin &bull; {currentTenant.code}</span>
                          </div>
                        </div>
                      </div>

                      {isMasterAdmin && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFocalAdmin(email)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                          title="Revoke Admin Access"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 1: APPROVED USERS WHITELIST */}
      {subTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Add User Form */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5 font-sans">
                  <UserPlus className="w-4 h-4 text-indigo-600" />
                  Authorize User Account
                </span>
                <button
                  type="button"
                  onClick={() => setShowBulkModal(true)}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                >
                  <UploadCloud className="w-3 h-3" /> Bulk Import
                </button>
              </div>

              <form onSubmit={handleAddUserSubmit} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                    User Corporate Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                      Full Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                      Dept / Team (Optional)
                    </label>
                    <input
                      type="text"
                      value={newDept}
                      onChange={(e) => setNewDept(e.target.value)}
                      placeholder="Engineering"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAddingUser}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider py-2.5 rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Grant Booking Access</span>
                </button>
              </form>

              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 text-[11px] text-indigo-900 leading-relaxed">
                <span className="font-bold">Super Admin: </span>
                <span className="font-mono text-indigo-700 font-semibold">Master Platform Super Administrator</span>
                <p className="text-[10px] text-indigo-600 mt-0.5">
                  Super Administrator is permanently authorized with full system management permissions.
                </p>
              </div>
            </div>
          </div>

          {/* Whitelist Directory */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Filter approved users..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded-lg shrink-0">
                {filteredUsers.length} Approved
              </span>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2">
                <Users className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">No approved users in list</p>
                <p className="text-[11px] text-slate-400">Add an email on the left or use Bulk Import to grant access.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3 hover:border-slate-300 transition-colors shadow-2xs"
                  >
                    <div className="space-y-0.5 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 truncate">{user.email}</span>
                        {user.department && (
                          <span className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase">
                            {user.department}
                          </span>
                        )}
                      </div>
                      {user.name && (
                        <p className="text-[10px] text-slate-500 truncate">{user.name}</p>
                      )}
                      <p className="text-[9px] text-slate-400 font-mono">
                        Added on {new Date(user.addedAt).toLocaleDateString()} by {user.addedBy}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveApprovedUser(user.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Revoke access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* SUBTAB 2: SECRET ACCESS TOKENS */}
      {subTab === 'keys' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Generate Key Form */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
              <div className="border-b border-slate-200/60 pb-2.5">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5 font-sans">
                  <Key className="w-4 h-4 text-indigo-600" />
                  Generate Secret Access Token
                </span>
                <p className="text-[10px] text-slate-500 font-sans mt-0.5">
                  Issue secure keys for contractors, visitors, or temporary teams.
                </p>
              </div>

              <form onSubmit={handleGenerateKeySubmit} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                    Token Label / Purpose *
                  </label>
                  <input
                    type="text"
                    required
                    value={keyLabel}
                    onChange={(e) => setKeyLabel(e.target.value)}
                    placeholder="e.g. Design Team Q3 or Vendor Pass"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                      Expiry Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={keyExpiresAt}
                      onChange={(e) => setKeyExpiresAt(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                      Max Uses (Blank = Unlimited)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={keyMaxUses}
                      onChange={(e) => setKeyMaxUses(e.target.value)}
                      placeholder="e.g. 10"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isGeneratingKey}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider py-2.5 rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Generate Cryptographic Token</span>
                </button>
              </form>
            </div>
          </div>

          {/* Tokens List */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={keySearch}
                  onChange={(e) => setKeySearch(e.target.value)}
                  placeholder="Filter secret tokens..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded-lg shrink-0">
                {filteredKeys.length} Tokens
              </span>
            </div>

            {filteredKeys.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2">
                <Key className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">No Secret Tokens Generated</p>
                <p className="text-[11px] text-slate-400">Generate a token to provide secure guest or department access.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {filteredKeys.map((key) => (
                  <div
                    key={key.id}
                    className={`bg-white border rounded-xl p-3.5 transition-all shadow-2xs ${
                      key.active ? 'border-slate-200' : 'border-rose-200 bg-rose-50/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-slate-900">{key.label}</span>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-black uppercase ${
                            key.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {key.active ? 'Active' : 'Revoked'}
                          </span>
                        </div>

                        {/* Token value & Copy */}
                        <div className="flex items-center gap-2 pt-1">
                          <code className="bg-slate-100 text-slate-900 font-mono text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-200 select-all">
                            {key.token}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(key.token, key.id)}
                            className="text-indigo-600 hover:text-indigo-800 p-1 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="Copy Token"
                          >
                            {copiedKeyId === key.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>

                        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono pt-1">
                          <span>Uses: {key.usedCount}{key.maxUses ? ` / ${key.maxUses}` : ''}</span>
                          {key.expiresAt && <span>Expires: {key.expiresAt}</span>}
                          <span>Created by {key.createdBy}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onToggleAccessKey(key.id)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                            key.active 
                              ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {key.active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRevokeAccessKey(key.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Token"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-lg w-full space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-slate-800 text-sm tracking-tight uppercase">Bulk Whitelist Upload</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Paste a list of corporate email addresses (separated by commas, semicolons, or newlines).
            </p>

            <textarea
              rows={6}
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="alex@company.com&#10;sarah@company.com&#10;team@partner.org"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkImportSubmit}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-bold uppercase transition-colors shadow-xs cursor-pointer"
              >
                Import Accounts
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
