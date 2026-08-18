# Meeting Room Booking System - Workspace Matrix

A real-time, multi-floor corporate meeting room booking system with interactive room floor plans, timeline scheduling, Google Calendar synchronization, Outlook export, and administrative room configuration.

## Features

- **Multi-Floor & Multi-Office Support**: Switch seamlessly between corporate offices and view floor-by-floor layouts.
- **Interactive Booking Timeline**: Visual hourly matrix to check availability and book time slots with a single click.
- **Calendar Integrations**:
  - **Google Calendar Sync**: Native Google OAuth integration to push events directly to Google Calendar.
  - **Outlook / iCal Sync**: Export `.ics` calendar invitation files for Outlook and other calendar apps.
- **Passkey Access & Admin Portal**: Secure passkey access for verified branch offices and an administrative portal (`admin123`) to configure rooms, amenities, capacities, and floor setups.
- **Simulated Notification Mailbox**: Built-in corporate email inbox simulating instant confirmation and cancellation alerts.
- **Responsive Design**: Polished, mobile-friendly interface styled with Tailwind CSS.

---

## 🚀 Publishing to GitHub & GitHub Pages

This repository is pre-configured for automated deployment to GitHub Pages via **GitHub Actions**.

### Step 1: Push Code to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Meeting Room Booking System"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY_NAME>.git
git push -u origin main
```

### Step 2: Configure GitHub Pages

1. Navigate to your repository on GitHub: `https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY_NAME>`
2. Click **Settings** (top tabs) -> **Pages** (left sidebar).
3. Under **Build and deployment**:
   - **Source**: Select **GitHub Actions** (recommended).
4. That's it! Every push to the `main` branch will automatically trigger the GitHub Actions workflow in `.github/workflows/deploy.yml` and publish your app.

### Step 3: Accessing Public URL

Your public live application will be accessible at:
```text
https://<YOUR_USERNAME>.github.io/<YOUR_REPOSITORY_NAME>/
```

---

## 💻 Local Development

### Prerequisites
- Node.js 18+ or 20+
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY_NAME>.git
cd <YOUR_REPOSITORY_NAME>

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production
```bash
npm run build
```
The compiled static assets will be in the `dist/` directory ready for deployment to any static web host.

---

## 🔑 Default Credentials & Quick Start

- **Office Passkeys**:
  - Singapore HQ: `SG123`
  - Silicon Valley Branch: `SV456`
- **Admin Password**: `admin123`
