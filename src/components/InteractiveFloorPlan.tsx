import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, Users, Clock, Sparkles, CheckCircle2, 
  AlertCircle, ChevronRight, Info, Coffee, DoorOpen,
  Eye, Calendar, ArrowRight
} from 'lucide-react';
import { Room, Booking } from '../types';
import { isRoomAvailable, timeToMinutes } from '../utils';

interface InteractiveFloorPlanProps {
  rooms: Room[];
  bookings: Booking[];
  currentFloor: number;
  selectedDate: string;
  onSelectRoom: (room: Room, hour?: string) => void;
  onFloorChange?: (floor: number) => void;
  availableFloors?: number[];
}

export const InteractiveFloorPlan: React.FC<InteractiveFloorPlanProps> = ({
  rooms,
  bookings,
  currentFloor,
  selectedDate,
  onSelectRoom,
  onFloorChange,
  availableFloors = [1, 2, 3, 4],
}) => {
  const [selectedTimeHour, setSelectedTimeHour] = useState<string>('09:00');
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);

  // Filter rooms for current floor
  const floorRooms = rooms.filter(r => r.floor === currentFloor);

  const HOURS = [
    '08:00', '09:00', '10:00', '11:00', '12:00', 
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
  ];

  // Helper to check room availability at selectedTimeHour
  const getRoomLiveStatus = (room: Room, hour: string = selectedTimeHour) => {
    const startHour = hour;
    const [hStr, mStr] = startHour.split(':');
    const nextH = (parseInt(hStr, 10) + 1).toString().padStart(2, '0');
    const endHour = `${nextH}:${mStr}`;

    const available = isRoomAvailable(room.id, selectedDate, startHour, endHour, bookings);

    // Find active booking if occupied
    let activeBooking: Booking | undefined;
    if (!available) {
      const targetMin = timeToMinutes(startHour);
      activeBooking = bookings.find(b => {
        if (b.roomId !== room.id || b.date !== selectedDate) return false;
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);
        return targetMin >= bStart && targetMin < bEnd;
      });
    }

    return {
      isAvailable: available,
      activeBooking,
      startHour,
      endHour,
    };
  };

  // Stats calculation
  const totalFloorRooms = floorRooms.length;
  const availableFloorRoomsCount = floorRooms.filter(r => getRoomLiveStatus(r).isAvailable).length;

  // Grid / layout mapping coordinates for SVG Blueprint (1000 x 600 viewBox)
  // We compute responsive layout boxes based on index and room capacity
  const getRoomSvgCoords = (index: number, total: number, capacity: number) => {
    if (total === 1) {
      return { x: 60, y: 110, width: 620, height: 430, tableType: 'large' };
    }
    if (total === 2) {
      if (index === 0) return { x: 50, y: 110, width: 330, height: 430, tableType: 'large' };
      return { x: 410, y: 110, width: 330, height: 430, tableType: 'large' };
    }
    if (total === 3) {
      if (index === 0) return { x: 50, y: 110, width: 340, height: 430, tableType: 'large' };
      if (index === 1) return { x: 420, y: 110, width: 320, height: 205, tableType: 'medium' };
      return { x: 420, y: 335, width: 320, height: 205, tableType: 'medium' };
    }
    if (total === 4) {
      if (index === 0) return { x: 50, y: 110, width: 340, height: 205, tableType: 'medium' };
      if (index === 1) return { x: 420, y: 110, width: 320, height: 205, tableType: 'medium' };
      if (index === 2) return { x: 50, y: 335, width: 340, height: 205, tableType: 'medium' };
      return { x: 420, y: 335, width: 320, height: 205, tableType: 'medium' };
    }
    if (total === 5) {
      if (index === 0) return { x: 50, y: 110, width: 340, height: 205, tableType: 'large' };
      if (index === 1) return { x: 420, y: 110, width: 150, height: 205, tableType: 'small' };
      if (index === 2) return { x: 590, y: 110, width: 150, height: 205, tableType: 'small' };
      if (index === 3) return { x: 50, y: 335, width: 340, height: 205, tableType: 'medium' };
      return { x: 420, y: 335, width: 320, height: 205, tableType: 'medium' };
    }
    // 6 or more
    const row = Math.floor(index / 3);
    const col = index % 3;
    const width = 220;
    const height = 195;
    const x = 50 + col * 235;
    const y = 110 + row * 215;
    return { 
      x, 
      y, 
      width, 
      height, 
      tableType: capacity > 8 ? 'large' : capacity > 3 ? 'medium' : 'small' 
    };
  };

  const hoveredRoom = floorRooms.find(r => r.id === hoveredRoomId);
  const hoveredStatus = hoveredRoom ? getRoomLiveStatus(hoveredRoom) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
      
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Building2 className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-slate-900 text-sm font-sans tracking-tight uppercase">
              Interactive Blueprint & Floor Map — Level {currentFloor}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-sans">
            Click any room on the architectural layout to open reservations instantly.
          </p>
        </div>

        {/* Floor Switcher & Live Stats Badge */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {onFloorChange && availableFloors.length > 1 && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <span className="text-[10px] font-mono font-bold text-slate-400 px-2 uppercase">Lvl:</span>
              {availableFloors.map(fl => (
                <button
                  key={fl}
                  onClick={() => onFloorChange(fl)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    currentFloor === fl 
                      ? 'bg-indigo-600 text-white shadow-2xs' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {fl}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-600 font-bold">
              {availableFloorRoomsCount}/{totalFloorRooms} Spaces Free
            </span>
          </div>
        </div>
      </div>

      {/* Time Scrubber Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="text-xs font-bold text-slate-700 font-sans">Time Preview:</span>
          <span className="text-xs font-mono font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
            {selectedTimeHour}
          </span>
        </div>

        {/* Hour selector chips */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 md:pb-0 scrollbar-none">
          {HOURS.map(h => (
            <button
              key={h}
              onClick={() => setSelectedTimeHour(h)}
              className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                selectedTimeHour === h
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {h}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-sans shrink-0 pl-1">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Available
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Occupied
          </span>
        </div>
      </div>

      {/* Main SVG Blueprint Canvas */}
      <div className="relative w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
        
        {/* Subtle CAD Blueprint Grid Background */}
        <svg 
          viewBox="0 0 1000 580" 
          className="w-full h-auto select-none block"
          style={{ minHeight: '380px' }}
        >
          <defs>
            {/* Grid pattern */}
            <pattern id="cad-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.75" strokeDasharray="2,2" />
            </pattern>

            {/* Linear gradients for room cards */}
            <linearGradient id="avail-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#064e3b" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#022c22" stopOpacity="0.9" />
            </linearGradient>

            <linearGradient id="occupied-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#881337" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#4c0519" stopOpacity="0.95" />
            </linearGradient>
            
            <linearGradient id="hover-glow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4338ca" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {/* Blueprint background grid */}
          <rect width="1000" height="580" fill="#0f172a" />
          <rect width="1000" height="580" fill="url(#cad-grid)" />

          {/* Architectural Outer Perimeter Walls */}
          <rect 
            x="20" 
            y="20" 
            width="960" 
            height="540" 
            rx="16" 
            fill="none" 
            stroke="#334155" 
            strokeWidth="4" 
          />

          {/* Inner Corridor & Core Guidelines */}
          <rect 
            x="30" 
            y="30" 
            width="940" 
            height="520" 
            rx="12" 
            fill="none" 
            stroke="#1e293b" 
            strokeWidth="1.5" 
            strokeDasharray="4,4" 
          />

          {/* Central Service Core: Elevator Lobby, Restrooms & Kitchenette */}
          <g transform="translate(760, 110)">
            {/* Core Box */}
            <rect 
              x="0" 
              y="0" 
              width="200" 
              height="430" 
              rx="12" 
              fill="#1e293b" 
              stroke="#334155" 
              strokeWidth="2" 
            />
            
            {/* Service Title */}
            <text x="100" y="30" fill="#94a3b8" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              BUILDING CORE & AMENITIES
            </text>

            {/* Elevator Bank */}
            <g transform="translate(20, 50)">
              <rect width="70" height="75" rx="6" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
              <rect x="75" width="70" height="75" rx="6" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
              <text x="35" y="42" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">LIFT 1</text>
              <text x="110" y="42" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">LIFT 2</text>
              <line x1="35" y1="10" x2="35" y2="65" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2,2" />
              <line x1="110" y1="10" x2="110" y2="65" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2,2" />
            </g>

            {/* Restrooms */}
            <g transform="translate(20, 145)">
              <rect width="160" height="65" rx="6" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
              <text x="80" y="32" fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle">RESTROOMS (M/F/ACC)</text>
              <text x="80" y="48" fill="#64748b" fontSize="8" textAnchor="middle">Sensor Sanitation & Showers</text>
            </g>

            {/* Espresso Bar & Pantry */}
            <g transform="translate(20, 230)">
              <rect width="160" height="95" rx="6" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
              <text x="80" y="32" fill="#fbbf24" fontSize="10" fontWeight="bold" textAnchor="middle">PANTRY & BARISTA</text>
              <circle cx="45" cy="62" r="14" fill="#334155" />
              <circle cx="80" cy="62" r="14" fill="#334155" />
              <circle cx="115" cy="62" r="14" fill="#334155" />
              <text x="80" y="88" fill="#64748b" fontSize="8" textAnchor="middle">Refreshments & Coffee</text>
            </g>

            {/* Emergency Fire Exit Stairwell */}
            <g transform="translate(20, 345)">
              <rect width="160" height="65" rx="6" fill="#0f172a" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3,3" />
              <text x="80" y="36" fill="#f87171" fontSize="10" fontWeight="bold" textAnchor="middle">STAIRWELL EXIT</text>
              <text x="80" y="50" fill="#64748b" fontSize="8" textAnchor="middle">Emergency Route</text>
            </g>
          </g>

          {/* Top Architectural Banner */}
          <g transform="translate(50, 45)">
            <text x="0" y="24" fill="#f8fafc" fontSize="16" fontWeight="bold" fontFamily="sans-serif">
              LEVEL {currentFloor} FLOOR PLAN MATRIX
            </text>
            <text x="0" y="44" fill="#64748b" fontSize="11" fontFamily="sans-serif">
              Target slot: {selectedTimeHour} — Interactive Room Booking Hub
            </text>
          </g>

          {/* Corridor Pathway Lines */}
          <line x1="50" y1="320" x2="740" y2="320" stroke="#334155" strokeWidth="1.5" strokeDasharray="6,4" />
          <text x="390" y="324" fill="#475569" fontSize="9" fontWeight="bold" textAnchor="middle" letterSpacing="3">
            MAIN CORRIDOR WALKWAY
          </text>

          {/* Render Each Room dynamically onto the SVG Floor Plan */}
          {floorRooms.map((room, idx) => {
            const coords = getRoomSvgCoords(idx, floorRooms.length, room.capacity);
            const status = getRoomLiveStatus(room);
            const isHovered = hoveredRoomId === room.id;
            const isFree = status.isAvailable;

            return (
              <g 
                key={room.id}
                className="cursor-pointer transition-all group"
                onClick={() => onSelectRoom(room, selectedTimeHour)}
                onMouseEnter={() => setHoveredRoomId(room.id)}
                onMouseLeave={() => setHoveredRoomId(null)}
              >
                {/* Room Floor Boundary Box */}
                <rect
                  x={coords.x}
                  y={coords.y}
                  width={coords.width}
                  height={coords.height}
                  rx="14"
                  fill={isHovered ? 'url(#hover-glow)' : isFree ? 'url(#avail-grad)' : 'url(#occupied-grad)'}
                  stroke={isHovered ? '#818cf8' : isFree ? '#10b981' : '#f43f5e'}
                  strokeWidth={isHovered ? 3.5 : 2}
                  className="transition-all duration-200"
                />

                {/* Glass Door Swing Indicator */}
                <path
                  d={`M ${coords.x + 20} ${coords.y + coords.height} A 25 25 0 0 1 ${coords.x + 45} ${coords.y + coords.height - 25}`}
                  fill="none"
                  stroke={isFree ? '#34d399' : '#fb7185'}
                  strokeWidth="1.5"
                  strokeDasharray="2,2"
                />
                <line 
                  x1={coords.x + 20} 
                  y1={coords.y + coords.height} 
                  x2={coords.x + 20} 
                  y2={coords.y + coords.height - 25} 
                  stroke={isFree ? '#34d399' : '#fb7185'} 
                  strokeWidth="2" 
                />

                {/* Conference Table Graphic inside the room */}
                {coords.tableType === 'large' ? (
                  <g transform={`translate(${coords.x + coords.width / 2}, ${coords.y + coords.height / 2 + 10})`}>
                    {/* Table Surface */}
                    <rect x="-85" y="-30" width="170" height="60" rx="20" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
                    {/* Presentation Display Screen on North Wall */}
                    <rect x="-60" y="-85" width="120" height="8" rx="3" fill="#38bdf8" />
                    {/* Top Chairs */}
                    {[-60, -30, 0, 30, 60].map(cx => (
                      <circle key={cx} cx={cx} cy="-42" r="6" fill="#64748b" />
                    ))}
                    {/* Bottom Chairs */}
                    {[-60, -30, 0, 30, 60].map(cx => (
                      <circle key={cx} cx={cx} cy="42" r="6" fill="#64748b" />
                    ))}
                  </g>
                ) : coords.tableType === 'medium' ? (
                  <g transform={`translate(${coords.x + coords.width / 2}, ${coords.y + coords.height / 2 + 15})`}>
                    <rect x="-55" y="-20" width="110" height="40" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
                    <rect x="-40" y="-55" width="80" height="6" rx="2" fill="#38bdf8" />
                    {[-35, 0, 35].map(cx => (
                      <circle key={cx} cx={cx} cy="-28" r="5" fill="#64748b" />
                    ))}
                    {[-35, 0, 35].map(cx => (
                      <circle key={cx} cx={cx} cy="28" r="5" fill="#64748b" />
                    ))}
                  </g>
                ) : (
                  <g transform={`translate(${coords.x + coords.width / 2}, ${coords.y + coords.height / 2 + 15})`}>
                    <circle cx="0" cy="0" r="18" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
                    <circle cx="-22" cy="0" r="5" fill="#64748b" />
                    <circle cx="22" cy="0" r="5" fill="#64748b" />
                  </g>
                )}

                {/* Room Title & Capacity Header */}
                <g transform={`translate(${coords.x + 16}, ${coords.y + 24})`}>
                  {/* Status Indicator Dot */}
                  <circle
                    cx="4"
                    cy="0"
                    r="5"
                    fill={isFree ? '#10b981' : '#f43f5e'}
                    className={isFree ? 'animate-pulse' : ''}
                  />
                  <text 
                    x="16" 
                    y="4" 
                    fill="#ffffff" 
                    fontSize="13" 
                    fontWeight="bold"
                    fontFamily="sans-serif"
                  >
                    {room.name}
                  </text>
                  <text 
                    x="16" 
                    y="18" 
                    fill="#94a3b8" 
                    fontSize="10" 
                    fontFamily="monospace"
                  >
                    Capacity: {room.capacity} Pax • Lvl {room.floor}
                  </text>
                </g>

                {/* Status Pill Badge at bottom of Room */}
                <g transform={`translate(${coords.x + coords.width - 110}, ${coords.y + coords.height - 30})`}>
                  <rect
                    x="0"
                    y="0"
                    width="96"
                    height="20"
                    rx="10"
                    fill={isFree ? '#059669' : '#be123c'}
                  />
                  <text
                    x="48"
                    y="14"
                    fill="#ffffff"
                    fontSize="9.5"
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="sans-serif"
                  >
                    {isFree ? '● FREE TO BOOK' : '● OCCUPIED'}
                  </text>
                </g>

                {/* Interactive Click Prompt on Hover */}
                {isHovered && (
                  <g transform={`translate(${coords.x + coords.width / 2}, ${coords.y + coords.height / 2})`}>
                    <rect
                      x="-70"
                      y="-16"
                      width="140"
                      height="32"
                      rx="16"
                      fill="#4f46e5"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="shadow-lg"
                    />
                    <text
                      x="0"
                      y="5"
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="bold"
                      textAnchor="middle"
                      fontFamily="sans-serif"
                    >
                      Click to Book Room →
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Quick-Info Card when Hovering */}
        <AnimatePresence>
          {hoveredRoom && hoveredStatus && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-md bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white p-3.5 rounded-2xl shadow-2xl pointer-events-none"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-100">{hoveredRoom.name}</span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      hoveredStatus.isAvailable 
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}>
                      {hoveredStatus.isAvailable ? 'Available at ' + selectedTimeHour : 'Occupied'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                    {hoveredRoom.description || `Capacity: ${hoveredRoom.capacity} pax`}
                  </p>
                </div>
                <span className="text-[10px] text-indigo-400 font-mono font-bold shrink-0">
                  Click to reserve
                </span>
              </div>

              {!hoveredStatus.isAvailable && hoveredStatus.activeBooking && (
                <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-rose-300 flex items-center justify-between">
                  <span>Reserved: "{hoveredStatus.activeBooking.title}"</span>
                  <span className="font-mono">
                    {hoveredStatus.activeBooking.startTime} - {hoveredStatus.activeBooking.endTime}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
};
