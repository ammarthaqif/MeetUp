import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  KeyRound, 
  Key,
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
  Shield,
  CreditCard,
  Receipt,
  Mail,
  Copy,
  DollarSign,
  Briefcase,
  CheckCircle,
  MapPin,
  Clock,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Tenant, AccessKey, Office, Room, Booking, TenantPlan, SubscriptionStatus } from '../types';

interface AdminTenantsTabProps {
  tenants: Tenant[];
  currentTenant: Tenant | null;
  accessKeys: AccessKey[];
  offices: Office[];
  rooms: Room[];
  bookings: Booking[];
  onSaveTenant: (
    tenantData: Tenant, 
    extraConfig?: { 
      initialOffice?: { name: string; location: string; passkey: string; floors: number[] }; 
      initialAdminToken?: string;
      adminTokenRole?: 'company_admin'; 
    }
  ) => void;
  onDeleteTenant: (tenantId: string) => void;
  onGenerateTenantToken: (tenantId: string, label: string, role: 'company_admin' | 'staff' | 'guest') => Promise<AccessKey>;
  onRegenerateAccessKey?: (keyId: string, options?: { newLabel?: string; newExpiresAt?: string; resetUses?: boolean; customToken?: string; role?: any }) => Promise<AccessKey>;
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
  onRegenerateAccessKey,
  onSwitchTenant,
}) => {
  const [isAddingTenant, setIsAddingTenant] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);

  // Form State: Company Information
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [logoBadge, setLogoBadge] = useState('');
  const [themeColor, setThemeColor] = useState<'indigo' | 'emerald' | 'violet' | 'cyan' | 'amber' | 'rose'>('indigo');
  const [planTier, setPlanTier] = useState<TenantPlan>('Enterprise');

  // Form State: Paid Subscription & Billing Details
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('active');
  const [subscriptionAmount, setSubscriptionAmount] = useState('$499 / month');
  const [billingReference, setBillingReference] = useState('');
  const [renewalDate, setRenewalDate] = useState('');

  // Form State: Primary Assigned Tenant Administrator
  const [assignedAdminName, setAssignedAdminName] = useState('');
  const [assignedAdminEmail, setAssignedAdminEmail] = useState('');
  const [assignedAdminDepartment, setAssignedAdminDepartment] = useState('Workplace & Facilities Operations');

  // Form State: Additional Focal Admin Whitelist
  const [focalEmails, setFocalEmails] = useState<string[]>([]);
  const [focalInput, setFocalInput] = useState('');

  // Form State: Optional Initial Office Building Setup
  const [createInitialOffice, setCreateInitialOffice] = useState(true);
  const [initialOfficeName, setInitialOfficeName] = useState('');
  const [initialOfficeLocation, setInitialOfficeLocation] = useState('');
  const [initialOfficePasskey, setInitialOfficePasskey] = useState('');
  const [initialOfficeFloors, setInitialOfficeFloors] = useState('1, 2, 3, 4');

  // Inline focal assign state per card
  const [assigningFocalTenantId, setAssigningFocalTenantId] = useState<string | null>(null);
  const [quickFocalInput, setQuickFocalInput] = useState('');

  // Quick Token Generation State
  const [tokenGenTenantId, setTokenGenTenantId] = useState<string | null>(null);
  const [newTokenLabel, setNewTokenLabel] = useState('Executive Staff Token');
  const [newTokenRole, setNewTokenRole] = useState<'company_admin' | 'staff' | 'guest'>('staff');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [regeneratingKeyId, setRegeneratingKeyId] = useState<string | null>(null);
  const [regenSuccessModal, setRegenSuccessModal] = useState<{ key: AccessKey; tenantName: string } | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const handleRegenerateTenantKey = async (key: AccessKey, tenant: Tenant) => {
    if (!onRegenerateAccessKey) return;
    setRegeneratingKeyId(key.id);
    try {
      const updated = await onRegenerateAccessKey(key.id, {
        resetUses: true,
        role: key.role || 'staff'
      });
      setRegenSuccessModal({
        key: updated,
        tenantName: tenant.name
      });
    } catch {
      alert('Failed to regenerate access key.');
    } finally {
      setRegeneratingKeyId(null);
    }
  };

  // Welcome Kit Modal State
  const [welcomePackage, setWelcomePackage] = useState<{
    tenant: Tenant;
    adminEmail: string;
    adminName: string;
    token: string;
    officePasskey?: string;
  } | null>(null);

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
    
    // Billing defaults
    setSubscriptionStatus('active');
    setSubscriptionAmount('$499 / month');
    const randomInv = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    setBillingReference(randomInv);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setRenewalDate(nextYear.toISOString().split('T')[0]);

    // Admin defaults
    setAssignedAdminName('');
    setAssignedAdminEmail('');
    setAssignedAdminDepartment('Workplace & Facilities Operations');
    setFocalEmails([]);
    setFocalInput('');

    // Office defaults
    setCreateInitialOffice(true);
    setInitialOfficeName('Main Headquarters');
    setInitialOfficeLocation('Level 12, Corporate Tower, Silicon Valley');
    setInitialOfficePasskey('HQ2026');
    setInitialOfficeFloors('1, 2, 3, 4');

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

    setSubscriptionStatus(t.subscriptionStatus || 'active');
    setSubscriptionAmount(t.subscriptionAmount || '$499 / month');
    setBillingReference(t.billingReference || '');
    setRenewalDate(t.renewalDate || '');

    setAssignedAdminName(t.assignedAdminName || '');
    setAssignedAdminEmail(t.assignedAdminEmail || '');
    setAssignedAdminDepartment(t.assignedAdminDepartment || 'Workplace & Facilities Operations');

    setFocalEmails(t.focalAdminEmails ? [...t.focalAdminEmails] : []);
    setFocalInput('');
    setCreateInitialOffice(false);
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

    // Collect all focal admin emails
    let finalFocals = [...focalEmails];
    if (assignedAdminEmail.trim() && !finalFocals.includes(assignedAdminEmail.trim().toLowerCase())) {
      finalFocals.unshift(assignedAdminEmail.trim().toLowerCase());
    }
    if (focalInput.trim()) {
      const parts = focalInput.trim().toLowerCase().split(/[\s,;]+/).filter(Boolean);
      parts.forEach(p => {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p) && !finalFocals.includes(p)) {
          finalFocals.push(p);
        }
      });
    }

    const tenantId = editingTenant ? editingTenant.id : `tenant-${Date.now()}`;

    const tenantPayload: Tenant = {
      id: tenantId,
      name: name.trim(),
      slug,
      code: finalCode,
      description: description.trim() || 'Corporate workspace tenant.',
      domain: domain.trim() || undefined,
      contactEmail: contactEmail.trim() || (assignedAdminEmail.trim() || 'admin@workspace.com'),
      focalAdminEmails: finalFocals,
      logoBadge: badge,
      themeColor,
      planTier,
      subscriptionStatus,
      subscriptionAmount: subscriptionAmount.trim() || '$499 / month',
      billingReference: billingReference.trim() || `INV-${Date.now()}`,
      renewalDate: renewalDate.trim() || undefined,
      assignedAdminName: assignedAdminName.trim() || undefined,
      assignedAdminEmail: assignedAdminEmail.trim() || undefined,
      assignedAdminDepartment: assignedAdminDepartment.trim() || undefined,
      createdAt: editingTenant ? editingTenant.createdAt : Date.now(),
      active: editingTenant ? editingTenant.active : true,
    };

    let extraConfig: any = undefined;
    const generatedAdminToken = `${finalCode}-ADMIN-${Math.floor(1000 + Math.random() * 9000)}`;

    if (!editingTenant) {
      const parsedFloors = createInitialOffice && initialOfficeName.trim()
        ? initialOfficeFloors
            .split(',')
            .map(s => parseInt(s.trim()))
            .filter(n => !isNaN(n))
            .sort((a, b) => a - b)
        : [1, 2, 3, 4];

      extraConfig = {
        initialAdminToken: generatedAdminToken,
        adminTokenRole: 'company_admin',
        ...(createInitialOffice && initialOfficeName.trim() ? {
          initialOffice: {
            name: initialOfficeName.trim(),
            location: initialOfficeLocation.trim() || 'Corporate HQ',
            passkey: initialOfficePasskey.trim() || `${finalCode}2026`,
            floors: parsedFloors.length > 0 ? parsedFloors : [1, 2, 3, 4],
          }
        } : {})
      };
    }

    onSaveTenant(tenantPayload, extraConfig);
    setIsAddingTenant(false);
    setEditingTenant(null);

    // If new tenant, show welcome kit modal
    if (!editingTenant) {
      setWelcomePackage({
        tenant: tenantPayload,
        adminEmail: assignedAdminEmail.trim() || contactEmail.trim() || 'admin@company.com',
        adminName: assignedAdminName.trim() || 'Tenant Administrator',
        token: generatedAdminToken,
        officePasskey: createInitialOffice ? (initialOfficePasskey.trim() || `${finalCode}2026`) : undefined,
      });
    }
  };

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getWelcomeLetterText = () => {
    if (!welcomePackage) return '';
    const { tenant, adminEmail, adminName, token, officePasskey } = welcomePackage;
    return `========================================
CORPORATE WORKSPACE ONBOARDING PACKAGE
========================================
Organization: ${tenant.name} (${tenant.code})
Plan Tier: ${tenant.planTier} (${tenant.subscriptionStatus?.toUpperCase()} - ${tenant.subscriptionAmount})
Billing Reference: ${tenant.billingReference}

ASSIGNED ADMINISTRATOR:
Name: ${adminName}
Email: ${adminEmail}
Role: Tenant Company Administrator

ACCESS CREDENTIALS:
- Company Admin Access Token: ${token}
- Portal URL: ${window.location.origin}${window.location.pathname}
${officePasskey ? `- Initial Office Passkey: ${officePasskey}` : ''}

ADMINISTRATOR CAPABILITIES:
As the designated Company Administrator for ${tenant.name}, you can:
1. Configure your office buildings, locations, and floor levels.
2. Add and customize meeting rooms, capacities, amenities, and floor colors.
3. Whitelist corporate staff emails or issue department access keys.
4. Export reservation audit reports and master booking calendars.

For support, contact Master Platform Administration via the Enterprise Support Portal
========================================`;
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
              Tenant Directory & Paid Client Provisioning
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Super Admin Console: Provision newly subscribed organizations, manage paid subscription billing, and assign company administrators.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Provision Paid Tenant & Admin
        </button>
      </div>

      {/* Tenant Provisioning Form Modal/Card */}
      {isAddingTenant && (
        <form onSubmit={handleSubmitTenant} className="p-6 rounded-3xl bg-slate-900 border border-indigo-500/40 shadow-2xl space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {editingTenant ? `Edit Tenant: ${editingTenant.name}` : 'Provision Newly Subscribed Corporate Tenant'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  Configure client organization details, subscription billing contract, and assigned focal administrator account.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsAddingTenant(false)}
              className="text-xs text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Section 1: Organization Profile */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5" />
              <span>1. Corporate Organization Profile</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Company / Organization Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!editingTenant && !code) {
                      setCode(e.target.value.substring(0, 4).toUpperCase());
                    }
                  }}
                  placeholder="e.g. Starlight BioTech"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tenant Code / Prefix *</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. STARLIGHT"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-mono text-white uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Corporate Domain</label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="e.g. starlightbio.com"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">Industry / Workspace Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Pharmaceutical research, clinical testing laboratories & corporate facilities"
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
                  <option value="indigo">Indigo Blue (Corporate / Enterprise)</option>
                  <option value="emerald">Emerald Green (Fintech / Growth)</option>
                  <option value="violet">Violet Purple (Creative / AI)</option>
                  <option value="cyan">Cyan Teal (Biotech / Tech)</option>
                  <option value="amber">Amber Gold (Consulting / Law)</option>
                  <option value="rose">Rose Red (Media / Retail)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Paid Subscription & Billing Information */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-950/70 border border-emerald-500/30">
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5" />
                <span>2. Paid Subscription & Billing Contract</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono font-bold">
                Paid Status Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Plan Tier</label>
                <select
                  value={planTier}
                  onChange={(e) => setPlanTier(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="Enterprise">Enterprise (Unlimited Rooms & Campuses)</option>
                  <option value="Business Pro">Business Pro (Up to 10 Offices)</option>
                  <option value="Standard">Standard (Single Office)</option>
                  <option value="Custom VIP">Custom VIP Tier</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Subscription Status</label>
                <select
                  value={subscriptionStatus}
                  onChange={(e) => setSubscriptionStatus(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="active">Active (Paid & Verified)</option>
                  <option value="trial">Trial Period</option>
                  <option value="past_due">Past Due</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Subscription Amount / Rate</label>
                <input
                  type="text"
                  value={subscriptionAmount}
                  onChange={(e) => setSubscriptionAmount(e.target.value)}
                  placeholder="e.g. $499 / month"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Invoice / Stripe Reference</label>
                <input
                  type="text"
                  value={billingReference}
                  onChange={(e) => setBillingReference(e.target.value)}
                  placeholder="e.g. INV-2026-0881"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">Next Renewal / Expiration Date</label>
                <input
                  type="date"
                  value={renewalDate}
                  onChange={(e) => setRenewalDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">Billing Contact Email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="e.g. billing@starlightbio.com"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Assigned Tenant Administrator Account */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-950/70 border border-indigo-500/40">
            <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>3. Assign Designated Company Administrator (Admin Role)</span>
              </div>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                Full Office & Room Privileges
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              The assigned administrator will have administrative privileges exclusively under this tenant to manage office locations, floor rooms, passkeys, and employee whitelist.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Admin Full Name</label>
                <input
                  type="text"
                  value={assignedAdminName}
                  onChange={(e) => setAssignedAdminName(e.target.value)}
                  placeholder="e.g. Marcus Vance"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Admin Account Email *</label>
                <input
                  type="email"
                  required
                  value={assignedAdminEmail}
                  onChange={(e) => setAssignedAdminEmail(e.target.value)}
                  placeholder="e.g. marcus.vance@starlightbio.com"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Department / Title</label>
                <input
                  type="text"
                  value={assignedAdminDepartment}
                  onChange={(e) => setAssignedAdminDepartment(e.target.value)}
                  placeholder="e.g. VP of Facilities & Real Estate"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            {/* Additional Focal Whitelist */}
            <div className="pt-2 space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Additional Focal Admin Accounts ({focalEmails.length})
              </label>
              <div className="flex flex-wrap gap-1.5 min-h-[30px] p-2 rounded-xl bg-slate-900 border border-slate-800">
                {focalEmails.length === 0 ? (
                  <span className="text-[11px] text-slate-500 italic py-0.5">No secondary focal admins added. Type an email below if needed.</span>
                ) : (
                  focalEmails.map(email => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 text-xs font-mono"
                    >
                      <UserCheck className="w-3 h-3 text-indigo-400" />
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFocalChip(email)}
                        className="hover:text-rose-300 p-0.5 rounded transition-colors cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

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
                  placeholder="additional.admin@company.com"
                  className="flex-1 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                />
                <button
                  type="button"
                  onClick={handleAddFocalChip}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  + Add Admin
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Initial Office Setup (Only shown when adding new tenant) */}
          {!editingTenant && (
            <div className="space-y-3 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                  <span>4. Initial Office Campus Setup (Optional)</span>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createInitialOffice}
                    onChange={(e) => setCreateInitialOffice(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Create initial office automatically</span>
                </label>
              </div>

              {createInitialOffice && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Office Name</label>
                    <input
                      type="text"
                      value={initialOfficeName}
                      onChange={(e) => setInitialOfficeName(e.target.value)}
                      placeholder="e.g. Main Headquarters"
                      className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Location / Address</label>
                    <input
                      type="text"
                      value={initialOfficeLocation}
                      onChange={(e) => setInitialOfficeLocation(e.target.value)}
                      placeholder="e.g. Level 12, Tower A, Silicon Valley"
                      className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Floor Levels</label>
                    <input
                      type="text"
                      value={initialOfficeFloors}
                      onChange={(e) => setInitialOfficeFloors(e.target.value)}
                      placeholder="e.g. 1, 2, 3, 4"
                      className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddingTenant(false)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 cursor-pointer flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{editingTenant ? 'Save Organization Updates' : 'Complete Provisioning & Issue Admin Credentials'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Post-Provisioning Welcome Kit Modal */}
      {welcomePackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Tenant Successfully Provisioned!
                  </h3>
                  <p className="text-xs text-slate-400">
                    Client welcome package and administrator credentials have been generated.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWelcomePackage(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Overview Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Organization</div>
                <div className="font-bold text-white mt-0.5">{welcomePackage.tenant.name}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Assigned Admin</div>
                <div className="font-bold text-indigo-300 mt-0.5">{welcomePackage.adminName}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Admin Email</div>
                <div className="font-mono text-slate-300 mt-0.5 truncate">{welcomePackage.adminEmail}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Subscription Plan</div>
                <div className="font-bold text-emerald-400 mt-0.5">{welcomePackage.tenant.planTier}</div>
              </div>
            </div>

            {/* Generated Welcome Letter Content */}
            <div className="space-y-2">
              {/* Highlighted Admin Token Box */}
              <div className="p-3.5 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Company Admin Access Token</div>
                    <div className="text-sm font-mono font-bold text-white mt-0.5 select-all">{welcomePackage.token}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(welcomePackage.token);
                      alert(`Copied Admin Token "${welcomePackage.token}" to clipboard!`);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Token Only</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSwitchTenant(welcomePackage.tenant, welcomePackage.token);
                      setWelcomePackage(null);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Switch to this Tenant</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold pt-1">
                <span>Client Welcome Letter & Credentials:</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(getWelcomeLetterText());
                    alert('Copied complete welcome letter to clipboard!');
                  }}
                  className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Complete Letter</span>
                </button>
              </div>
              <textarea
                readOnly
                rows={8}
                value={getWelcomeLetterText()}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-300 leading-relaxed resize-none focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setWelcomePackage(null)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Done & Close Welcome Kit
              </button>
            </div>
          </div>
        </div>
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
              <div className="space-y-4">
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

                {/* Paid Subscription Badge Bar */}
                <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                  <div className="flex items-center gap-1 text-emerald-400 font-bold">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>{t.subscriptionAmount || '$499 / month'}</span>
                  </div>
                  <span className="text-slate-600">&bull;</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase font-bold tracking-wider">
                    {t.subscriptionStatus || 'active'}
                  </span>
                  {t.billingReference && (
                    <>
                      <span className="text-slate-600">&bull;</span>
                      <span className="text-[10px] text-slate-400 font-mono">Ref: {t.billingReference}</span>
                    </>
                  )}
                  {t.renewalDate && (
                    <>
                      <span className="text-slate-600">&bull;</span>
                      <span className="text-[10px] text-slate-400 font-mono">Renews: {t.renewalDate}</span>
                    </>
                  )}
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {t.description}
                </p>

                {/* Assigned Primary Administrator Card */}
                {t.assignedAdminEmail && (
                  <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Assigned Company Admin</span>
                      </div>
                      <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-mono font-bold">
                        Admin Role
                      </span>
                    </div>
                    <div className="font-bold text-white">
                      {t.assignedAdminName || 'Designated Admin'}
                      {t.assignedAdminDepartment && (
                        <span className="text-[10px] text-slate-400 font-normal ml-2">({t.assignedAdminDepartment})</span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-indigo-200">
                      {t.assignedAdminEmail}
                    </div>
                  </div>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
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
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
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
                <div className="space-y-1.5">
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

                  {tenantTokens.map(k => {
                    const isInactive = !k.active;
                    const isExpired = k.expiresAt && k.expiresAt < todayStr;
                    const isExhausted = k.maxUses && k.usedCount >= k.maxUses;
                    const isInvalid = isInactive || isExpired || isExhausted;
                    const isRegenerating = regeneratingKeyId === k.id;

                    return (
                      <div
                        key={k.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl border text-xs gap-2 ${
                          isInvalid
                            ? 'bg-amber-950/20 border-amber-500/30'
                            : 'bg-slate-900/50 border-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <KeyRound className={`w-3.5 h-3.5 shrink-0 ${isInvalid ? 'text-amber-400' : 'text-indigo-400'}`} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`font-mono font-bold ${isInvalid ? 'text-rose-300 line-through' : 'text-slate-200'}`}>
                                {k.token}
                              </span>
                              {isInvalid && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase">
                                  {isInactive ? 'Inactive' : isExpired ? 'Expired' : 'Max Uses'}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              <span>{k.label}</span>
                              <span className="text-slate-600 mx-1">&bull;</span>
                              <span className="uppercase text-indigo-300">{k.role || 'staff'}</span>
                              {k.expiresAt && <span className="text-slate-500 ml-1.5">(Exp: {k.expiresAt})</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                          {/* Super Admin Token Regenerate Action */}
                          {onRegenerateAccessKey && (
                            <button
                              type="button"
                              onClick={() => handleRegenerateTenantKey(k, t)}
                              disabled={isRegenerating}
                              className="px-2 py-1 rounded-md bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-500/30 transition-colors cursor-pointer text-[10px] font-bold flex items-center gap-1 disabled:opacity-50"
                              title="Regenerate & overwrite this token with a fresh valid token"
                            >
                              <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                              <span>{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
                            </button>
                          )}

                          <button
                            type="button"
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
                      </div>
                    );
                  })}
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

      {/* Super Admin Token Regenerated Modal */}
      {regenSuccessModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 max-w-md w-full space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm tracking-tight">Access Token Overwritten</h4>
                  <p className="text-[11px] text-slate-400">{regenSuccessModal.tenantName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRegenSuccessModal(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-center">
              <p className="text-xs text-slate-300">
                The invalid token has been overwritten with a fresh, active token:
              </p>
              <div className="p-3 bg-slate-900 rounded-xl border border-indigo-500/30 flex items-center justify-between gap-2 mt-2">
                <code className="font-mono text-sm font-bold text-indigo-300 select-all">
                  {regenSuccessModal.key.token}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy(regenSuccessModal.key.token)}
                  className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  {copiedToken === regenSuccessModal.key.token ? (
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedToken === regenSuccessModal.key.token ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setRegenSuccessModal(null)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase transition-colors shadow-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
