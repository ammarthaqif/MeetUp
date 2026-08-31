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

### 4. Booking Modal Execution & Infinite Processing Loop Prevention
- **Resilient Non-Blocking Cloud Persistence**:
  - `handleSaveBooking` and `handleCancelBooking` must NEVER allow backend network latency, slow proxies, or Firestore connection timeouts to freeze the UI or block the client.
  - **Optimistic State Updates**: Local React state, `localStorage`, and `BroadcastChannel` are updated immediately (0ms lag), giving users instantaneous confirmation.
  - **Timeout-Guarded Conflict Pre-Flight**: Live Firestore query checks use `Promise.race` with a maximum 1.2s timeout fallback to the synchronized in-memory state.
  - **Background Persistence**: Cloud Firestore mutations (`setDoc`, `deleteDoc`) are executed in parallel (`Promise.allSettled`) with non-blocking timeout wrappers (2.5s max).
- **Modal Submission State Guarantee**:
  - In `BookingModal`, `isSaving` must always be protected with a hard safety timer (4.5s max) and wrapped inside a strict `try / catch / finally` block.
  - Whenever the modal opens, closes, or catches an exception, `isSaving` is forcefully reset to `false`.
  - The submit button must NEVER remain stuck in a "Processing..." infinite loop under any network condition.

### 5. Cross-Staff Real-Time Visibility & Firestore Serialization Guarantee
- **Mandatory Firestore Payload Sanitization**:
  - Firestore JavaScript SDK strictly throws an unhandled exception `Function setDoc() called with invalid data. Unsupported field value: undefined` if ANY field in an object is `undefined` (e.g. `googleEventId`, `hostUid`, `description`).
  - ALL writes to Firestore (`handleSaveBooking`, `handleImportBookingsFromExcel`, default seeding) MUST run through `cleanBookingForFirestore()`.
  - `cleanBookingForFirestore()` strips or provides safe defaults for all undefined fields so persistence is guaranteed never to fail silently.
- **Dual Real-Time Cloud Listeners**:
  - Applications run parallel `onSnapshot` listeners on both the global `/bookings` collection AND the tenant-specific subcollection `/tenants/{tenantId}/bookings`.
  - Any booking created, updated, or imported by one staff member is instantly reflected across all other staff dashboards, browsers, and devices.
  - Multi-tab and multi-window sync runs in parallel via `BroadcastChannel('office_sync_channel')` and `localStorage` storage events.
- **Room-ID Cross-Office Visibility**:
  - `currentOfficeBookings` ensures that any booking matching an active office room (`currentOfficeRoomIds.has(b.roomId)`) or tenant hierarchy is rendered immediately on the timeline, calendar grids, floor plan, and utilization dashboards.

