import React from 'react';
import { motion } from 'motion/react';
import { Layers, CheckCircle2, AlertCircle } from 'lucide-react';
import { Room, Booking } from '../types';

interface FloorSelectorProps {
  selectedFloor: number;
  onSelectFloor: (floor: number) => void;
  rooms: Room[];
  bookings: Booking[];
  selectedDate: string;
  floors?: number[];
}

export const FloorSelector: React.FC<FloorSelectorProps> = ({
  selectedFloor,
  onSelectFloor,
  rooms,
  bookings,
  selectedDate,
  floors = [1, 2, 3, 4],
}) => {
  // Helper to calculate statistics per floor for the selected date
  const getFloorStats = (floor: number) => {
    const floorRooms = rooms.filter(r => r.floor === floor);
    const roomIds = floorRooms.map(r => r.id);
    
    // Find bookings on selected date for these rooms
    const activeBookings = bookings.filter(b => b.date === selectedDate && roomIds.includes(b.roomId));
    
    // Check which rooms are CURRENTLY occupied right now
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMin = now.getHours() * 60 + now.getMinutes();

    let occupiedRightNowCount = 0;
    if (selectedDate === todayStr) {
      floorRooms.forEach(room => {
        const roomBookings = activeBookings.filter(b => b.roomId === room.id);
        const isOccupied = roomBookings.some(b => {
          const [sh, sm] = b.startTime.split(':').map(Number);
          const [eh, em] = b.endTime.split(':').map(Number);
          const startMin = sh * 60 + sm;
          const endMin = eh * 60 + em;
          return currentMin >= startMin && currentMin < endMin;
        });
        if (isOccupied) occupiedRightNowCount++;
      });
    }

    return {
      total: floorRooms.length,
      occupiedNow: occupiedRightNowCount,
      totalBookedToday: activeBookings.length,
    };
  };

  const floorLabels: Record<number, string> = {
    1: 'Guest & Large Events',
    2: 'Co-Working & Creative Labs',
    3: 'Engineering & Quiet Pods',
    4: 'Executive Suite & Skyline',
  };

  return (
    <div id="floor-selector-container" className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-4 h-4 text-indigo-600" />
        <h2 className="font-sans font-bold text-slate-800 tracking-tight text-sm uppercase">
          Floor Directory Map
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {floors.map(floor => {
          const isSelected = selectedFloor === floor;
          const stats = getFloorStats(floor);
          const freeRoomsCount = stats.total - stats.occupiedNow;
          const label = floorLabels[floor] || 'General Workspaces';

          return (
            <button
              key={floor}
              id={`floor-button-${floor}`}
              onClick={() => onSelectFloor(floor)}
              className={`relative flex flex-col text-left p-3.5 rounded border transition-all duration-150 cursor-pointer overflow-hidden ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-500 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 bg-white'
              }`}
            >
              {/* Animated selection background */}
              {isSelected && (
                <motion.div
                  layoutId="activeFloorIndicator"
                  className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-violet-500/5 -z-10"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}

              <div className="flex items-center justify-between w-full mb-2">
                <span className={`font-mono text-[9px] font-black px-2 py-0.5 rounded-sm ${
                  isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-150 text-slate-600'
                }`}>
                  FLOOR 0{floor}
                </span>

                {/* Real-time occupied indicator */}
                {stats.occupiedNow > 0 ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {stats.occupiedNow} BUSY
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    ALL FREE
                  </span>
                )}
              </div>

              <h3 className={`font-sans font-black text-sm tracking-tight ${
                isSelected ? 'text-indigo-950' : 'text-slate-800'
              }`}>
                Floor {floor}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5 mb-3 flex-grow font-sans font-normal leading-tight">
                {label}
              </p>

              <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 border-t border-slate-100 pt-2 mt-auto">
                <div>
                  <span className="font-bold text-slate-700">{stats.total}</span> RMS
                </div>
                <div>
                  <span className={`font-bold ${freeRoomsCount > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {freeRoomsCount}
                  </span> FREE
                </div>
                <div>
                  <span className="font-bold text-slate-600">{stats.totalBookedToday}</span> BOOKS
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
