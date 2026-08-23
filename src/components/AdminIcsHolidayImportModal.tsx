import React, { useState, useRef } from 'react';
import { 
  X, Calendar, Upload, FileText, CheckCircle2, AlertTriangle, 
  Sparkles, ShieldCheck, Download, Trash2, ArrowRight, Layers,
  Info, Filter, Check
} from 'lucide-react';
import { Tenant, BlockedDate, BlockedDateType } from '../types';
import { 
  parseIcsContent, 
  convertParsedEventsToBlockedDates, 
  ParsedIcsEvent,
  SAMPLE_HOLIDAY_ICS_2026,
  triggerIcsDownload
} from '../utils/icsHolidayParser';
import { formatFriendlyDate } from '../utils';

interface AdminIcsHolidayImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenants: Tenant[];
  currentTenant: Tenant | null;
  isMasterAdmin: boolean;
  adminEmail: string;
  onImportBlockedDates: (imported: BlockedDate[], summary: string) => Promise<void>;
}

export const AdminIcsHolidayImportModal: React.FC<AdminIcsHolidayImportModalProps> = ({
  isOpen,
  onClose,
  tenants,
  currentTenant,
  isMasterAdmin,
  adminEmail,
  onImportBlockedDates,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [rawIcsText, setRawIcsText] = useState('');
  const [fileName, setFileName] = useState<string>('');
  const [parsedEvents, setParsedEvents] = useState<ParsedIcsEvent[]>([]);
  const [selectedEventIndices, setSelectedEventIndices] = useState<number[]>([]);
  const [targetTenantId, setTargetTenantId] = useState<string>(
    isMasterAdmin ? 'ALL' : (currentTenant?.id || 'ALL')
  );
  const [isHardBlockAll, setIsHardBlockAll] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | BlockedDateType>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessIcsString = (content: string, name = 'uploaded_calendar.ics') => {
    setErrorMsg(null);
    try {
      const events = parseIcsContent(content);
      if (events.length === 0) {
        setErrorMsg('No valid VEVENT blocks found in the provided .ics calendar file.');
        setParsedEvents([]);
        setSelectedEventIndices([]);
        return;
      }

      setFileName(name);
      setParsedEvents(events);
      setSelectedEventIndices(events.map((_, i) => i));
    } catch (err: any) {
      setErrorMsg(`Failed to parse iCalendar (.ics) file: ${err.message || 'Malformed syntax'}`);
      setParsedEvents([]);
      setSelectedEventIndices([]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawIcsText(text);
      handleProcessIcsString(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setRawIcsText(text);
        handleProcessIcsString(text, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleLoadSampleIcs = () => {
    setRawIcsText(SAMPLE_HOLIDAY_ICS_2026);
    handleProcessIcsString(SAMPLE_HOLIDAY_ICS_2026, '2026_gazetted_public_holidays_leave.ics');
  };

  const handleDownloadSampleIcs = () => {
    triggerIcsDownload(SAMPLE_HOLIDAY_ICS_2026, 'sample_2026_holidays_leave.ics');
  };

  const handleToggleSelectAll = () => {
    if (selectedEventIndices.length === parsedEvents.length) {
      setSelectedEventIndices([]);
    } else {
      setSelectedEventIndices(parsedEvents.map((_, i) => i));
    }
  };

  const handleToggleIndex = (idx: number) => {
    if (selectedEventIndices.includes(idx)) {
      setSelectedEventIndices(selectedEventIndices.filter(i => i !== idx));
    } else {
      setSelectedEventIndices([...selectedEventIndices, idx]);
    }
  };

  const handleUpdateEventType = (idx: number, newType: BlockedDateType) => {
    setParsedEvents(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], type: newType };
      return updated;
    });
  };

  const handleExecuteImport = async () => {
    if (selectedEventIndices.length === 0) {
      setErrorMsg('Please select at least one holiday or replacement leave date to import.');
      return;
    }

    setIsImporting(true);
    setErrorMsg(null);

    try {
      const selectedEvents = parsedEvents.filter((_, idx) => selectedEventIndices.includes(idx));
      const blockedRecords = convertParsedEventsToBlockedDates(selectedEvents, {
        tenantId: targetTenantId,
        importedBy: adminEmail,
        sourceFilename: fileName || 'ics_import.ics',
        isHardBlock: isHardBlockAll,
      });

      const scopeName = targetTenantId === 'ALL' 
        ? 'Global (All Companies & Tenants)' 
        : (tenants.find(t => t.id === targetTenantId)?.name || 'Selected Tenant');

      const summary = `Imported ${blockedRecords.length} holiday/leave dates (${scopeName}) from ${fileName || 'ICS file'}`;
      await onImportBlockedDates(blockedRecords, summary);
      onClose();
    } catch (err: any) {
      setErrorMsg(`Import failed: ${err.message || 'Unknown database error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const filteredEventsWithIdx = parsedEvents
    .map((evt, originalIdx) => ({ evt, originalIdx }))
    .filter(({ evt }) => previewFilter === 'all' || evt.type === previewFilter);

  const targetTenantObj = tenants.find(t => t.id === targetTenantId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 flex items-center justify-between text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-sans font-bold text-base tracking-tight">
                  Import Calendar (.ICS) — Public Holidays & Replacement Leave
                </h3>
                <span className="text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                  RFC 5545
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Upload public holiday schedules or corporate replacement leave calendars to mark block dates on meeting rooms.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Error:</span> {errorMsg}
              </div>
            </div>
          )}

          {/* Step 1: Upload or Paste ICS file */}
          {parsedEvents.length === 0 ? (
            <div className="space-y-4">
              
              {/* Drag & Drop Upload Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                  dragActive 
                    ? 'border-indigo-600 bg-indigo-50/50 scale-[1.01]' 
                    : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ics,.ical,text/calendar"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 font-sans">
                    Click to browse or drag and drop your <span className="text-indigo-600">.ics</span> file here
                  </h4>
                  <p className="text-xs text-slate-500 font-sans mt-1">
                    Supports Google Calendar, Outlook Calendar, Apple iCal, or Government Gazette Public Holiday feeds.
                  </p>
                </div>
              </div>

              {/* Sample / Demo Presets */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Need a sample public holiday & replacement leave calendar?
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Pre-populated with 2026 gazetted public holidays and corporate replacement leaves.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadSampleIcs}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .ics</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadSampleIcs}
                    className="inline-flex items-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>1-Click Load Sample</span>
                  </button>
                </div>
              </div>

              {/* Raw Text Fallback */}
              <div className="pt-2">
                <details className="text-xs text-slate-600 cursor-pointer">
                  <summary className="font-bold text-slate-700 hover:text-indigo-600 transition-colors">
                    Or paste raw iCalendar (BEGIN:VCALENDAR) code text directly
                  </summary>
                  <div className="mt-2 space-y-2">
                    <textarea
                      rows={5}
                      value={rawIcsText}
                      onChange={(e) => setRawIcsText(e.target.value)}
                      placeholder="BEGIN:VCALENDAR&#10;VERSION:2.0&#10;BEGIN:VEVENT&#10;SUMMARY:National Day&#10;DTSTART;VALUE=DATE:20260831&#10;END:VEVENT&#10;END:VCALENDAR"
                      className="w-full bg-slate-900 font-mono text-slate-200 text-xs p-3 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleProcessIcsString(rawIcsText, 'pasted_calendar.ics')}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Parse Pasted .ICS Text
                    </button>
                  </div>
                </details>
              </div>

            </div>
          ) : (

            /* Step 2: Parsed Preview & Scope Configuration */
            <div className="space-y-5">
              
              {/* Configuration Bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                
                {/* Target Scope */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-mono">
                    Target Application Scope
                  </label>
                  <select
                    value={targetTenantId}
                    onChange={(e) => setTargetTenantId(e.target.value)}
                    disabled={!isMasterAdmin}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:bg-slate-100 disabled:opacity-80"
                  >
                    {isMasterAdmin && (
                      <option value="ALL">🌐 Global — Applies to All Companies & Tenants</option>
                    )}
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>
                        🏢 {t.name} ({t.code}) — Company Specific
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {targetTenantId === 'ALL' 
                      ? 'National/State public holidays applicable across all client meeting rooms.'
                      : `Specific replacement leave or company holiday for ${targetTenantObj?.name || 'this client'}.`}
                  </p>
                </div>

                {/* Booking Policy */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-mono">
                    Booking Notification & Enforcement Policy
                  </label>
                  <div className="space-y-1.5 pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                      <input
                        type="radio"
                        name="blockPolicy"
                        checked={!isHardBlockAll}
                        onChange={() => setIsHardBlockAll(false)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>
                        <strong className="text-slate-900">Notify & Warn (Recommended):</strong> Display high-visibility holiday notice on booking attempt.
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                      <input
                        type="radio"
                        name="blockPolicy"
                        checked={isHardBlockAll}
                        onChange={() => setIsHardBlockAll(true)}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span>
                        <strong className="text-rose-900">Strict Lockout:</strong> Completely disable room reservations on these dates.
                      </span>
                    </label>
                  </div>
                </div>

              </div>

              {/* Table Controls & Filter */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    Found {parsedEvents.length} Events in <code className="text-indigo-600 font-mono">{fileName}</code>
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200">
                    {selectedEventIndices.length} Selected
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Filter by Type */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('all')}
                      className={`px-2 py-1 rounded transition-all cursor-pointer ${
                        previewFilter === 'all' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      All ({parsedEvents.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('public_holiday')}
                      className={`px-2 py-1 rounded transition-all cursor-pointer ${
                        previewFilter === 'public_holiday' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      🌴 Public Holidays
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('replacement_leave')}
                      className={`px-2 py-1 rounded transition-all cursor-pointer ${
                        previewFilter === 'replacement_leave' ? 'bg-white text-violet-700 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      🏖️ Replacement Leaves
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="text-[10px] font-bold text-slate-600 hover:text-indigo-600 bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                  >
                    {selectedEventIndices.length === parsedEvents.length ? 'Deselect All' : 'Select All'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setParsedEvents([]);
                      setSelectedEventIndices([]);
                      setFileName('');
                    }}
                    className="text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                  >
                    Clear & Upload Another
                  </button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-600 font-mono text-[10px] uppercase font-bold sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedEventIndices.length === parsedEvents.length && parsedEvents.length > 0}
                          onChange={handleToggleSelectAll}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3">Date (ISO)</th>
                      <th className="py-2.5 px-3">Holiday / Leave Event Title</th>
                      <th className="py-2.5 px-3">Classification Type</th>
                      <th className="py-2.5 px-3">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredEventsWithIdx.map(({ evt, originalIdx }) => {
                      const isChecked = selectedEventIndices.includes(originalIdx);

                      return (
                        <tr 
                          key={originalIdx} 
                          className={`hover:bg-slate-50 transition-colors ${!isChecked ? 'opacity-40 bg-slate-50/40' : ''}`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleIndex(originalIdx)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                            <div>{evt.startDate}</div>
                            {evt.endDate && evt.endDate !== evt.startDate && (
                              <span className="text-[10px] text-slate-400 font-normal">
                                to {evt.endDate}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {evt.title}
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={evt.type}
                              onChange={(e) => handleUpdateEventType(originalIdx, e.target.value as BlockedDateType)}
                              className={`text-[11px] font-bold rounded-lg px-2 py-1 border cursor-pointer focus:outline-none ${
                                evt.type === 'public_holiday' 
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                                  : evt.type === 'replacement_leave' 
                                  ? 'bg-violet-50 text-violet-800 border-violet-200' 
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              <option value="public_holiday">🌴 Public Holiday</option>
                              <option value="replacement_leave">🏖️ Replacement Leave</option>
                              <option value="company_closure">🏢 Company Closure</option>
                              <option value="maintenance">🛠️ Maintenance</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-500 max-w-xs truncate">
                            {evt.description || 'Gazetted calendar event'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {parsedEvents.length > 0 && (
              <span>
                Ready to import <strong className="text-slate-800">{selectedEventIndices.length}</strong> date records to <strong className="text-indigo-600">{targetTenantId === 'ALL' ? 'Global Portal' : targetTenantObj?.name}</strong>.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            {parsedEvents.length > 0 && (
              <button
                type="button"
                disabled={isImporting || selectedEventIndices.length === 0}
                onClick={handleExecuteImport}
                className="px-5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isImporting ? (
                  <span>Importing Calendar...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm Import ({selectedEventIndices.length} Dates)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
