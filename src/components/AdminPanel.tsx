import React, { useState } from 'react';
import { 
  Building2, Plus, Trash2, Edit3, X, HelpCircle, Check, 
  Settings, Users, Shield, MapPin, Key, Layers, ChevronDown, 
  ShieldCheck, History, Download, FileSpreadsheet, FileText,
  Briefcase, Upload, Calendar
} from 'lucide-react';
import { Office, Room, Booking, ApprovedUser, AccessKey, AuditLog, Tenant, BlockedDate } from '../types';
import { AdminAccessControl } from './AdminAccessControl';
import { AdminAuditLogs } from './AdminAuditLogs';
import { AdminTenantsTab } from './AdminTenantsTab';
import { AdminExcelImportModal } from './AdminExcelImportModal';
import { AdminHolidaysTab } from './AdminHolidaysTab';
import { AdminIcsHolidayImportModal } from './AdminIcsHolidayImportModal';
import { timeToMinutes } from '../utils';

interface AdminPanelProps {
  tenants: Tenant[];
  currentTenant: Tenant | null;
  offices: Office[];
  rooms: Room[];
  bookings: Booking[];
  approvedUsers: ApprovedUser[];
  accessKeys: AccessKey[];
  auditLogs: AuditLog[];
  adminEmail: string;
  isMasterAdmin?: boolean;
  blockedDates?: BlockedDate[];
  onSaveTenant?: (
    tenantData: Tenant,
    extraConfig?: {
      initialOffice?: { name: string; location: string; passkey: string; floors: number[] };
      initialAdminToken?: string;
      adminTokenRole?: 'company_admin';
    }
  ) => void;
  onDeleteTenant?: (tenantId: string) => void;
  onGenerateTenantToken?: (tenantId: string, label: string, role: 'company_admin' | 'staff' | 'guest') => Promise<AccessKey>;
  onSwitchTenant?: (tenant: Tenant, token?: string) => void;
  onSaveOffice: (office: Omit<Office, 'createdAt'> & { id?: string }) => Promise<void>;
  onDeleteOffice: (officeId: string) => Promise<void>;
  onSaveRoom: (room: Room) => Promise<void>;
  onDeleteRoom: (roomId: string) => Promise<void>;
  onCancelBooking: (booking: Booking) => Promise<void>;
  onImportBookings?: (importedBookings: Booking[], logDetails: string) => Promise<void>;
  onAddApprovedUser: (email: string, name?: string, department?: string) => Promise<void>;
  onBulkAddApprovedUsers: (emails: string[]) => Promise<number>;
  onRemoveApprovedUser: (userId: string) => Promise<void>;
  onGenerateAccessKey: (data: { label: string; expiresAt?: string; maxUses?: number }) => Promise<AccessKey>;
  onToggleAccessKey: (keyId: string) => Promise<void>;
  onRevokeAccessKey: (keyId: string) => Promise<void>;
  onRegenerateAccessKey?: (keyId: string, options?: { newLabel?: string; newExpiresAt?: string; resetUses?: boolean; customToken?: string; role?: any }) => Promise<AccessKey>;
  onRegenerateAllInvalidKeys?: () => Promise<number>;
  onSaveBlockedDate?: (dateData: BlockedDate) => Promise<void>;
  onDeleteBlockedDate?: (id: string) => Promise<void>;
  onToggleBlockedDate?: (id: string) => Promise<void>;
  onImportIcsHolidays?: (dates: BlockedDate[], details: string) => Promise<void>;
  onLoadPresetHolidays?: () => Promise<void>;
  onClearAuditLogs: () => Promise<void>;
  onExitAdmin: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  tenants,
  currentTenant,
  offices,
  rooms,
  bookings,
  approvedUsers,
  accessKeys,
  auditLogs,
  adminEmail,
  isMasterAdmin = false,
  blockedDates = [],
  onSaveTenant,
  onDeleteTenant,
  onGenerateTenantToken,
  onSwitchTenant,
  onSaveOffice,
  onDeleteOffice,
  onSaveRoom,
  onDeleteRoom,
  onCancelBooking,
  onImportBookings,
  onAddApprovedUser,
  onBulkAddApprovedUsers,
  onRemoveApprovedUser,
  onGenerateAccessKey,
  onToggleAccessKey,
  onRevokeAccessKey,
  onRegenerateAccessKey,
  onRegenerateAllInvalidKeys,
  onSaveBlockedDate,
  onDeleteBlockedDate,
  onToggleBlockedDate,
  onImportIcsHolidays,
  onLoadPresetHolidays,
  onClearAuditLogs,
  onExitAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<'tenants' | 'offices' | 'rooms' | 'bookings' | 'holidays' | 'access' | 'audit'>(
    isMasterAdmin ? 'tenants' : 'offices'
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [isIcsHolidayImportOpen, setIsIcsHolidayImportOpen] = useState(false);


  // Office form states
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);
  const [officeName, setOfficeName] = useState('');
  const [officeLocation, setOfficeLocation] = useState('');
  const [officePasskey, setOfficePasskey] = useState('');
  const [officeFloors, setOfficeFloors] = useState('1, 2, 3, 4');

  // Room form states
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [selectedOfficeId, setSelectedOfficeId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomFloor, setRoomFloor] = useState<number>(1);
  const [roomCapacity, setRoomCapacity] = useState<number>(6);
  const [roomDescription, setRoomDescription] = useState('');
  const [roomColor, setRoomColor] = useState('indigo');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  const AMENITY_PRESETS = [
    'Whiteboard', 'Video Conferencing', 'Dual Monitors', 'Smart TV', 
    'USB-C hub', 'Acoustic Panels', 'Catering Station', 'Air Purifier', 
    'Wireless casting', 'Panoramic View'
  ];

  const COLOR_PRESETS = [
    'indigo', 'emerald', 'sky', 'violet', 'rose', 'amber', 'teal', 'cyan', 'fuchsia', 'purple', 'blue'
  ];

  const triggerNotification = (type: 'success' | 'error', message: string) => {
    if (type === 'success') {
      setSuccessMessage(message);
      setErrorMessage('');
      setTimeout(() => setSuccessMessage(''), 4000);
    } else {
      setErrorMessage(message);
      setSuccessMessage('');
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  // --- OFFICE MANAGEMENT ACTIONS ---
  const handleEditOffice = (office: Office) => {
    setEditingOffice(office);
    setOfficeName(office.name);
    setOfficeLocation(office.location);
    setOfficePasskey(office.passkey);
    setOfficeFloors(office.floors.join(', '));
  };

  const handleResetOfficeForm = () => {
    setEditingOffice(null);
    setOfficeName('');
    setOfficeLocation('');
    setOfficePasskey('');
    setOfficeFloors('1, 2, 3, 4');
  };

  const handleSaveOfficeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officeName.trim() || !officeLocation.trim() || !officePasskey.trim()) {
      triggerNotification('error', 'All fields are required.');
      return;
    }

    // Parse floors
    const parsedFloors = officeFloors
      .split(',')
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);

    if (parsedFloors.length === 0) {
      triggerNotification('error', 'Please provide at least one valid floor number.');
      return;
    }

    try {
      const officeId = editingOffice ? editingOffice.id : `office-${Date.now()}`;
      await onSaveOffice({
        id: officeId,
        name: officeName.trim(),
        location: officeLocation.trim(),
        passkey: officePasskey.trim(),
        floors: parsedFloors,
      });

      triggerNotification('success', `Office "${officeName}" saved successfully.`);
      handleResetOfficeForm();
    } catch (err: any) {
      triggerNotification('error', err.message || 'Failed to save office.');
    }
  };

  const handleDeleteOfficeClick = async (office: Office) => {
    if (!window.confirm(`Are you absolutely sure you want to delete the office "${office.name}"?\nThis will remove all rooms and bookings linked to this office.`)) {
      return;
    }
    try {
      await onDeleteOffice(office.id);
      triggerNotification('success', 'Office deleted successfully.');
    } catch (err: any) {
      triggerNotification('error', err.message || 'Failed to delete office.');
    }
  };

  // --- ROOM MANAGEMENT ACTIONS ---
  const handleEditRoom = (room: Room) => {
    setEditingRoom(room);
    setSelectedOfficeId(room.officeId || '');
    setRoomName(room.name);
    setRoomFloor(room.floor);
    setRoomCapacity(room.capacity);
    setRoomDescription(room.description);
    setRoomColor(room.color);
    setSelectedAmenities(room.amenities);
  };

  const handleResetRoomForm = () => {
    setEditingRoom(null);
    // Keep office selection for convenience
    setRoomName('');
    setRoomFloor(1);
    setRoomCapacity(6);
    setRoomDescription('');
    setRoomColor('indigo');
    setSelectedAmenities([]);
  };

  const handleAmenityCheckboxToggle = (amenity: string) => {
    if (selectedAmenities.includes(amenity)) {
      setSelectedAmenities(selectedAmenities.filter(a => a !== amenity));
    } else {
      setSelectedAmenities([...selectedAmenities, amenity]);
    }
  };

  const handleSaveRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfficeId) {
      triggerNotification('error', 'Please select an office for this room.');
      return;
    }
    if (!roomName.trim()) {
      triggerNotification('error', 'Room name is required.');
      return;
    }

    const office = offices.find(o => o.id === selectedOfficeId);
    if (!office) {
      triggerNotification('error', 'Selected office does not exist.');
      return;
    }

    if (!office.floors.includes(roomFloor)) {
      triggerNotification('error', `Floor ${roomFloor} is not valid for ${office.name}. Available floors: ${office.floors.join(', ')}`);
      return;
    }

    try {
      const roomId = editingRoom ? editingRoom.id : `room-${Date.now()}`;
      await onSaveRoom({
        id: roomId,
        name: roomName.trim(),
        floor: roomFloor,
        capacity: roomCapacity,
        amenities: selectedAmenities,
        description: roomDescription.trim(),
        color: roomColor,
        officeId: selectedOfficeId,
      });

      triggerNotification('success', `Room "${roomName}" saved successfully.`);
      handleResetRoomForm();
    } catch (err: any) {
      triggerNotification('error', err.message || 'Failed to save room.');
    }
  };

  const handleDeleteRoomClick = async (room: Room) => {
    if (!window.confirm(`Are you sure you want to delete the room "${room.name}"?\nThis will remove all existing reservations.`)) {
      return;
    }
    try {
      await onDeleteRoom(room.id);
      triggerNotification('success', 'Room deleted successfully.');
    } catch (err: any) {
      triggerNotification('error', err.message || 'Failed to delete room.');
    }
  };

  // --- CSV REPORT EXPORT FUNCTIONALITY ---
  const handleExportBookingsCSV = () => {
    if (bookings.length === 0) {
      triggerNotification('error', 'No bookings available to export.');
      return;
    }

    const headers = [
      'Booking ID',
      'Office / Building',
      'Room Name',
      'Floor Level',
      'Meeting Title',
      'Date',
      'Start Time',
      'End Time',
      'Duration (mins)',
      'Organizer Name',
      'Organizer Email',
      'Attendees Count',
      'Attendees List',
      'Description',
      'Google Sync',
      'Created Date'
    ];

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = bookings.map(b => {
      const room = rooms.find(r => r.id === b.roomId);
      const office = offices.find(o => o.id === (b.officeId || room?.officeId));
      
      const startM = timeToMinutes(b.startTime);
      const endM = timeToMinutes(b.endTime);
      const duration = endM > startM ? endM - startM : 60;

      return [
        escapeCSV(b.id),
        escapeCSV(office ? office.name : 'Unknown Office'),
        escapeCSV(room ? room.name : 'Unknown Room'),
        escapeCSV(b.floor || room?.floor || 1),
        escapeCSV(b.title),
        escapeCSV(b.date),
        escapeCSV(b.startTime),
        escapeCSV(b.endTime),
        escapeCSV(duration),
        escapeCSV(b.hostName),
        escapeCSV(b.hostEmail),
        escapeCSV(b.attendees ? b.attendees.length : 0),
        escapeCSV(b.attendees ? b.attendees.join('; ') : ''),
        escapeCSV(b.description || ''),
        escapeCSV(b.googleEventId ? 'Yes' : 'No'),
        escapeCSV(b.createdAt ? new Date(b.createdAt).toISOString() : '')
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `corporate_room_bookings_report_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    triggerNotification('success', `Exported ${bookings.length} reservations to CSV successfully.`);
  };

  return (
    <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 shadow-2xl border border-slate-800 space-y-6">
      
      {/* Top Admin Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl text-white ${isMasterAdmin ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold font-sans tracking-tight">
                {isMasterAdmin ? 'Master Superadmin Console' : `${currentTenant?.name || 'Company'} Admin Console`}
              </h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                isMasterAdmin 
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' 
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}>
                {isMasterAdmin ? 'Super User' : 'Company Focal Admin'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              {isMasterAdmin 
                ? 'Master Super Administrator • Global Access' 
                : `Authorized Administrator • Limited to ${currentTenant?.name || 'Company'} Dashboard`}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {isMasterAdmin && (
            <button
              onClick={() => setActiveTab('tenants')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'tenants' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 text-indigo-300" />
              <span>Companies & Tenants</span>
              <span className="text-[10px] bg-slate-900/80 px-1.5 py-0.2 rounded font-mono">{tenants.length}</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('offices')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'offices' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
            }`}
          >
            🏢 Offices Setup
          </button>
          <button
            onClick={() => {
              setActiveTab('rooms');
              if (offices.length > 0 && !selectedOfficeId) {
                setSelectedOfficeId(offices[0].id);
              }
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'rooms' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
            }`}
          >
            🚪 Rooms Config
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'bookings' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
            }`}
          >
            📅 Master Reservations
          </button>
          <button
            onClick={() => setActiveTab('holidays')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'holidays' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
            }`}
          >
            <span>🌴 Holidays & Leaves (.ics)</span>
            <span className="text-[10px] bg-slate-900/80 px-1.5 py-0.2 rounded font-mono text-emerald-300 font-bold">
              {blockedDates.filter(b => b.active && (isMasterAdmin || b.tenantId === 'ALL' || b.tenantId === currentTenant?.id)).length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('access')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'access' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
            }`}
          >
            🛡️ Access Control & Keys
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
            }`}
          >
            📜 Audit History
          </button>
          <button
            onClick={onExitAdmin}
            className="px-3 py-1.5 rounded-xl text-xs bg-rose-950 text-rose-300 border border-rose-900/50 hover:bg-rose-900 transition-all font-bold cursor-pointer"
          >
            Exit Console
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center gap-2">
          <span className="font-bold">Error:</span> {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs rounded-xl flex items-center gap-2">
          <span className="font-bold">Success:</span> {successMessage}
        </div>
      )}

      {/* --- TAB 0: MULTI-TENANT DIRECTORY --- */}
      {activeTab === 'tenants' && onSaveTenant && onDeleteTenant && onGenerateTenantToken && onSwitchTenant && (
        <AdminTenantsTab
          tenants={tenants}
          currentTenant={currentTenant}
          accessKeys={accessKeys}
          offices={offices}
          rooms={rooms}
          bookings={bookings}
          onSaveTenant={onSaveTenant}
          onDeleteTenant={onDeleteTenant}
          onGenerateTenantToken={onGenerateTenantToken}
          onRegenerateAccessKey={onRegenerateAccessKey}
          onSwitchTenant={onSwitchTenant}
        />
      )}

      {/* --- TAB 1: OFFICES MANAGEMENT --- */}
      {activeTab === 'offices' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Office Form */}
          <div className="bg-slate-850 p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold font-mono text-indigo-400 uppercase tracking-wider">
              {editingOffice ? '✏️ Edit Office Profile' : '➕ Create New Office'}
            </h3>
            
            <form onSubmit={handleSaveOfficeSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                  Office Location Name
                </label>
                <input
                  type="text"
                  value={officeName}
                  onChange={(e) => setOfficeName(e.target.value)}
                  placeholder="e.g. Downtown Singapore HQ"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                  Street Address / Location Detail
                </label>
                <input
                  type="text"
                  value={officeLocation}
                  onChange={(e) => setOfficeLocation(e.target.value)}
                  placeholder="e.g. Marina Bay Financial Centre, Tower 2"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                    Employee Passkey
                  </label>
                  <input
                    type="text"
                    value={officePasskey}
                    onChange={(e) => setOfficePasskey(e.target.value)}
                    placeholder="e.g. SG123"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 placeholder-slate-600 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                    Floors (Comma-List)
                  </label>
                  <input
                    type="text"
                    value={officeFloors}
                    onChange={(e) => setOfficeFloors(e.target.value)}
                    placeholder="1, 2, 3, 4"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 placeholder-slate-600 font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  {editingOffice ? 'Update Office' : 'Register Office'}
                </button>
                {editingOffice && (
                  <button
                    type="button"
                    onClick={handleResetOfficeForm}
                    className="bg-slate-800 hover:bg-slate-750 text-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Office List */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">
              Registered Locations ({offices.length})
            </h3>

            {offices.length === 0 ? (
              <div className="p-8 bg-slate-900/50 border border-slate-800 rounded-2xl text-center text-slate-500 text-xs">
                No office locations registered. Use the form on the left to add one.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {offices.map(office => {
                  const officeRooms = rooms.filter(r => r.officeId === office.id);
                  const officeBookings = bookings.filter(b => b.officeId === office.id);
                  return (
                    <div 
                      key={office.id}
                      className="bg-slate-850 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between">
                          <h4 className="font-bold text-slate-100 text-sm leading-tight flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                            {office.name}
                          </h4>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleEditOffice(office)}
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                              title="Edit Office Details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteOfficeClick(office)}
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Delete Office"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {office.location}
                        </p>
                      </div>

                      <div className="border-t border-slate-800/80 pt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
                        <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 flex items-center gap-1">
                          <Key className="w-2.5 h-2.5 text-amber-500" />
                          Passkey: <strong className="text-amber-400">{office.passkey}</strong>
                        </span>
                        
                        <span className="flex items-center gap-1">
                          <Layers className="w-2.5 h-2.5 text-indigo-400" />
                          Floors: {office.floors.join(', ')}
                        </span>
                        
                        <span>
                          {officeRooms.length} rooms • {officeBookings.length} reservations
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 2: ROOMS CONFIG --- */}
      {activeTab === 'rooms' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Room Form */}
          <div className="bg-slate-850 p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold font-mono text-indigo-400 uppercase tracking-wider">
              {editingRoom ? '✏️ Edit Room Configuration' : '➕ Add Meeting Room'}
            </h3>

            {offices.length === 0 ? (
              <p className="text-xs text-rose-300 bg-rose-950/20 p-3 rounded-lg border border-rose-950/50">
                You must register at least 1 Office Location first before creating meeting rooms.
              </p>
            ) : (
              <form onSubmit={handleSaveRoomSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                    Select Location (Office)
                  </label>
                  <select
                    value={selectedOfficeId}
                    onChange={(e) => {
                      setSelectedOfficeId(e.target.value);
                      const office = offices.find(o => o.id === e.target.value);
                      if (office && office.floors.length > 0) {
                        setRoomFloor(office.floors[0]);
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    {offices.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                    Room Name
                  </label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="e.g. Orion Boardroom"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                      Floor level
                    </label>
                    <select
                      value={roomFloor}
                      onChange={(e) => setRoomFloor(parseInt(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      {offices.find(o => o.id === selectedOfficeId)?.floors.map(fl => (
                        <option key={fl} value={fl}>
                          Floor {fl}
                        </option>
                      )) || <option value={1}>1</option>}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                      Capacity (Pax size)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={roomCapacity}
                      onChange={(e) => setRoomCapacity(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                    Theme Color
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_PRESETS.map(color => (
                      <button
                        type="button"
                        key={color}
                        onClick={() => setRoomColor(color)}
                        className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer hover:scale-110 ${
                          roomColor === color ? 'border-white scale-110 ring-2 ring-indigo-500' : 'border-transparent'
                        }`}
                        style={{
                          backgroundColor: 
                            color === 'indigo' ? '#4f46e5' :
                            color === 'emerald' ? '#059669' :
                            color === 'sky' ? '#0284c7' :
                            color === 'violet' ? '#7c3aed' :
                            color === 'rose' ? '#e11d48' :
                            color === 'amber' ? '#d97706' :
                            color === 'teal' ? '#0d9488' :
                            color === 'cyan' ? '#0891b2' :
                            color === 'fuchsia' ? '#c026d3' :
                            color === 'purple' ? '#9333ea' : '#2563eb'
                        }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                    Short Description
                  </label>
                  <textarea
                    value={roomDescription}
                    onChange={(e) => setRoomDescription(e.target.value)}
                    placeholder="e.g. Glass enclosed, optimized for external meetings..."
                    rows={2}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                    Amenities / Facilities
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto border border-slate-800 p-2.5 rounded-xl bg-slate-900">
                    {AMENITY_PRESETS.map(amenity => {
                      const isChecked = selectedAmenities.includes(amenity);
                      return (
                        <label 
                          key={amenity} 
                          className="flex items-center gap-1.5 text-[10px] text-slate-300 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleAmenityCheckboxToggle(amenity)}
                            className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{amenity}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    {editingRoom ? 'Update Room' : 'Add Room'}
                  </button>
                  {editingRoom && (
                    <button
                      type="button"
                      onClick={handleResetRoomForm}
                      className="bg-slate-800 hover:bg-slate-750 text-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* Rooms Grid */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">
              Configured Rooms ({rooms.length})
            </h3>

            {rooms.length === 0 ? (
              <div className="p-8 bg-slate-900/50 border border-slate-800 rounded-2xl text-center text-slate-500 text-xs">
                No rooms configured. Add a room using the left panel.
              </div>
            ) : (
              <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                {offices.map(office => {
                  const officeRooms = rooms.filter(r => r.officeId === office.id);
                  if (officeRooms.length === 0) return null;
                  return (
                    <div key={office.id} className="border border-slate-800 p-4 rounded-2xl bg-slate-900/45 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-extrabold text-indigo-400 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {office.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {officeRooms.length} active rooms
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {officeRooms.map(room => (
                          <div 
                            key={room.id}
                            className="bg-slate-850 p-3 rounded-xl border border-slate-800 flex justify-between gap-4"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full" style={{
                                  backgroundColor: 
                                    room.color === 'indigo' ? '#4f46e5' :
                                    room.color === 'emerald' ? '#059669' :
                                    room.color === 'sky' ? '#0284c7' :
                                    room.color === 'violet' ? '#7c3aed' :
                                    room.color === 'rose' ? '#e11d48' :
                                    room.color === 'amber' ? '#d97706' :
                                    room.color === 'teal' ? '#0d9488' :
                                    room.color === 'cyan' ? '#0891b2' :
                                    room.color === 'fuchsia' ? '#c026d3' :
                                    room.color === 'purple' ? '#9333ea' : '#2563eb'
                                }} />
                                <h5 className="font-bold text-slate-200 text-xs">{room.name}</h5>
                              </div>
                              <p className="text-[10px] text-slate-400">
                                Floor {room.floor} • Capacity: <strong className="text-slate-300">{room.capacity} pax</strong>
                              </p>
                              <div className="flex flex-wrap gap-1 pt-1">
                                {room.amenities.slice(0, 3).map(am => (
                                  <span key={am} className="text-[8px] bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-slate-400">
                                    {am}
                                  </span>
                                ))}
                                {room.amenities.length > 3 && (
                                  <span className="text-[8px] bg-indigo-950 border border-indigo-900 text-indigo-300 px-1 py-0.5 rounded">
                                    +{room.amenities.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col justify-between shrink-0">
                              <button
                                onClick={() => handleEditRoom(room)}
                                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                                title="Edit Room"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRoomClick(room)}
                                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Delete Room"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 3: RESERVATIONS SYSTEM-WIDE --- */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-850 p-4 rounded-2xl border border-slate-800">
            <div>
              <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <span>All Active Reservations Across All Offices</span>
                <span className="bg-indigo-900/60 text-indigo-300 text-[10px] px-2 py-0.5 rounded-full border border-indigo-700">
                  {bookings.length} {bookings.length === 1 ? 'Booking' : 'Bookings'}
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Centralized ledger with direct CSV audit exporting and administrative cancellation authority.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsExcelImportOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-950 cursor-pointer"
                title="Import bookings from Excel (.xlsx, .xls, .csv) with manual calendar or tabular layout"
              >
                <Upload className="w-4 h-4" />
                <span>Import from Excel Calendar</span>
              </button>

              <button
                type="button"
                onClick={handleExportBookingsCSV}
                disabled={bookings.length === 0}
                className="bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 disabled:opacity-50 disabled:pointer-events-none font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer"
                title="Export all reservations to CSV spreadsheet"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Export to CSV</span>
              </button>
            </div>
          </div>

          {bookings.length === 0 ? (
            <div className="p-12 bg-slate-850 border border-slate-800 rounded-2xl text-center text-slate-500 text-xs">
              No bookings active in the system.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-850">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-mono text-[10px] uppercase">
                    <th className="p-3">Office Location</th>
                    <th className="p-3">Meeting Room / Lvl</th>
                    <th className="p-3">Meeting / Title</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Time slot</th>
                    <th className="p-3">Staff Host Email</th>
                    <th className="p-3 text-right">Administrative Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {bookings.map(booking => {
                    const room = rooms.find(r => r.id === booking.roomId);
                    const office = offices.find(o => o.id === (booking.officeId || room?.officeId));
                    return (
                      <tr key={booking.id} className="hover:bg-slate-800/55 transition-colors">
                        <td className="p-3 font-semibold text-slate-200">
                          {office ? office.name : 'Unknown Office'}
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-indigo-400">{room ? room.name : 'Unknown'}</span>
                          <span className="text-slate-500 ml-1">(Lvl {booking.floor})</span>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-200">{booking.title}</div>
                          {booking.description && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{booking.description}</div>
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-300">{booking.date}</td>
                        <td className="p-3 font-mono text-amber-400">{booking.startTime} - {booking.endTime}</td>
                        <td className="p-3 text-slate-300">
                          <div>{booking.hostName}</div>
                          <div className="text-[10px] text-slate-400">{booking.hostEmail}</div>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => onCancelBooking(booking)}
                            className="bg-rose-950/40 hover:bg-rose-950 hover:text-rose-200 border border-rose-900/50 hover:border-rose-900 text-rose-300 px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer"
                          >
                            Cancel Reserve
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
      )}

      {/* --- TAB 3.5: PUBLIC HOLIDAYS & REPLACEMENT LEAVES (.ICS) --- */}
      {activeTab === 'holidays' && (
        <div className="bg-slate-850 p-6 rounded-2xl border border-slate-800">
          <AdminHolidaysTab
            blockedDates={blockedDates}
            tenants={tenants}
            currentTenant={currentTenant}
            isMasterAdmin={isMasterAdmin}
            adminEmail={adminEmail}
            onOpenIcsImportModal={() => setIsIcsHolidayImportOpen(true)}
            onSaveBlockedDate={async (dateData) => {
              if (onSaveBlockedDate) {
                await onSaveBlockedDate(dateData);
                triggerNotification('success', `Saved holiday/leave "${dateData.title}".`);
              }
            }}
            onDeleteBlockedDate={async (id) => {
              if (onDeleteBlockedDate) {
                await onDeleteBlockedDate(id);
                triggerNotification('success', 'Removed holiday/leave date.');
              }
            }}
            onToggleBlockedDate={async (id) => {
              if (onToggleBlockedDate) {
                await onToggleBlockedDate(id);
              }
            }}
            onLoadPresetHolidays={async () => {
              if (onLoadPresetHolidays) {
                await onLoadPresetHolidays();
                triggerNotification('success', 'Restored 2026 Gazetted Holidays preset.');
              }
            }}
          />
        </div>
      )}

      {/* --- TAB 4: ACCESS CONTROL & TOKENS --- */}
      {activeTab === 'access' && (
        <div className="bg-slate-850 p-6 rounded-2xl border border-slate-800">
          <AdminAccessControl
            approvedUsers={approvedUsers}
            accessKeys={accessKeys}
            adminEmail={adminEmail}
            currentTenant={currentTenant}
            isMasterAdmin={isMasterAdmin}
            onSaveTenant={onSaveTenant}
            onAddApprovedUser={onAddApprovedUser}
            onBulkAddApprovedUsers={onBulkAddApprovedUsers}
            onRemoveApprovedUser={onRemoveApprovedUser}
            onGenerateAccessKey={onGenerateAccessKey}
            onToggleAccessKey={onToggleAccessKey}
            onRevokeAccessKey={onRevokeAccessKey}
            onRegenerateAccessKey={onRegenerateAccessKey}
            onRegenerateAllInvalidKeys={onRegenerateAllInvalidKeys}
          />
        </div>
      )}

      {/* --- TAB 5: AUDIT LOGS & TRAILS --- */}
      {activeTab === 'audit' && (
        <div className="bg-slate-850 p-6 rounded-2xl border border-slate-800">
          <AdminAuditLogs
            logs={auditLogs}
            onClearLogs={onClearAuditLogs}
          />
        </div>
      )}

      {/* --- EXCEL CALENDAR BOOKINGS IMPORT MODAL --- */}
      <AdminExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        offices={offices}
        rooms={rooms}
        bookings={bookings}
        adminEmail={adminEmail}
        onImportBookings={async (importedBookings, logDetails) => {
          if (onImportBookings) {
            await onImportBookings(importedBookings, logDetails);
          }
          triggerNotification('success', `Successfully imported ${importedBookings.length} reservations from Excel.`);
        }}
      />

      {/* --- ICS HOLIDAY & LEAVE IMPORT MODAL --- */}
      <AdminIcsHolidayImportModal
        isOpen={isIcsHolidayImportOpen}
        onClose={() => setIsIcsHolidayImportOpen(false)}
        tenants={tenants}
        currentTenant={currentTenant}
        isMasterAdmin={isMasterAdmin}
        adminEmail={adminEmail}
        onImportBlockedDates={async (importedDates, logDetails) => {
          if (onImportIcsHolidays) {
            await onImportIcsHolidays(importedDates, logDetails);
          }
          triggerNotification('success', `Successfully imported ${importedDates.length} holiday/leave dates from .ics calendar.`);
        }}
      />

    </div>
  );
};
