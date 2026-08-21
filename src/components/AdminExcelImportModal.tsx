import React, { useState, useEffect, useRef } from 'react';
import { 
  X, FileSpreadsheet, Upload, Download, CheckCircle2, AlertTriangle, 
  Clock, Calendar, Building2, User, Info, Layers, RefreshCw, 
  Trash2, Edit3, ChevronRight, ArrowRight, Check, Sparkles, Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Office, Room, Booking } from '../types';
import { 
  detectSheetLayout, 
  parseTabularExcelData, 
  parseCalendarGridExcelData, 
  generateSampleCalendarExcel, 
  ParsedBookingCandidate,
  ExcelLayoutMode
} from '../utils/excelBookingImport';
import { formatDateToISO, parseISODate, areTimesOverlapping } from '../utils';

interface AdminExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  offices: Office[];
  rooms: Room[];
  bookings: Booking[];
  currentOfficeId?: string;
  adminEmail: string;
  onImportBookings: (importedBookings: Booking[], logDetails: string) => Promise<void>;
}

export const AdminExcelImportModal: React.FC<AdminExcelImportModalProps> = ({
  isOpen,
  onClose,
  offices,
  rooms,
  bookings,
  currentOfficeId,
  adminEmail,
  onImportBookings,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<{ name: string; rawData: any[][] }[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [layoutMode, setLayoutMode] = useState<'calendar_grid' | 'tabular_list'>('calendar_grid');
  
  // Configuration states
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>(currentOfficeId || offices[0]?.id || '');
  const [baseDate, setBaseDate] = useState<string>(formatDateToISO(new Date()));
  const [defaultHostEmail, setDefaultHostEmail] = useState<string>(adminEmail || 'admin@enterprise.internal');
  const [roomMappings, setRoomMappings] = useState<Record<string, string>>({}); // excelRoomName -> systemRoomId
  
  // Parsed candidates
  const [candidates, setCandidates] = useState<ParsedBookingCandidate[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [skipConflicts, setSkipConflicts] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'valid' | 'conflict'>('all');

  // Inline editing state for a candidate
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; date: string; startTime: string; endTime: string; roomId: string; hostName: string }>({
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    roomId: '',
    hostName: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync selected office if props change
  useEffect(() => {
    if (currentOfficeId && offices.some(o => o.id === currentOfficeId)) {
      setSelectedOfficeId(currentOfficeId);
    } else if (offices.length > 0 && !selectedOfficeId) {
      setSelectedOfficeId(offices[0].id);
    }
  }, [currentOfficeId, offices]);

  if (!isOpen) return null;

  const currentOffice = offices.find(o => o.id === selectedOfficeId) || offices[0];
  const officeRooms = rooms.filter(r => r.officeId === currentOffice?.id);

  // Process workbook from ArrayBuffer or Binary
  const handleProcessWorkbook = (wb: XLSX.WorkBook, name: string) => {
    const loadedSheets: { name: string; rawData: any[][] }[] = [];

    wb.SheetNames.forEach(sheetName => {
      const ws = wb.Sheets[sheetName];
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (data.length > 0) {
        loadedSheets.push({ name: sheetName, rawData: data });
      }
    });

    if (loadedSheets.length === 0) {
      alert('The uploaded Excel file contains no valid sheet data.');
      return;
    }

    setFileName(name);
    setSheets(loadedSheets);
    setSelectedSheetIndex(0);

    // Auto-detect layout of first sheet
    const detected = detectSheetLayout(loadedSheets[0].rawData);
    setLayoutMode(detected);
    setStep(2);
  };

  // Handle File Input Change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        handleProcessWorkbook(workbook, file.name);
      } catch (err: any) {
        console.error(err);
        alert(`Failed to parse Excel file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        handleProcessWorkbook(workbook, file.name);
      } catch (err: any) {
        console.error(err);
        alert(`Failed to parse Excel file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Load Built-in Demo Data for immediate preview
  const handleLoadDemoData = (type: 'calendar_grid' | 'tabular_list') => {
    const blob = generateSampleCalendarExcel(type);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        handleProcessWorkbook(
          workbook, 
          type === 'calendar_grid' ? 'Corporate_Manual_Calendar_Grid.xlsx' : 'Corporate_Bookings_Tabular.xlsx'
        );
        setLayoutMode(type);
      } catch (err: any) {
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(blob);
  };

  // Download Sample Template
  const handleDownloadSample = (type: 'calendar_grid' | 'tabular_list') => {
    const blob = generateSampleCalendarExcel(type);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = type === 'calendar_grid' ? 'Manual_Calendar_Grid_Template.xlsx' : 'Bookings_Tabular_Template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Parse and validate current configuration into candidate bookings
  const handleParseAndReview = () => {
    if (!currentOffice) {
      alert('Please select an Office workspace.');
      return;
    }

    const currentSheet = sheets[selectedSheetIndex];
    if (!currentSheet || currentSheet.rawData.length === 0) {
      alert('Selected sheet contains no readable rows.');
      return;
    }

    let parsedList: ParsedBookingCandidate[] = [];

    if (layoutMode === 'calendar_grid') {
      parsedList = parseCalendarGridExcelData(
        currentSheet.rawData,
        currentSheet.name,
        baseDate,
        currentOffice,
        officeRooms.length > 0 ? officeRooms : rooms,
        bookings,
        defaultHostEmail
      );
    } else {
      parsedList = parseTabularExcelData(
        currentSheet.rawData,
        currentSheet.name,
        currentOffice,
        officeRooms.length > 0 ? officeRooms : rooms,
        bookings,
        defaultHostEmail
      );
    }

    // Apply any custom room mappings configured by user
    parsedList = parsedList.map(cand => {
      if (cand.roomName && roomMappings[cand.roomName]) {
        const mappedRoom = rooms.find(r => r.id === roomMappings[cand.roomName]);
        if (mappedRoom) {
          // Re-evaluate conflict with mapped room
          const conflict = bookings.find(b => 
            b.roomId === mappedRoom.id &&
            b.date === cand.date &&
            areTimesOverlapping(cand.startTime, cand.endTime, b.startTime, b.endTime)
          );

          return {
            ...cand,
            matchedRoomId: mappedRoom.id,
            roomName: mappedRoom.name,
            floor: mappedRoom.floor,
            status: conflict ? 'conflict' : 'valid',
            validationMessage: conflict ? `Conflicts with "${conflict.title}"` : 'Mapped to ' + mappedRoom.name,
            conflictingWith: conflict
          };
        }
      }
      return cand;
    });

    if (parsedList.length === 0) {
      alert('No valid meeting entries found in this sheet with the selected layout mode. Try switching between "Calendar Grid" and "Tabular List", or check the sheet contents.');
      return;
    }

    setCandidates(parsedList);
    // Select all valid items by default
    const validIds = new Set(parsedList.filter(c => c.status === 'valid').map(c => c.id));
    // If no conflicts or user allowed, select all
    setSelectedCandidateIds(new Set(parsedList.map(c => c.id)));
    setStep(3);
  };

  // Candidate selection toggles
  const handleToggleSelectCandidate = (id: string) => {
    setSelectedCandidateIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = (select: boolean) => {
    if (select) {
      const ids = candidates
        .filter(c => filterStatus === 'all' || c.status === filterStatus)
        .map(c => c.id);
      setSelectedCandidateIds(new Set(ids));
    } else {
      setSelectedCandidateIds(new Set());
    }
  };

  const handleDeleteCandidate = (id: string) => {
    setCandidates(prev => prev.filter(c => c.id !== id));
    setSelectedCandidateIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Inline edit candidate
  const handleStartEditCandidate = (cand: ParsedBookingCandidate) => {
    setEditingCandidateId(cand.id);
    setEditForm({
      title: cand.title,
      date: cand.date,
      startTime: cand.startTime,
      endTime: cand.endTime,
      roomId: cand.matchedRoomId || officeRooms[0]?.id || '',
      hostName: cand.hostName
    });
  };

  const handleSaveEditCandidate = () => {
    if (!editingCandidateId) return;

    setCandidates(prev => prev.map(c => {
      if (c.id !== editingCandidateId) return c;

      const targetRoom = rooms.find(r => r.id === editForm.roomId);
      const conflict = bookings.find(b => 
        b.roomId === editForm.roomId &&
        b.date === editForm.date &&
        areTimesOverlapping(editForm.startTime, editForm.endTime, b.startTime, b.endTime)
      );

      return {
        ...c,
        title: editForm.title,
        date: editForm.date,
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        matchedRoomId: editForm.roomId,
        roomName: targetRoom ? targetRoom.name : c.roomName,
        floor: targetRoom?.floor || c.floor,
        hostName: editForm.hostName,
        status: conflict ? 'conflict' : 'valid',
        validationMessage: conflict ? `Conflicts with "${conflict.title}"` : 'Manually edited & verified',
        conflictingWith: conflict
      };
    }));

    setEditingCandidateId(null);
  };

  // Final Execution: Save Bookings
  const handleExecuteImport = async () => {
    const toImport = candidates.filter(c => {
      if (!selectedCandidateIds.has(c.id)) return false;
      if (skipConflicts && c.status === 'conflict') return false;
      return true;
    });

    if (toImport.length === 0) {
      alert('No valid bookings selected to import.');
      return;
    }

    setIsImporting(true);
    try {
      const newBookings: Booking[] = toImport.map((cand, idx) => {
        const room = rooms.find(r => r.id === cand.matchedRoomId) || officeRooms[0] || rooms[0];
        return {
          id: `booking-excel-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          tenantId: currentOffice?.tenantId || '',
          officeId: currentOffice?.id || '',
          roomId: room?.id || cand.matchedRoomId || '',
          floor: room?.floor || cand.floor || 1,
          title: cand.title,
          description: cand.description,
          date: cand.date,
          startTime: cand.startTime,
          endTime: cand.endTime,
          hostName: cand.hostName,
          hostEmail: cand.hostEmail || defaultHostEmail,
          hostUid: `excel-import-${Date.now()}`,
          attendees: cand.attendees,
          createdAt: Date.now()
        };
      });

      const logMsg = `Imported ${newBookings.length} bookings from Excel file "${fileName}" (${layoutMode === 'calendar_grid' ? 'Manual Calendar Matrix' : 'Tabular List'}) into ${currentOffice?.name}.`;
      await onImportBookings(newBookings, logMsg);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`Import failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Unique detected room names from candidates or sheets
  const detectedRoomNamesInFile = Array.from(new Set(
    sheets[selectedSheetIndex]?.rawData?.slice(0, 5).flatMap(row => 
      row.map(c => String(c || '').trim())
    ).filter(name => 
      name.length > 2 && !name.includes(':') && !/^\d+$/.test(name)
    ) || []
  ));

  const totalValidCount = candidates.filter(c => c.status === 'valid').length;
  const totalConflictCount = candidates.filter(c => c.status === 'conflict').length;
  const selectedCount = candidates.filter(c => {
    if (!selectedCandidateIds.has(c.id)) return false;
    if (skipConflicts && c.status === 'conflict') return false;
    return true;
  }).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight font-sans">
                  Import Bookings from Excel Calendar
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-950 text-emerald-300 border border-emerald-800/80 uppercase font-bold">
                  Client Admin Tool
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Supports manual calendar grid layouts, timetable matrices, and standard tabular booking sheets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Step Wizard Badges */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono">
              <span className={`px-2 py-0.5 rounded ${step === 1 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-500'}`}>
                1. Upload
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className={`px-2 py-0.5 rounded ${step === 2 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-500'}`}>
                2. Configure
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className={`px-2 py-0.5 rounded ${step === 3 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-500'}`}>
                3. Validate & Import
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ============================================================ */}
          {/* STEP 1: UPLOAD & PREVIEW SPREADSHEET */}
          {/* ============================================================ */}
          {step === 1 && (
            <div className="space-y-6">
              
              {/* Drag & Drop Box */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-950/30 ring-4 ring-indigo-500/20'
                    : 'border-slate-700 bg-slate-950/40 hover:border-slate-600 hover:bg-slate-900/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
                  <Upload className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-200">
                    Click to browse or drop Excel file here
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md">
                    Accepts <span className="text-slate-300 font-mono">.xlsx</span>, <span className="text-slate-300 font-mono">.xls</span>, and <span className="text-slate-300 font-mono">.csv</span> files with manual calendar schedules or reservation tables.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <span className="text-[11px] bg-slate-800 text-slate-300 px-3 py-1 rounded-full font-mono">
                    Manual Calendar Grids
                  </span>
                  <span className="text-[11px] bg-slate-800 text-slate-300 px-3 py-1 rounded-full font-mono">
                    Weekly Timetables
                  </span>
                  <span className="text-[11px] bg-slate-800 text-slate-300 px-3 py-1 rounded-full font-mono">
                    Tabular Ledgers
                  </span>
                </div>
              </div>

              {/* Sample Templates & Quick Test Bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Sample Download Card */}
                <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold font-mono text-slate-300 uppercase">
                    <Download className="w-4 h-4 text-indigo-400" />
                    <span>Download Ready Excel Templates</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Get pre-structured Excel templates tailored for manual calendar matrices or standard booking ledgers.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleDownloadSample('calendar_grid')}
                      className="bg-slate-900 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Calendar Grid (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadSample('tabular_list')}
                      className="bg-slate-900 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Tabular List (.xlsx)</span>
                    </button>
                  </div>
                </div>

                {/* Instant Try Demo Card */}
                <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold font-mono text-slate-300 uppercase">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Quick Test with Pre-built Data</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Instantly load sample corporate calendar meetings into the parser without uploading an external file.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleLoadDemoData('calendar_grid')}
                      className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/40 text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer font-semibold"
                    >
                      <span>⚡ Load Sample Calendar Matrix</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadDemoData('tabular_list')}
                      className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>⚡ Load Sample Tabular Data</span>
                    </button>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 2: CONFIGURATION & SHEET SELECTION */}
          {/* ============================================================ */}
          {step === 2 && (
            <div className="space-y-6">
              
              {/* File Info Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-850 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 font-mono">{fileName}</h4>
                    <p className="text-[11px] text-slate-400">
                      Found {sheets.length} sheet{sheets.length > 1 ? 's' : ''} in workbook
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setStep(1)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold cursor-pointer self-start sm:self-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Choose Another File</span>
                </button>
              </div>

              {/* Sheet & Layout Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Select Worksheet */}
                <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-2">
                  <label className="block text-xs font-bold font-mono text-slate-300 uppercase tracking-wider">
                    1. Select Worksheet
                  </label>
                  <select
                    value={selectedSheetIndex}
                    onChange={(e) => {
                      const idx = parseInt(e.target.value, 10);
                      setSelectedSheetIndex(idx);
                      const auto = detectSheetLayout(sheets[idx].rawData);
                      setLayoutMode(auto);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    {sheets.map((s, idx) => (
                      <option key={s.name} value={idx}>
                        {s.name} ({s.rawData.length} rows)
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500">
                    If your Excel workbook has multiple tabs (e.g. by week or room), select the sheet to import.
                  </p>
                </div>

                {/* Select Layout Engine */}
                <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-2">
                  <label className="block text-xs font-bold font-mono text-slate-300 uppercase tracking-wider">
                    2. Layout Parsing Engine
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLayoutMode('calendar_grid')}
                      className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        layoutMode === 'calendar_grid'
                          ? 'border-indigo-500 bg-indigo-600/20 text-white shadow-sm'
                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Calendar Grid</span>
                      </div>
                      <span className="text-[9px] text-slate-400 leading-tight">
                        Matrix with Dates/Rooms as columns & Times as rows
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLayoutMode('tabular_list')}
                      className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        layoutMode === 'tabular_list'
                          ? 'border-indigo-500 bg-indigo-600/20 text-white shadow-sm'
                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Tabular List</span>
                      </div>
                      <span className="text-[9px] text-slate-400 leading-tight">
                        Standard rows (Date, Room, Time, Title, Host)
                      </span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Workspace Destination & Date Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Target Office */}
                <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-2">
                  <label className="block text-xs font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Target Office</span>
                  </label>
                  <select
                    value={selectedOfficeId}
                    onChange={(e) => setSelectedOfficeId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    {offices.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.location})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500">
                    {officeRooms.length} rooms available in this office
                  </p>
                </div>

                {/* Base Date (For Relative Weekdays) */}
                <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-2">
                  <label className="block text-xs font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Base Date (Week of)</span>
                  </label>
                  <input
                    type="date"
                    value={baseDate}
                    onChange={(e) => setBaseDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500">
                    Used if calendar grid headers specify relative days (Mon, Tue)
                  </p>
                </div>

                {/* Default Host Email */}
                <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-2">
                  <label className="block text-xs font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Default Host Email</span>
                  </label>
                  <input
                    type="email"
                    value={defaultHostEmail}
                    onChange={(e) => setDefaultHostEmail(e.target.value)}
                    placeholder="admin@enterprise.internal"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500">
                    Assigned when cell does not contain an explicit email
                  </p>
                </div>

              </div>

              {/* Sheet Data Preview Snapshot */}
              <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono text-slate-300 uppercase">
                    Raw Sheet Preview (First 5 Rows)
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {sheets[selectedSheetIndex]?.rawData?.length || 0} total rows
                  </span>
                </div>

                <div className="overflow-x-auto max-h-44 border border-slate-800 rounded-xl bg-slate-950 p-2">
                  <table className="w-full text-left border-collapse text-[10px] font-mono text-slate-300">
                    <tbody>
                      {sheets[selectedSheetIndex]?.rawData?.slice(0, 5).map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-slate-900 hover:bg-slate-900/50">
                          <td className="p-1 text-slate-500 font-bold w-8">{rIdx + 1}</td>
                          {row.slice(0, 8).map((cell: any, cIdx: number) => (
                            <td key={cIdx} className="p-1 truncate max-w-[140px] border-r border-slate-900">
                              {String(cell || '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleParseAndReview}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-950 cursor-pointer"
                >
                  <span>Parse & Verify Calendar Bookings</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 3: REVIEW, VALIDATION & CONFLICT RESOLUTION */}
          {/* ============================================================ */}
          {step === 3 && (
            <div className="space-y-5">
              
              {/* Metrics & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-850 border border-slate-800">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 border border-slate-750 text-xs font-mono">
                    <span className="text-slate-400">Parsed:</span>
                    <strong className="text-white">{candidates.length}</strong>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-950/80 border border-emerald-800 text-xs font-mono text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Ready: <strong>{totalValidCount}</strong></span>
                  </div>
                  {totalConflictCount > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-950/80 border border-amber-800 text-xs font-mono text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Conflicts: <strong>{totalConflictCount}</strong></span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Conflict policy toggle */}
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={skipConflicts}
                      onChange={(e) => setSkipConflicts(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Skip conflicting slots automatically</span>
                  </label>

                  {/* Filter tabs */}
                  <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setFilterStatus('all')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                        filterStatus === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      All ({candidates.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterStatus('valid')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                        filterStatus === 'valid' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Ready ({totalValidCount})
                    </button>
                    {totalConflictCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterStatus('conflict')}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                          filterStatus === 'conflict' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Conflicts ({totalConflictCount})
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Selection Bar */}
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectAll(true)}
                    className="text-indigo-400 hover:underline cursor-pointer font-mono text-[11px]"
                  >
                    Select All
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(false)}
                    className="text-slate-400 hover:underline cursor-pointer font-mono text-[11px]"
                  >
                    Deselect All
                  </button>
                </div>
                <span className="font-mono text-[11px]">
                  <strong>{selectedCount}</strong> items selected for import
                </span>
              </div>

              {/* Candidate Bookings Table */}
              <div className="border border-slate-800 rounded-2xl bg-slate-900/60 overflow-hidden">
                <div className="max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 font-mono text-[10px] uppercase text-slate-400 z-10">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={selectedCount > 0 && selectedCount === candidates.length}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                          />
                        </th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Time Slot</th>
                        <th className="p-3">Meeting Title</th>
                        <th className="p-3">Target Room</th>
                        <th className="p-3">Host / Organizer</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {candidates
                        .filter(c => filterStatus === 'all' || c.status === filterStatus)
                        .map(cand => {
                          const isSelected = selectedCandidateIds.has(cand.id);
                          const isEditingThis = editingCandidateId === cand.id;

                          return (
                            <tr 
                              key={cand.id} 
                              className={`transition-colors ${
                                cand.status === 'conflict'
                                  ? 'bg-amber-950/15 hover:bg-amber-950/25'
                                  : 'hover:bg-slate-850/60'
                              } ${!isSelected ? 'opacity-60' : ''}`}
                            >
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectCandidate(cand.id)}
                                  className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                                />
                              </td>

                              <td className="p-3 whitespace-nowrap">
                                {cand.status === 'valid' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                                    <Check className="w-3 h-3" />
                                    Ready
                                  </span>
                                ) : (
                                  <span 
                                    className="inline-flex items-center gap-1 text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono font-bold"
                                    title={cand.validationMessage}
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                    Conflict
                                  </span>
                                )}
                              </td>

                              <td className="p-3 font-mono text-slate-300 whitespace-nowrap">
                                {cand.date}
                              </td>

                              <td className="p-3 font-mono text-amber-400 whitespace-nowrap">
                                {cand.startTime} - {cand.endTime}
                              </td>

                              <td className="p-3">
                                <div className="font-bold text-slate-200">{cand.title}</div>
                                {cand.description && (
                                  <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                                    {cand.description}
                                  </div>
                                )}
                              </td>

                              <td className="p-3">
                                <span className="font-semibold text-indigo-300">{cand.roomName}</span>
                                <span className="text-slate-500 ml-1 font-mono text-[10px]">(Lvl {cand.floor})</span>
                              </td>

                              <td className="p-3">
                                <div className="text-slate-200">{cand.hostName}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{cand.hostEmail}</div>
                              </td>

                              <td className="p-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditCandidate(cand)}
                                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                                    title="Edit slot before import"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCandidate(cand.id)}
                                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                    title="Remove from import"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Inline Edit Modal if user clicks edit on a candidate */}
              {editingCandidateId && (
                <div className="p-4 rounded-2xl bg-slate-850 border border-indigo-500/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 font-mono flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Candidate Reservation Details
                    </span>
                    <button
                      onClick={() => setEditingCandidateId(null)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">Title</label>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">Date</label>
                      <input
                        type="date"
                        value={editForm.date}
                        onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">Target Room</label>
                      <select
                        value={editForm.roomId}
                        onChange={(e) => setEditForm(prev => ({ ...prev, roomId: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-100"
                      >
                        {officeRooms.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.name} (Lvl {r.floor})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={editForm.startTime}
                        onChange={(e) => setEditForm(prev => ({ ...prev, startTime: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">End Time</label>
                      <input
                        type="time"
                        value={editForm.endTime}
                        onChange={(e) => setEditForm(prev => ({ ...prev, endTime: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">Host Name</label>
                      <input
                        type="text"
                        value={editForm.hostName}
                        onChange={(e) => setEditForm(prev => ({ ...prev, hostName: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingCandidateId(null)}
                      className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEditCandidate}
                      className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                    >
                      Apply & Re-validate
                    </button>
                  </div>
                </div>
              )}

              {/* Final Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Back to Config
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-slate-400 hover:text-white text-xs px-3 py-2 cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={isImporting || selectedCount === 0}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-950 cursor-pointer"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Importing {selectedCount} Bookings...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Commit & Import {selectedCount} Reservations</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
