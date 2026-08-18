export interface Office {
  id: string;
  name: string;
  location: string;
  passkey: string;
  floors: number[]; // e.g. [1, 2, 3, 4]
  createdAt: number;
}

export interface Room {
  id: string;
  name: string;
  floor: number;
  capacity: number;
  amenities: string[];
  description: string;
  color: string; // Tailwind color name like 'emerald', 'sky', 'amber', etc.
  officeId?: string; // Tethers to an office
}

export interface Booking {
  id: string;
  roomId: string;
  floor: number;
  officeId?: string; // Tethers to an office
  title: string;
  hostName: string;
  hostEmail: string;
  hostUid: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  description: string;
  attendees: string[]; // Email addresses
  googleEventId?: string;
  outlookSynced?: boolean;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
}
