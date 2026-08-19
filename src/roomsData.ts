import { Room } from './types';

export const ROOMS: Room[] = [
  // Singapore HQ Rooms (office-singapore-hq)
  // Floor 1 - Guest & Large Meetings
  {
    id: 'f1-arena',
    name: 'The Arena',
    floor: 1,
    capacity: 20,
    amenities: ['Dual 85" Screens', 'Video Conferencing', 'Digital Whiteboard', 'Catering Station', 'Presenter Podium'],
    description: 'Our largest training room and seminar hall. Ideal for all-hands, client presentations, and fully catered team events.',
    color: 'indigo',
    officeId: 'office-singapore-hq'
  },
  {
    id: 'f1-pebble',
    name: 'Pebble Pod',
    floor: 1,
    capacity: 4,
    amenities: ['55" LED TV', 'Whiteboard', 'USB-C hub'],
    description: 'A cozy, acoustic-insulated huddle space. Perfect for quick syncs, 1-on-1s, or interviews on the ground floor.',
    color: 'emerald',
    officeId: 'office-singapore-hq'
  },
  {
    id: 'f1-orion',
    name: 'Orion Boardroom',
    floor: 1,
    capacity: 10,
    amenities: ['Video Conferencing', 'Whiteboard', 'Smart TV', 'Spacial Audio'],
    description: 'A glass-enclosed, elegant meeting room optimized for external partner meetings and structured board syncs.',
    color: 'sky',
    officeId: 'office-singapore-hq'
  },

  // Floor 2 - Collaboration & Brainstorms
  {
    id: 'f2-synapse',
    name: 'Synapse Lab',
    floor: 2,
    capacity: 12,
    amenities: ['Full-Wall Whiteboards', 'Interactive Projector', 'Flexible Layouts'],
    description: 'A creative lab with modular desks and full-wall writing surfaces designed to facilitate brainstorming and design sprints.',
    color: 'violet',
    officeId: 'office-singapore-hq'
  },
  {
    id: 'f2-nest',
    name: 'The Nest',
    floor: 2,
    capacity: 6,
    amenities: ['Touchscreen Display', 'Whiteboard', 'Wireless casting'],
    description: 'Warm, collaborative setting with comfortable armchairs. Ideal for design review and loose team ideation.',
    color: 'rose',
    officeId: 'office-singapore-hq'
  },
  {
    id: 'f2-booth',
    name: 'Phone Booth A',
    floor: 2,
    capacity: 2,
    amenities: ['Acoustic Insulation', 'Webcam Light', 'External Mic'],
    description: 'Ultra-quiet workspace built specifically for video calls, focus work, or confidential conversations.',
    color: 'amber',
    officeId: 'office-singapore-hq'
  },

  // Floor 3 - Engineering & Tech Syncs
  {
    id: 'f3-cyber',
    name: 'Cyber Studio',
    floor: 3,
    capacity: 8,
    amenities: ['Dual Monitors', 'High-Speed LAN', 'Glass Whiteboard', 'Ultra-Wide Camera'],
    description: 'Highly technical space customized for code pairing, API architecture reviews, and remote stand-ups.',
    color: 'teal',
    officeId: 'office-singapore-hq'
  },
  {
    id: 'f3-nebula',
    name: 'Nebula',
    floor: 3,
    capacity: 6,
    amenities: ['Whiteboard', 'Smart TV', 'Air Purifier'],
    description: 'Standard meeting room designed for sprint planning, stand-ups, and routine syncs.',
    color: 'cyan',
    officeId: 'office-singapore-hq'
  },
  {
    id: 'f3-focus',
    name: 'Focus Pod B',
    floor: 3,
    capacity: 2,
    amenities: ['Acoustic Panels', 'Desk Light', 'Dual Monitors'],
    description: 'Insulated focus room ideal for pair programming, interviews, or high-focus drafting.',
    color: 'fuchsia',
    officeId: 'office-singapore-hq'
  },

  // Floor 4 - Executive & Boardroom
  {
    id: 'f4-zenith',
    name: 'Zenith Boardroom',
    floor: 4,
    capacity: 25,
    amenities: ['4K Dual Projectors', 'Panoramic Glass View', 'Advanced Mic Array', 'Automated Blinds', 'Lounge Area'],
    description: 'Our premier executive space with sweeping city skyline views, state-of-the-art audiovisual setups, and adjacent private reception lounge.',
    color: 'rose',
    officeId: 'office-singapore-hq'
  },
  {
    id: 'f4-eclipse',
    name: 'Eclipse Suite',
    floor: 4,
    capacity: 8,
    amenities: ['Dynamic LED Lights', 'Whiteboard', '8K Video Setup'],
    description: 'High-end meeting room with smart-ambient lighting presets, customized for executive alignment and high-stakes pitches.',
    color: 'purple',
    officeId: 'office-singapore-hq'
  },
  {
    id: 'f4-atmosphere',
    name: 'Atmosphere Desk',
    floor: 4,
    capacity: 12,
    amenities: ['Standing Conference Desk', 'Mobile Whiteboard', 'Wireless screen casting'],
    description: 'A dynamic, standing-only conference room. Keeps alignment meetings short, energetic, and highly effective.',
    color: 'blue',
    officeId: 'office-singapore-hq'
  },

  // Silicon Valley Branch Rooms (office-silicon-valley)
  // Floor 1
  {
    id: 'sv-turing',
    name: 'Turing Lab',
    floor: 1,
    capacity: 12,
    amenities: ['Video Conferencing', 'Whiteboard', 'Dual Monitors'],
    description: 'Spacious collaborative engineering lab with high-speed video sync.',
    color: 'emerald',
    officeId: 'office-silicon-valley'
  },
  {
    id: 'sv-lovelace',
    name: 'Ada Lovelace Huddle',
    floor: 1,
    capacity: 4,
    amenities: ['Whiteboard', 'Smart TV'],
    description: 'Perfect huddle space for quick engineer alignment and sprint check-ins.',
    color: 'sky',
    officeId: 'office-silicon-valley'
  },

  // Floor 2
  {
    id: 'sv-hopper',
    name: 'The Hopper Suite',
    floor: 2,
    capacity: 8,
    amenities: ['Video Conferencing', 'Whiteboard', 'Acoustic Panels'],
    description: 'Board-style meeting room on the upper floor with acoustic insulation.',
    color: 'violet',
    officeId: 'office-silicon-valley'
  },
  {
    id: 'sv-shannon',
    name: 'Claude Shannon Focus Pod',
    floor: 2,
    capacity: 2,
    amenities: ['Acoustic Insulation', 'Desk Light', 'Dual Monitors'],
    description: 'Insulated pod designed for ultra-focus coding and pairing.',
    color: 'amber',
    officeId: 'office-silicon-valley'
  }
];
