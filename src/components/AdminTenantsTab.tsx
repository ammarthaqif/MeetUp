import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  KeyRound, 
  Sparkles, 
  Layers, 
  ShieldCheck, 
  Check, 
  Edit3, 
  Trash2, 
  ExternalLink,
  Users,
  CheckCircle2,
  Calendar,
  UserCheck,
  UserPlus,
  X,
  Shield
} from 'lucide-react';
import { Tenant, AccessKey, Office, Room, Booking, TenantPlan } from '../types';

interface AdminTenantsTabProps {
  tenants: Tenant[];
  currentTenant: Tenant | null;
  accessKeys: AccessKey[];
  offices: Office[];
  rooms: Room[];
  bookings: Booking[];
  onSaveTenant: (tenantData: Tenant) => void;
  onDeleteTenant: (tenantId: string) => void;
  onGenerateTenantToken: (tenantId: string, label: string, role: 'company_admin' | 'staff' | 'guest') => Promise<AccessKey>;
  onSwitchTenant: (tenant: Tenant, token?: string) => void;
}

export const AdminTenantsTab: React.FC<AdminTenantsTabProps> = ({
  tenants,
  currentTenant,
  accessKeys,
  offices,
  rooms,
  bookings,
  onSaveTenant,
  onDeleteTenant,
  onGenerateTenantToken,
  onSwitchTenant,
}) => {
  const [isAddingTenant, setIsAddingTenant] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [logoBadge, setLogoBadge] = useState('');
  const [themeColor, setThemeColor] = useState<'indigo' | 'emerald' | 'violet' | 'cyan' | 'amber' | 'rose'>('indigo');
  const [planTier, setPlanTier] = useState<TenantPlan>('Enterprise');
  const [focalEmails, setFocalEmails] = useState<string[]>([]);
  const [focalInput, setFocalInput] = useState('');

  // Inline focal assign state per card
  const [assigningFocalTenantId, setAssigningFocalTenantId] = useState<string | null>(null);
  const [quickFocalInput, setQuickFocalInput] = useState('');

  // Quick Token Generation State
  const [tokenGenTenantId, setTokenGenTenantId] = useState<string | null>(null);
  const [newTokenLabel, setNewTokenLabel] = useState('Executive Staff Token');
  const [newTokenRole, setNewTokenRole] = useState<'company_admin' | 'staff' | 'guest'>('staff');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingTenant(null);
    setName('');
    setCode('');
    setDescription('');
    setDomain('');
    setContactEmail('');
    setLogoBadge('');
    setThemeColor('indigo');
    setPlanTier('Enterprise');
    setFocalEmails([]);
    setFocalInput('');
    setIsAddingTenant(true);
  };

  const handleOpenEdit = (t: Tenant) => {
    setEditingTenant(t);
    setName(t.name);
    setCode(t.code);
    setDescription(t.description);
    setDomain(t.domain || '');
    setContactEmail(t.contactEmail);
    setLogoBadge(t.logoBadge);
    setThemeColor(t.themeColor as any);
    setPlanTier(t.planTier);
    setFocalEmails(t.focalAdminEmails ? [...t.focalAdminEmails] : []);
    setFocalInput('');
    setIsAddingTenant(true);
  };

  const handleAddFocalChip = () => {
    const raw = focalInput.trim().toLowerCase();
    if (!raw) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const parts = raw.split(/[\s,;]+/).filter(Boolean);
    const validToAdd = parts.filter(p => emailRegex.test(p) && !focalEmails.includes(p));
    if (validToAdd.length > 0) {
      setFocalEmails(prev => [...prev, ...validToAdd]);
      setFocalInput('');
    }
  };

  const handleRemoveFocalChip = (emailToRemove: string) => {
    setFocalEmails(prev => prev.filter(e => e !== emailToRemove));
  };

  const handleQuickAddFocal = (tenant: Tenant) => {
    const raw = quickFocalInput.trim().toLowerCase();
    if (!raw) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(raw)) {
      alert('Please enter a valid focal email address.');
      return;
    }
    const currentFocals = tenant.focalAdminEmails ? [...tenant.focalAdminEmails] : [];
    if (currentFocals.includes(raw)) {
      alert('This focal admin email is already assigned.');
      return;
    }
    const updatedTenant: Tenant = {
      ...tenant,
      focalAdminEmails: [...currentFocals, raw]
    };
    onSaveTenant(updatedTenant);
    setQuickFocalInput('');
    setAssigningFocalTenantId(null);
  };

  const handleQuickRemoveFocal = (tenant: Tenant, emailToRemove: string) => {
    if (window.confirm(`Revoke company admin role for "${emailToRemove}"?`)) {
      const currentFocals = tenant.focalAdminEmails ? [...tenant.focalAdminEmails] : [];
      const updatedTenant: Tenant = {
        ...tenant,
        focalAdminEmails: currentFocals.filter(e => e !== emailToRemove)
      };
      onSaveTenant(updatedTenant);
    }
  };

  const handleSubmitTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const badge = logoBadge.trim() || name.substring(0, 2).toUpperCase();
    const finalCode = code.trim().toUpperCase() || name.substring(0, 4).toUpperCase();

    // In case there is an unsubmitted input in focalInput, add it if valid
    let finalFocals = [...focalEmails];
    if (focalInput.trim()) {
      const parts = focalInput.trim().toLowerCase().split(/[\s,;]+/).filter(Boolean);
      parts.forEach(p => {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p) && !finalFocals.includes(p)) {
          finalFocals.push(p);
        }
      });
    }

    const tenantPayload: Tenant = {
      id: editingTenant ? editingTenant.id : `tenant-${Date.now()}`,
      name: name.trim(),
      slug,
      code: finalCode,
      description: description.trim() || 'Corporate workspace tenant.',
      domain: domain.trim() || undefined,
      contactEmail: contactEmail.trim() || 'admin@workspace.com',
      focalAdminEmails: finalFocals,
      logoBadge: badge,
      themeColor,
      planTier,
      createdAt: editingTenant ? editingTenant.createdAt : Date.now(),
      active: editingTenant ? editingTenant.active : true,
    };

    onSaveTenant(tenantPayload);
    setIsAddingTenant(false);
    setEditingTenant(null);
  };

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-950/60 border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Building2 className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Corporate Tenant Directory & Multi-Tenancy Architecture
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Manage isolated company organizations, issue company-scoped access tokens, and switch tenant workspaces.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Provision New Tenant
        </button>
      </div>

      {/* Tenant Form Modal/Card */}
      {isAddingTenant && (
        <form onSubmit={handleSubmitTenant} className="p-6 rounded-3xl bg-slate-900 border border-indigo-500/40 shadow-2xl space-y-5 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              {editingTenant ? `Edit Tenant: ${editingTenant.name}` : 'Provision New Corporate Organization'}
            </h4>
            <button
              type="button"
              onClick={() => setIsAddingTenant(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Company / Tenant Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Horizon Therapeutics"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tenant Code / Prefix</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. HORIZON"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-mono text-white uppercase"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Industry / Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Biotechnology, Genomics, and Clinical Trial Labs"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Corporate Domain</label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. horizonrx.com"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Email</label>
              <input
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="e.g. facilities@horizonrx.com"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Theme Accent Color</label>
              <select
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white"
              >
                <option value="indigo">Indigo Blue (Corporate)</option>
                <option value="emerald">Emerald Green (Fintech)</option>
                <option value="violet">Violet Purple (Creative)</option>
                <option value="cyan">Cyan Teal (AI & Tech)</option>
                <option value="amber">Amber Gold (Consulting)</option>
                <option value="rose">Rose Red (Media)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Subscription Plan</label>
              <select
                value={planTier}
                onChange={(e) => setPlanTier(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white"
              >
                <option value="Enterprise">Enterprise (Unlimited Rooms & Multi-Campuses)</option>
                <option value="Business Pro">Business Pro (Up to 10 Offices)</option>
                <option value="Standard">Standard (Single Office)</option>
              </select>
            </div>

            {/* Company Focal Administrators Assignment Section */}
            <div className="sm:col-span-2 p-4 rounded-2xl bg-slate-950/80 border border-indigo-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Company Focal Administrators (Admin Role)
                  </span>
                </div>
                <span className="text-[10px] text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full font-mono">
                  {focalEmails.length} Assigned
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Authorized corporate focal emails assigned below automatically receive full Administrator access for this company's dashboard, rooms, offices, and whitelist.
              </p>

              {/* Tag Chips */}
              <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-xl bg-slate-900 border border-slate-800">
                {focalEmails.length === 0 ? (
                  <span className="text-[11px] text-slate-500 italic py-0.5">No focal admins added yet. Type an email below to assign.</span>
                ) : (
                  focalEmails.map(email => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 text-xs font-mono font-medium"
                    >
                      <UserCheck className="w-3 h-3 text-indigo-400" />
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFocalChip(email)}
                        className="hover:text-rose-300 hover:bg-rose-500/20 rounded p-0.5 transition-colors cursor-pointer"
                        title="Remove Admin Role"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Add Input */}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={focalInput}
                  onChange={(e) => setFocalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddFocalChip();
                    }
                  }}
                  placeholder="e.g. focal.admin@company.com"
                  className="flex-1 bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleAddFocalChip}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Assign Admin</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddingTenant(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              {editingTenant ? 'Save Changes' : 'Create Organization'}
            </button>
          </div>
        </form>
      )}

      {/* Tenants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tenants.map((t) => {
          const isCurrent = currentTenant?.id === t.id;
          const tenantOffices = offices.filter(o => o.tenantId === t.id);
          const tenantRooms = rooms.filter(r => r.tenantId === t.id);
          const tenantBookings = bookings.filter(b => b.tenantId === t.id);
          const tenantTokens = accessKeys.filter(k => k.tenantId === t.id);

          return (
            <div
              key={t.id}
              className={`p-5 rounded-3xl border transition-all space-y-4 flex flex-col justify-between ${
                isCurrent 
                  ? 'bg-slate-900/90 border-indigo-500/60 ring-1 ring-indigo-500/30 shadow-xl' 
                  : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shadow-md ${
                      t.themeColor === 'emerald' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      t.themeColor === 'violet' ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' :
                      t.themeColor === 'cyan' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                      'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    }`}>
                      {t.logoBadge}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        {t.name}
                        {isCurrent && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                            Active Tenant
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        {t.code} &bull; {t.domain || 'private domain'} &bull; {t.planTier}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(t)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Edit Tenant"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete tenant "${t.name}" and all associated data?`)) {
                          onDeleteTenant(t.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete Tenant"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                  {t.description}
                </p>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-center">
                  <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="text-xs font-bold text-white">{tenantOffices.length}</div>
                    <div className="text-[10px] text-slate-500">Offices</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="text-xs font-bold text-white">{tenantRooms.length}</div>
                    <div className="text-[10px] text-slate-500">Rooms</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="text-xs font-bold text-white">{tenantBookings.length}</div>
                    <div className="text-[10px] text-slate-500">Bookings</div>
                  </div>
                </div>

                {/* Company Focal Administrators Section */}
                <div className="mt-4 p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Company Focal Admins ({(t.focalAdminEmails || []).length})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAssigningFocalTenantId(assigningFocalTenantId === t.id ? null : t.id)}
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>{assigningFocalTenantId === t.id ? 'cancel' : '+ assign admin'}</span>
                    </button>
                  </div>

                  {/* Quick Inline Assign */}
                  {assigningFocalTenantId === t.id && (
                    <div className="flex gap-1.5 p-2 rounded-xl bg-slate-900 border border-indigo-500/30 animate-fadeIn">
                      <input
                        type="email"
                        value={quickFocalInput}
                        onChange={(e) => setQuickFocalInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleQuickAddFocal(t);
                          }
                        }}
                        placeholder="focal.user@company.com"
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleQuickAddFocal(t)}
                        className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer shrink-0"
                      >
                        Grant
                      </button>
                    </div>
                  )}

                  {/* Focal Admin Badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {(!t.focalAdminEmails || t.focalAdminEmails.length === 0) ? (
                      <span className="text-[10px] text-slate-500 italic py-0.5">
                        No focal admin assigned. (Superadmin only)
                      </span>
                    ) : (
                      t.focalAdminEmails.map(email => (
                        <div
                          key={email}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-indigo-200 text-[11px] font-mono"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="truncate max-w-[180px]">{email}</span>
                          <button
                            type="button"
                            onClick={() => handleQuickRemoveFocal(t, email)}
                            className="text-slate-400 hover:text-rose-300 p-0.5 rounded transition-colors cursor-pointer"
                            title="Revoke Admin Role"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Tokens List */}
                <div className="mt-4 space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Company Access Keys ({tenantTokens.length})</span>
                    <button
                      onClick={() => setTokenGenTenantId(tokenGenTenantId === t.id ? null : t.id)}
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer lowercase"
                    >
                      <Plus className="w-3 h-3" />
                      <span>issue key</span>
                    </button>
                  </div>

                  {/* Token Generator inline */}
                  {tokenGenTenantId === t.id && (
                    <div className="p-3 rounded-xl bg-slate-900 border border-indigo-500/30 space-y-2 animate-fadeIn">
                      <div className="text-[11px] font-bold text-white">Generate Tenant Access Key</div>
                      <input
                        type="text"
                        value={newTokenLabel}
                        onChange={(e) => setNewTokenLabel(e.target.value)}
                        placeholder="Key label (e.g. Sales Team Key)"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white"
                      />
                      <div className="flex items-center justify-between">
                        <select
                          value={newTokenRole}
                          onChange={(e) => setNewTokenRole(e.target.value as any)}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-white"
                        >
                          <option value="staff">Staff Role</option>
                          <option value="company_admin">Admin Role</option>
                          <option value="guest">Guest Role</option>
                        </select>

                        <button
                          onClick={async () => {
                            if (!newTokenLabel.trim()) return;
                            await onGenerateTenantToken(t.id, newTokenLabel.trim(), newTokenRole);
                            setTokenGenTenantId(null);
                            setNewTokenLabel('Executive Staff Token');
                          }}
                          className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 cursor-pointer"
                        >
                          Create Token
                        </button>
                      </div>
                    </div>
                  )}

                  {tenantTokens.map(k => (
                    <div
                      key={k.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-900/50 border border-slate-800/60 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                        <div>
                          <span className="font-mono text-slate-200">{k.token}</span>
                          <span className="text-[10px] text-slate-500 ml-2">({k.label})</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCopy(k.token)}
                        className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Copy Token"
                      >
                        {copiedToken === k.token ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <span className="text-[10px] text-indigo-400 font-semibold">Copy</span>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Action */}
              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Created {new Date(t.createdAt).toLocaleDateString()}
                </span>

                <button
                  onClick={() => {
                    const primaryKey = tenantTokens[0]?.token;
                    onSwitchTenant(t, primaryKey);
                  }}
                  disabled={isCurrent}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isCurrent
                      ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/30 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{isCurrent ? 'Current Tenant' : 'Switch Into Workspace'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
