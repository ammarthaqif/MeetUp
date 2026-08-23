import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  TrendingUp, 
  Clock, 
  Users, 
  Calendar, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpRight, 
  ChevronRight, 
  Download, 
  Filter,
  Info,
  CalendarDays,
  Zap
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line
} from 'recharts';
import { Office, Room, Booking } from '../types';
import { timeToMinutes, minutesToTime, parseISODate, formatDateToISO, formatFriendlyDate } from '../utils';

interface RoomUtilizationDashboardProps {
  office: Office;
  rooms: Room[];
  bookings: Booking[];
  selectedDate: string;
  onSelectDate?: (date: string) => void;
  onBookRoom?: (room: Room, startHour?: string) => void;
  onViewInTimeline?: (room: Room, date: string) => void;
}

type TimeframeOption = 'day' | 'week' | 'month' | 'all';

// Operating hours for metrics calculation (08:00 to 18:00 = 10 hours per room per day)
const OPERATING_START_HOUR = 8;
const OPERATING_END_HOUR = 18;
const OPERATING_HOURS_PER_DAY = OPERATING_END_HOUR - OPERATING_START_HOUR; // 10 hours

const THEME_COLORS = [
  '#4f46e5', // Indigo
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#14b8a6', // Teal
];

export const RoomUtilizationDashboard: React.FC<RoomUtilizationDashboardProps> = ({
  office,
  rooms,
  bookings,
  selectedDate,
  onSelectDate,
  onBookRoom,
  onViewInTimeline,
}) => {
  const [timeframe, setTimeframe] = useState<TimeframeOption>('week');
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<number | 'all'>('all');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all');

  // Filter rooms belonging to current office and floor filter
  const officeRooms = useMemo(() => {
    return rooms.filter(r => {
      const matchOffice = !r.officeId || r.officeId === office.id;
      const matchFloor = selectedFloorFilter === 'all' || r.floor === selectedFloorFilter;
      const matchRoom = selectedRoomFilter === 'all' || r.id === selectedRoomFilter;
      return matchOffice && matchFloor && matchRoom;
    });
  }, [rooms, office.id, selectedFloorFilter, selectedRoomFilter]);

  // Compute the date range boundaries based on selected timeframe & selectedDate
  const dateRangeInfo = useMemo(() => {
    const baseDate = parseISODate(selectedDate);
    const today = new Date();
    
    if (timeframe === 'day') {
      return {
        startDateStr: selectedDate,
        endDateStr: selectedDate,
        label: formatFriendlyDate(selectedDate),
        daysCount: 1,
        dateList: [selectedDate],
      };
    }

    if (timeframe === 'week') {
      // Monday to Sunday of the selected date's week
      const dayOfWeek = baseDate.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(baseDate);
      monday.setDate(baseDate.getDate() + diffToMonday);

      const dateList: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dateList.push(formatDateToISO(d));
      }

      const start = dateList[0];
      const end = dateList[6];
      return {
        startDateStr: start,
        endDateStr: end,
        label: `${formatFriendlyDate(start)} – ${formatFriendlyDate(end)}`,
        daysCount: 7,
        dateList,
      };
    }

    if (timeframe === 'month') {
      const year = baseDate.getFullYear();
      const month = baseDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const dateList: string[] = [];
      for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        dateList.push(formatDateToISO(new Date(d)));
      }

      return {
        startDateStr: formatDateToISO(firstDay),
        endDateStr: formatDateToISO(lastDay),
        label: firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        daysCount: dateList.length,
        dateList,
      };
    }

    // 'all' / Quarter (last 60 days to next 30 days)
    const allDates = Array.from(new Set(bookings.map(b => b.date))).sort();
    const startDateStr = allDates[0] || selectedDate;
    const endDateStr = allDates[allDates.length - 1] || selectedDate;

    return {
      startDateStr,
      endDateStr,
      label: 'All Active Bookings & Forecasts',
      daysCount: Math.max(1, allDates.length),
      dateList: allDates.length > 0 ? allDates : [selectedDate],
    };
  }, [timeframe, selectedDate, bookings]);

  // Filtered Bookings for the current office, date range, and floor/room filters
  const targetBookings = useMemo(() => {
    const roomIds = new Set(officeRooms.map(r => r.id));
    return bookings.filter(b => {
      if (!roomIds.has(b.roomId)) return false;
      if (timeframe !== 'all' && !dateRangeInfo.dateList.includes(b.date)) return false;
      return true;
    });
  }, [bookings, officeRooms, timeframe, dateRangeInfo]);

  // ---------------------------------------------------------------------------
  // KPI Calculations
  // ---------------------------------------------------------------------------
  const kpis = useMemo(() => {
    const totalBookings = targetBookings.length;
    
    // Total booked hours
    let totalBookedMinutes = 0;
    targetBookings.forEach(b => {
      const s = timeToMinutes(b.startTime);
      const e = timeToMinutes(b.endTime);
      if (e > s) {
        totalBookedMinutes += (e - s);
      }
    });

    const totalBookedHours = Math.round((totalBookedMinutes / 60) * 10) / 10;

    // Total available operating capacity in room-hours
    // (number of active rooms * operating hours per day * days count)
    const businessDaysInWindow = dateRangeInfo.dateList.filter(dStr => {
      const d = parseISODate(dStr);
      const day = d.getDay();
      return day !== 0 && day !== 6; // Mon-Fri
    }).length || Math.max(1, Math.round(dateRangeInfo.daysCount * (5 / 7)));

    const totalAvailableHours = officeRooms.length * OPERATING_HOURS_PER_DAY * (timeframe === 'day' ? 1 : businessDaysInWindow);
    const overallUtilizationRate = totalAvailableHours > 0 
      ? Math.min(100, Math.round((totalBookedHours / totalAvailableHours) * 1000) / 10)
      : 0;

    // Room with highest bookings
    const roomBookingCounts: Record<string, { count: number; minutes: number }> = {};
    officeRooms.forEach(r => {
      roomBookingCounts[r.id] = { count: 0, minutes: 0 };
    });

    targetBookings.forEach(b => {
      if (roomBookingCounts[b.roomId]) {
        roomBookingCounts[b.roomId].count += 1;
        const dur = Math.max(0, timeToMinutes(b.endTime) - timeToMinutes(b.startTime));
        roomBookingCounts[b.roomId].minutes += dur;
      }
    });

    let topRoom: { room: Room; count: number; hours: number } | null = null;
    let maxMinutes = -1;

    officeRooms.forEach(r => {
      const stats = roomBookingCounts[r.id];
      if (stats && stats.minutes > maxMinutes) {
        maxMinutes = stats.minutes;
        topRoom = {
          room: r,
          count: stats.count,
          hours: Math.round((stats.minutes / 60) * 10) / 10,
        };
      }
    });

    // Average meeting duration
    const avgDurationMin = totalBookings > 0 ? Math.round(totalBookedMinutes / totalBookings) : 0;
    const avgDurationStr = avgDurationMin >= 60 
      ? `${Math.floor(avgDurationMin / 60)}h ${avgDurationMin % 60 > 0 ? `${avgDurationMin % 60}m` : ''}`
      : `${avgDurationMin} min`;

    return {
      totalBookings,
      totalBookedHours,
      totalAvailableHours,
      overallUtilizationRate,
      topRoom,
      avgDurationStr,
    };
  }, [targetBookings, officeRooms, dateRangeInfo, timeframe]);

  // ---------------------------------------------------------------------------
  // Chart 1: Hourly Peak Usage Breakdown (08:00 to 18:00)
  // ---------------------------------------------------------------------------
  const hourlyOccupancyData = useMemo(() => {
    const hours = [
      '08:00', '09:00', '10:00', '11:00', '12:00', 
      '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
    ];

    let maxConcurrent = 0;
    let peakHourStr = '10:00 - 11:00';

    const data = hours.map((hourStr, idx) => {
      const startMin = timeToMinutes(hourStr);
      const endMin = startMin + 60; // 1-hour slot

      // Count overlapping bookings across the active date range
      let activeOverlapCount = 0;
      targetBookings.forEach(b => {
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);
        if (Math.max(startMin, bStart) < Math.min(endMin, bEnd)) {
          activeOverlapCount++;
        }
      });

      // Average active rooms in this hour per day
      const divisor = Math.max(1, dateRangeInfo.daysCount);
      const avgRoomsActive = Math.round((activeOverlapCount / divisor) * 10) / 10;
      const utilizationPct = officeRooms.length > 0
        ? Math.min(100, Math.round((avgRoomsActive / officeRooms.length) * 100))
        : 0;

      if (activeOverlapCount > maxConcurrent) {
        maxConcurrent = activeOverlapCount;
        const nextHour = hours[idx + 1] || '19:00';
        peakHourStr = `${hourStr} – ${nextHour}`;
      }

      return {
        hour: hourStr,
        displayHour: hourStr,
        totalBookingsInSlot: activeOverlapCount,
        avgRoomsActive,
        utilizationPct,
      };
    });

    return {
      chartData: data,
      peakHourStr,
      maxConcurrent,
    };
  }, [targetBookings, dateRangeInfo.daysCount, officeRooms.length]);

  // ---------------------------------------------------------------------------
  // Chart 2: Daily / Day-of-Week Occupancy Trend
  // ---------------------------------------------------------------------------
  const dailyTrendData = useMemo(() => {
    if (timeframe === 'day') {
      // Breakdown by morning vs afternoon intervals
      const timeSlots = [
        { label: 'Early (08-10)', start: 480, end: 600 },
        { label: 'Mid-Morn (10-12)', start: 600, end: 720 },
        { label: 'Mid-Day (12-14)', start: 720, end: 840 },
        { label: 'Afternoon (14-16)', start: 840, end: 960 },
        { label: 'Late (16-18)', start: 960, end: 1080 },
      ];

      return timeSlots.map(slot => {
        const slotBookings = targetBookings.filter(b => {
          const bStart = timeToMinutes(b.startTime);
          const bEnd = timeToMinutes(b.endTime);
          return Math.max(slot.start, bStart) < Math.min(slot.end, bEnd);
        });

        let hoursSum = 0;
        slotBookings.forEach(b => {
          const bStart = Math.max(slot.start, timeToMinutes(b.startTime));
          const bEnd = Math.min(slot.end, timeToMinutes(b.endTime));
          hoursSum += Math.max(0, bEnd - bStart) / 60;
        });

        return {
          day: slot.label,
          fullDate: selectedDate,
          bookings: slotBookings.length,
          bookedHours: Math.round(hoursSum * 10) / 10,
        };
      });
    }

    if (timeframe === 'week') {
      const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return dateRangeInfo.dateList.map((dStr, idx) => {
        const dayBookings = targetBookings.filter(b => b.date === dStr);
        let hoursSum = 0;
        dayBookings.forEach(b => {
          hoursSum += Math.max(0, timeToMinutes(b.endTime) - timeToMinutes(b.startTime)) / 60;
        });
        return {
          day: weekdays[idx] || dStr,
          fullDate: dStr,
          bookings: dayBookings.length,
          bookedHours: Math.round(hoursSum * 10) / 10,
        };
      });
    }

    // Month or All: group by date or week intervals
    return dateRangeInfo.dateList.slice(0, 14).map(dStr => {
      const dayBookings = targetBookings.filter(b => b.date === dStr);
      let hoursSum = 0;
      dayBookings.forEach(b => {
        hoursSum += Math.max(0, timeToMinutes(b.endTime) - timeToMinutes(b.startTime)) / 60;
      });
      const d = parseISODate(dStr);
      return {
        day: `${d.getMonth() + 1}/${d.getDate()}`,
        fullDate: dStr,
        bookings: dayBookings.length,
        bookedHours: Math.round(hoursSum * 10) / 10,
      };
    });
  }, [timeframe, targetBookings, dateRangeInfo, selectedDate]);

  // ---------------------------------------------------------------------------
  // Chart 3: Room-by-Room Utilization Ranking
  // ---------------------------------------------------------------------------
  const roomRankingData = useMemo(() => {
    const totalOperatingHours = OPERATING_HOURS_PER_DAY * Math.max(1, dateRangeInfo.daysCount);

    return officeRooms.map((room, idx) => {
      const roomBookings = targetBookings.filter(b => b.roomId === room.id);
      let bookedMinutes = 0;
      roomBookings.forEach(b => {
        bookedMinutes += Math.max(0, timeToMinutes(b.endTime) - timeToMinutes(b.startTime));
      });

      const bookedHours = Math.round((bookedMinutes / 60) * 10) / 10;
      const rate = totalOperatingHours > 0 
        ? Math.min(100, Math.round((bookedHours / totalOperatingHours) * 100))
        : 0;

      return {
        id: room.id,
        name: room.name,
        floor: `Lvl ${room.floor}`,
        capacity: room.capacity,
        bookingsCount: roomBookings.length,
        bookedHours,
        utilizationRate: rate,
        color: THEME_COLORS[idx % THEME_COLORS.length],
        roomObj: room,
      };
    }).sort((a, b) => b.bookedHours - a.bookedHours);
  }, [officeRooms, targetBookings, dateRangeInfo.daysCount]);

  // ---------------------------------------------------------------------------
  // Chart 4: Floor Level Distribution
  // ---------------------------------------------------------------------------
  const floorDistributionData = useMemo(() => {
    const floorMap: Record<number, { floor: string; bookedHours: number; count: number }> = {};
    
    office.floors.forEach(f => {
      floorMap[f] = { floor: `Level ${f}`, bookedHours: 0, count: 0 };
    });

    targetBookings.forEach(b => {
      const room = rooms.find(r => r.id === b.roomId);
      const floorNum = room?.floor || b.floor || 1;
      if (!floorMap[floorNum]) {
        floorMap[floorNum] = { floor: `Level ${floorNum}`, bookedHours: 0, count: 0 };
      }
      const dur = Math.max(0, timeToMinutes(b.endTime) - timeToMinutes(b.startTime)) / 60;
      floorMap[floorNum].bookedHours += dur;
      floorMap[floorNum].count += 1;
    });

    return Object.keys(floorMap).map((k, idx) => {
      const floorNum = parseInt(k);
      const item = floorMap[floorNum];
      return {
        name: item.floor,
        floor: floorNum,
        value: Math.round(item.bookedHours * 10) / 10 || 0.1, // Small fallback for zero pie chart
        actualHours: Math.round(item.bookedHours * 10) / 10,
        bookingCount: item.count,
        color: THEME_COLORS[idx % THEME_COLORS.length],
      };
    });
  }, [office.floors, targetBookings, rooms]);

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <BarChart3 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-bold text-slate-900 text-lg tracking-tight">
                {office.name} &bull; Room Utilization & Peak Usage
              </h2>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Occupancy trends, high-demand meeting hours, and capacity analytics across {officeRooms.length} spaces ({office.location}).
              </p>
            </div>
          </div>
        </div>

        {/* Timeframe & Floor Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Timeframe selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setTimeframe('day')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                timeframe === 'day' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('week')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                timeframe === 'week' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('month')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                timeframe === 'month' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('all')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                timeframe === 'all' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Floor filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedFloorFilter}
              onChange={(e) => setSelectedFloorFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer"
            >
              <option value="all">All Floors</option>
              {office.floors.map(f => (
                <option key={f} value={f}>Level {f}</option>
              ))}
            </select>
          </div>

          {/* Date Picker trigger */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onSelectDate?.(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Overall Utilization Rate */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              Average Utilization
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
              kpis.overallUtilizationRate > 70 
                ? 'bg-amber-100 text-amber-900' 
                : kpis.overallUtilizationRate > 30 
                  ? 'bg-emerald-100 text-emerald-900' 
                  : 'bg-indigo-100 text-indigo-900'
            }`}>
              {kpis.overallUtilizationRate > 70 ? 'High Demand' : 'Optimal Load'}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {kpis.overallUtilizationRate}%
            </span>
            <span className="text-xs text-slate-400 font-medium">
              of {kpis.totalAvailableHours} available hrs
            </span>
          </div>
          {/* Visual progress meter */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
            <div 
              className={`h-1.5 rounded-full transition-all duration-500 ${
                kpis.overallUtilizationRate > 70 ? 'bg-amber-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${Math.min(100, kpis.overallUtilizationRate)}%` }}
            />
          </div>
        </div>

        {/* Total Bookings & Booked Hours */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              Total Reserved Time
            </span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {kpis.totalBookedHours} hrs
            </span>
            <span className="text-xs text-slate-500 font-semibold font-mono">
              ({kpis.totalBookings} meetings)
            </span>
          </div>
          <div className="mt-2.5 text-[11px] text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
            <span>Avg session: <strong>{kpis.avgDurationStr}</strong></span>
          </div>
        </div>

        {/* Peak Usage Window */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              Peak Traffic Window
            </span>
            <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-slate-900 tracking-tight">
              {hourlyOccupancyData.peakHourStr}
            </span>
          </div>
          <div className="mt-2.5 text-[11px] text-slate-500 flex items-center gap-1">
            <span className="font-bold text-amber-600 font-mono">🔥 Peak Load:</span>
            <span>{hourlyOccupancyData.maxConcurrent} active meetings</span>
          </div>
        </div>

        {/* Most In-Demand Room */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              Top Booked Space
            </span>
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 truncate" title={kpis.topRoom?.room.name || 'N/A'}>
            <span className="text-lg font-bold text-slate-900 tracking-tight">
              {kpis.topRoom?.room.name || 'No Bookings'}
            </span>
          </div>
          <div className="mt-2.5 text-[11px] text-slate-500 flex items-center justify-between font-mono">
            <span>Level {kpis.topRoom?.room.floor || 1} ({kpis.topRoom?.room.capacity || 0} pax)</span>
            <span className="font-bold text-emerald-600">{kpis.topRoom?.hours || 0}h booked</span>
          </div>
        </div>

      </div>

      {/* CHARTS GRID SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left 7 Cols: Hourly Peak Usage Area Chart */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                Hourly Occupancy & Peak Usage Trends
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Concurrent room demand across business hours (08:00 to 18:00) for {dateRangeInfo.label}.
              </p>
            </div>
            <div className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg">
              Peak: {hourlyOccupancyData.peakHourStr}
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyOccupancyData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="utilizationGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs space-y-1">
                          <div className="font-bold text-indigo-300">{label} – {String(label || '').split(':')[0]}:59</div>
                          <div className="text-slate-200">Total Bookings in Slot: <strong>{data.totalBookingsInSlot}</strong></div>
                          <div className="text-slate-300">Avg Concurrent Rooms: <strong>{data.avgRoomsActive}</strong> / {officeRooms.length}</div>
                          <div className="text-emerald-400 font-bold font-mono">Utilization: {data.utilizationPct}%</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="totalBookingsInSlot" 
                  name="Bookings"
                  stroke="#4f46e5" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#utilizationGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 font-mono">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              <span>Active Booking Volume</span>
            </span>
            <span className="text-slate-400">Total spaces analyzed: {officeRooms.length}</span>
          </div>
        </div>

        {/* Right 5 Cols: Floor Share Donut Chart */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-violet-600" />
                Demand by Floor Level
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Share of booked meeting hours across building levels.
              </p>
            </div>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={floorDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {floorDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-lg border border-slate-800 text-xs">
                          <div className="font-bold" style={{ color: data.color }}>{data.name}</div>
                          <div className="text-slate-300 mt-1">Booked: <strong>{data.actualHours} hrs</strong></div>
                          <div className="text-slate-400">{data.bookingCount} meetings</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
            {floorDistributionData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-slate-50">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="font-bold text-slate-700 truncate">{item.name}</span>
                </div>
                <span className="font-mono text-[11px] text-slate-500 font-bold ml-1">{item.actualHours}h</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* SECOND ROW: Daily Trends & Room Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left 5 Cols: Daily Trend Bar Chart */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Schedule Distribution ({timeframe === 'week' ? 'Day of Week' : 'Time Interval'})
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Meeting hours booked per day.
              </p>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-lg border border-slate-800 text-xs space-y-0.5">
                          <div className="font-bold text-emerald-300">{label} ({data.fullDate || ''})</div>
                          <div className="text-slate-200">Total Bookings: <strong>{data.bookings}</strong></div>
                          {data.bookedHours !== undefined && (
                            <div className="text-slate-300">Booked Hours: <strong>{data.bookedHours} hrs</strong></div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="bookings" name="Bookings" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 7 Cols: Room Utilization Comparison */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cyan-600" />
                Room Utilization Ranking
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Comparison of hours reserved per individual space.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {roomRankingData.length} spaces
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={roomRankingData.slice(0, 6)}
                margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} unit="h" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#1e293b' }} width={80} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs space-y-1">
                          <div className="font-bold text-cyan-300">{data.name} ({data.floor})</div>
                          <div className="text-slate-200">Capacity: <strong>{data.capacity} pax</strong></div>
                          <div className="text-slate-200">Total Bookings: <strong>{data.bookingsCount}</strong></div>
                          <div className="text-slate-200">Reserved Time: <strong>{data.bookedHours} hrs</strong></div>
                          <div className="text-emerald-400 font-mono font-bold">Utilization Rate: {data.utilizationRate}%</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="bookedHours" fill="#06b6d4" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* DETAILED ROOMS BREAKDOWN TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Comprehensive Room Utilization Audit & Deep Dive
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Individual metrics, load distribution, and fast booking actions for {office.name}.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-mono font-bold text-[10px] uppercase tracking-wider">
                <th className="py-3 px-3 rounded-l-xl">Room Name</th>
                <th className="py-3 px-2">Floor</th>
                <th className="py-3 px-2">Capacity</th>
                <th className="py-3 px-2">Meetings</th>
                <th className="py-3 px-2">Booked Hours</th>
                <th className="py-3 px-3">Utilization Rate</th>
                <th className="py-3 px-2">Demand Status</th>
                <th className="py-3 px-3 text-right rounded-r-xl">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roomRankingData.map((item) => {
                const isHighDemand = item.utilizationRate > 65;
                const isUnderutilized = item.utilizationRate < 20;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[10px] text-slate-400">ID: {item.id}</div>
                    </td>
                    <td className="py-3 px-2 font-mono text-slate-600">{item.floor}</td>
                    <td className="py-3 px-2">
                      <span className="inline-flex items-center gap-1 font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        <Users className="w-3 h-3 text-slate-400" />
                        {item.capacity}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-bold text-slate-800 font-mono">{item.bookingsCount}</td>
                    <td className="py-3 px-2 font-bold text-slate-800 font-mono">{item.bookedHours} hrs</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              isHighDemand ? 'bg-amber-500' : isUnderutilized ? 'bg-slate-400' : 'bg-indigo-600'
                            }`}
                            style={{ width: `${Math.min(100, item.utilizationRate)}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-700 text-[11px]">{item.utilizationRate}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold font-mono uppercase px-2 py-0.5 rounded-full ${
                        isHighDemand 
                          ? 'bg-amber-100 text-amber-900' 
                          : isUnderutilized 
                            ? 'bg-slate-100 text-slate-700' 
                            : 'bg-emerald-100 text-emerald-900'
                      }`}>
                        {isHighDemand ? 'High Demand' : isUnderutilized ? 'Low Traffic' : 'Balanced'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {onBookRoom && (
                          <button
                            type="button"
                            onClick={() => onBookRoom(item.roomObj)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition-colors cursor-pointer"
                          >
                            Book Room
                          </button>
                        )}
                        {onViewInTimeline && (
                          <button
                            type="button"
                            onClick={() => onViewInTimeline(item.roomObj, selectedDate)}
                            className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            title="View in Timeline"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
