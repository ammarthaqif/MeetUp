# Permanent Project Memory & Architectural Guidelines

## Core Principles & Hard Guarantees

### 1. Real-Time Meeting Room Booking & Double-Booking Prevention
- **Single Source of Truth**: All reservations (`Booking` objects) are stored and synchronized globally across Firebase Firestore (`/bookings` and `/tenants/{tenantId}/bookings`) with instant real-time snapshot synchronization (`onSnapshot`).
- **Pre-Flight Conflict Checks**:
  - `handleSaveBooking` executes a multi-layer verification before committing any booking:
    1. **In-Memory Verification**: Validates against local `bookings` array checking `Math.max(startA, startB) < Math.min(endA, endB)` for all target dates.
    2. **Live Firestore Query (/bookings)**: Directly queries Firestore `/bookings` collection for matching `roomId` and `date`.
    3. **Live Firestore Query (/tenants/{tenantId}/bookings)**: Directly queries tenant subcollection for matching `roomId` and `date`.
  - If any conflict exists, booking is rejected immediately with an explicit error notification detailing who reserved it and when.
- **Client Real-Time Conflict UI**:
  - `BookingModal` receives exhaustive `bookings` list to detect conflicts across any office or room instantly.
  - Conflict warning banner lights up in red, shows exact colliding meeting details and host info, and disables the submit button.
  - "Smart Alternative Rooms on Same Floor" displays 1-click alternative open rooms to resolve collisions instantly.
  - `RoomCard`, `BookingTimeline`, `WeeklyScheduleView`, and `InteractiveFloorPlan` immediately show booked slots as Busy/Occupied in real-time.

### 2. Multi-Tenant Isolation & Access Control
- Every tenant has designated offices, rooms, access keys, and bookings.
- Master Admin (`ammarthaqif.ar@gmail.com`) possesses full cross-tenant visibility, audit logs, and configuration privileges.
- Standard staff access their respective corporate tenant workspace via Google Auth or designated Access Tokens.

### 3. Holiday and Leave Management
- Public Holidays and Replacement Leaves can be imported via `.ics` or configured manually.
- Hard block holidays prevent room reservations on locked dates.
