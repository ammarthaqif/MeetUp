import React, { useState } from 'react';
import { 
  ShieldCheck, Key, UserPlus, Users, Trash2, Copy, Check, 
  Plus, Search, AlertCircle, RefreshCw, UploadCloud, Lock, CheckCircle2 
} from 'lucide-react';
import { ApprovedUser, AccessKey } from '../types';

interface AdminAccessControlProps {
  approvedUsers: ApprovedUser[];
  accessKeys: AccessKey[];
  adminEmail: string;
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
  onAddApprovedUser,
  onBulkAddApprovedUsers,
  onRemoveApprovedUser,
  onGenerateAccessKey,
  onToggleAccessKey,
  onRevokeAccessKey,
}) => {
  const [subTab, setSubTab] = useState<'users' | 'keys'>('users');
  
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
            Access Control & Booking Permissions
          </h3>
          <p className="text-[11px] text-slate-500 font-sans mt-0.5">
            Manage authorized staff whitelist and generate restricted Secret Access Tokens.
          </p>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
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
                <span className="font-mono text-indigo-700 font-semibold">{adminEmail}</span>
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
