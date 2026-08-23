import React, { useState } from 'react';
import { 
  Calendar, Plus, Trash2, Edit3, Upload, Download, Sparkles, 
  Search, Filter, Shield, AlertTriangle, CheckCircle2, X, Check,
  Layers, Globe, Building2, Clock, AlertCircle
} from 'lucide-react';
import { BlockedDate, BlockedDateType, Tenant } from '../types';
import { exportBlockedDatesToIcs, triggerIcsDownload } from '../utils/icsHolidayParser';
import { formatFriendlyDate } from '../utils';

interface AdminHolidaysTabProps {
  blockedDates: BlockedDate[];
  tenants: Tenant[];
  currentTenant: Tenant | null;
  isMasterAdmin: boolean;
  adminEmail: string;
  onOpenIcsImportModal: () => void;
  onSaveBlockedDate: (dateData: BlockedDate) => Promise<void>;
  onDeleteBlockedDate: (id: string) => Promise<void>;
  onToggleBlockedDate: (id: string) => Promise<void>;
  onLoadPresetHolidays: () => Promise<void>;
}

export const AdminHolidaysTab: React.FC<AdminHolidaysTabProps> = ({
  blockedDates,
  tenants,
  currentTenant,
  isMasterAdmin,
  adminEmail,
  onOpenIcsImportModal,
  onSaveBlockedDate,
  onDeleteBlockedDate,
  onToggleBlockedDate,
  onLoadPresetHolidays,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | BlockedDateType>('ALL');
  const [filterScope, setFilterScope] = useState<'ALL' | 'GLOBAL' | 'TENANT'>('ALL');
  
  // Manual Create/Edit state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<BlockedDateType>('public_holiday');
  const [formTenantId, setFormTenantId] = useState<string>(
    isMasterAdmin ? 'ALL' : (currentTenant?.id || 'ALL')
  );
  const [formDescription, setFormDescription] = useState('');
  const [formIsHardBlock, setFormIsHardBlock] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Scoped blocked dates
  const scopedBlockedDates = blockedDates.filter(b => {
    if (isMasterAdmin) return true;
    return b.tenantId === 'ALL' || b.tenantId === currentTenant?.id;
  });

  // Filtered
  const filteredList = scopedBlockedDates.filter(b => {
    // Type filter
    if (filterType !== 'ALL' && b.type !== filterType) return false;

    // Scope filter
    if (filterScope === 'GLOBAL' && b.tenantId !== 'ALL') return false;
    if (filterScope === 'TENANT' && b.tenantId === 'ALL') return false;

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = b.title.toLowerCase().includes(q);
      const matchDate = b.date.includes(q);
      const matchDesc = (b.description || '').toLowerCase().includes(q);
      return matchTitle || matchDate || matchDesc;
    }

    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));

  // KPIs
  const totalCount = scopedBlockedDates.length;
  const publicHolidayCount = scopedBlockedDates.filter(b => b.type === 'public_holiday').length;
  const replacementLeaveCount = scopedBlockedDates.filter(b => b.type === 'replacement_leave').length;
  const closureCount = scopedBlockedDates.filter(b => b.type === 'company_closure' || b.type === 'maintenance').length;

  const handleOpenCreateForm = () => {
    setEditingId(null);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormEndDate('');
    setFormTitle('');
    setFormType('public_holiday');
    setFormTenantId(isMasterAdmin ? 'ALL' : (currentTenant?.id || 'ALL'));
    setFormDescription('');
    setFormIsHardBlock(false);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (item: BlockedDate) => {
    setEditingId(item.id);
    setFormDate(item.date);
    setFormEndDate(item.endDate || '');
    setFormTitle(item.title);
    setFormType(item.type);
    setFormTenantId(item.tenantId);
    setFormDescription(item.description || '');
    setFormIsHardBlock(item.isHardBlock ?? false);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Please enter a title for the holiday or replacement leave.');
      return;
    }
    if (!formDate) {
      setFormError('Please select a valid date.');
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      const record: BlockedDate = {
        id: editingId || `holiday-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        tenantId: formTenantId,
        date: formDate,
        endDate: formEndDate ? formEndDate : undefined,
        title: formTitle.trim(),
        type: formType,
        description: formDescription.trim(),
        isHardBlock: formIsHardBlock,
        importedAt: Date.now(),
        importedBy: adminEmail,
        sourceIcsFilename: editingId ? (blockedDates.find(b => b.id === editingId)?.sourceIcsFilename || 'Manual Entry') : 'Manual Entry',
        active: true,
      };

      await onSaveBlockedDate(record);
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(`Failed to save: ${err.message || 'Error occurred'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportIcs = () => {
    if (scopedBlockedDates.length === 0) return;
    const icsText = exportBlockedDatesToIcs(
      scopedBlockedDates,
      isMasterAdmin ? 'Master Public Holidays & Replacement Leave' : `${currentTenant?.name || 'Company'} Holidays & Leaves`
    );
    triggerIcsDownload(
      icsText, 
      `${(currentTenant?.slug || 'master')}_holidays_and_leave_${new Date().getFullYear()}.ics`
    );
  };

  return (
    <div id="admin-holidays-tab" className="space-y-6">
      
      {/* Top Banner & Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              Total Block Dates
            </div>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {totalCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Active in room booking matrix
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-900/50 border border-indigo-700/50 text-indigo-400 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
              Gazetted Public Holidays
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
              {publicHolidayCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              National & Regional observances
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-900/50 border border-emerald-700/50 text-emerald-400 flex items-center justify-center">
            <span className="text-lg">🌴</span>
          </div>
        </div>

        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-[10px] font-mono font-bold text-violet-400 uppercase tracking-wider">
              Replacement Leaves
            </div>
            <div className="text-2xl font-black text-violet-400 font-mono mt-1">
              {replacementLeaveCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              In lieu & compensatory off-days
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-violet-900/50 border border-violet-700/50 text-violet-400 flex items-center justify-center">
            <span className="text-lg">🏖️</span>
          </div>
        </div>

        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">
              Closures & Maintenance
            </div>
            <div className="text-2xl font-black text-amber-400 font-mono mt-1">
              {closureCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Office shutdowns & facility service
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-900/50 border border-amber-700/50 text-amber-400 flex items-center justify-center">
            <span className="text-lg">🏢</span>
          </div>
        </div>

      </div>

      {/* Main Action Bar */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        <div className="flex items-center gap-2 flex-wrap">
          {/* Primary Import ICS Button */}
          <button
            id="open-ics-import-btn"
            onClick={onOpenIcsImportModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Import .ICS Calendar</span>
          </button>

          {/* Manual Add Button */}
          <button
            onClick={handleOpenCreateForm}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Date Manually</span>
          </button>

          {/* Export to ICS */}
          <button
            onClick={handleExportIcs}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Export full list to .ics calendar format"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .ICS</span>
          </button>

          {/* 1-Click Load 2026 Sample Preset */}
          {scopedBlockedDates.length === 0 && (
            <button
              onClick={onLoadPresetHolidays}
              className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load 2026 Sample Holidays</span>
            </button>
          )}
        </div>

        {/* Search & Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search holiday name or date..."
              className="bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48 sm:w-60"
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Types ({scopedBlockedDates.length})</option>
            <option value="public_holiday">🌴 Public Holidays</option>
            <option value="replacement_leave">🏖️ Replacement Leaves</option>
            <option value="company_closure">🏢 Company Closures</option>
            <option value="maintenance">🛠️ Maintenance</option>
          </select>

          {/* Scope Filter (for master admin) */}
          {isMasterAdmin && (
            <select
              value={filterScope}
              onChange={(e) => setFilterScope(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Scopes</option>
              <option value="GLOBAL">🌐 Global Only</option>
              <option value="TENANT">🏢 Company Specific</option>
            </select>
          )}

        </div>

      </div>

      {/* Manual Create / Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-white font-sans flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                {editingId ? 'Edit Holiday / Block Date' : 'Add Holiday or Replacement Leave'}
              </h4>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-3.5">
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                  Holiday / Leave Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. National Day Replacement Leave"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                    Start Date (ISO) *
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                    End Date (Optional Span)
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                    Classification Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as BlockedDateType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="public_holiday">🌴 Public Holiday</option>
                    <option value="replacement_leave">🏖️ Replacement Leave</option>
                    <option value="company_closure">🏢 Company Closure</option>
                    <option value="maintenance">🛠️ Maintenance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                    Target Scope
                  </label>
                  <select
                    value={formTenantId}
                    onChange={(e) => setFormTenantId(e.target.value)}
                    disabled={!isMasterAdmin}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 cursor-pointer disabled:opacity-60"
                  >
                    {isMasterAdmin && (
                      <option value="ALL">🌐 Global (All Tenants)</option>
                    )}
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>
                        🏢 {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                  Description / Remarks
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Official public holiday observance or replacement leave in lieu of Sunday."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Enforcement */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={formIsHardBlock}
                    onChange={(e) => setFormIsHardBlock(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    <strong className="text-white">Strict Lockout:</strong> Completely disable room bookings on this date (default un-checked allows booking with holiday warning notification).
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all cursor-pointer"
                >
                  {isSaving ? 'Saving...' : editingId ? 'Update Block Date' : 'Save Block Date'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Main Table View */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        {filteredList.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Calendar className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-300">No Blocked Dates or Holidays Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || filterType !== 'ALL' || filterScope !== 'ALL'
                ? 'Try adjusting your search query or filters to find specific holidays.'
                : 'Import an .ics calendar file or load standard 2026 public holidays to mark company off-days.'}
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                onClick={onOpenIcsImportModal}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import .ICS File</span>
              </button>
              <button
                onClick={onLoadPresetHolidays}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Load Sample 2026 Calendar</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-slate-400 font-mono text-[10px] uppercase font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Holiday / Leave Event</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Scope</th>
                  <th className="py-3 px-4">Policy Mode</th>
                  <th className="py-3 px-4">Source / Author</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-850">
                {filteredList.map((item) => {
                  const isGlobal = item.tenantId === 'ALL';
                  const tenantObj = tenants.find(t => t.id === item.tenantId);

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                      
                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-white">
                          {item.date}
                        </div>
                        {item.endDate && item.endDate !== item.date && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            to {item.endDate}
                          </div>
                        )}
                        <div className="text-[10px] text-indigo-300">
                          {formatFriendlyDate(item.date)}
                        </div>
                      </td>

                      {/* Title & Description */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-100 flex items-center gap-1.5">
                          <span>{item.title}</span>
                          {!item.active && (
                            <span className="text-[9px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                              Disabled
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-1 max-w-sm mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.type === 'public_holiday' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-950/70 border border-emerald-800/70 text-emerald-300">
                            <span>🌴</span> Public Holiday
                          </span>
                        )}
                        {item.type === 'replacement_leave' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-violet-950/70 border border-violet-800/70 text-violet-300">
                            <span>🏖️</span> Replacement Leave
                          </span>
                        )}
                        {item.type === 'company_closure' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-950/70 border border-amber-800/70 text-amber-300">
                            <span>🏢</span> Office Closure
                          </span>
                        )}
                        {item.type === 'maintenance' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                            <span>🛠️</span> Maintenance
                          </span>
                        )}
                      </td>

                      {/* Scope Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isGlobal ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-indigo-950 border border-indigo-800/60 text-indigo-300 px-2 py-0.5 rounded">
                            <Globe className="w-3 h-3 text-indigo-400" />
                            <span>Global (All)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            <span>{tenantObj?.name || item.tenantId}</span>
                          </span>
                        )}
                      </td>

                      {/* Policy Mode */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.isHardBlock ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-300 bg-rose-950/80 border border-rose-800/80 px-2 py-0.5 rounded">
                            <Shield className="w-3 h-3" />
                            <span>Strict Lockout</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                            <AlertCircle className="w-3 h-3" />
                            <span>Notify & Warn</span>
                          </span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="py-3 px-4 whitespace-nowrap text-[11px] text-slate-400 font-mono">
                        <div className="truncate max-w-[140px]" title={item.sourceIcsFilename}>
                          {item.sourceIcsFilename || 'Manual'}
                        </div>
                        <div className="text-[9px] text-slate-500">
                          {item.importedBy || 'Admin'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 whitespace-nowrap text-right space-x-1">
                        <button
                          onClick={() => onToggleBlockedDate(item.id)}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            item.active
                              ? 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700'
                              : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                          }`}
                          title={item.active ? 'Disable Block Date' : 'Enable Block Date'}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditForm(item)}
                          className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
                          title="Edit Holiday Date"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteBlockedDate(item.id)}
                          className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-rose-400 hover:text-rose-300 hover:bg-rose-950 transition-colors cursor-pointer"
                          title="Delete Holiday Date"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
