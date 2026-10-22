# EcoLoop AI 🌱

**Smart Recycling. Sustainable Communities. Rewarding Actions.**

EcoLoop AI is a mobile-first recycling application built with Flutter to encourage sustainable recycling through smart-bin interactions, recycling activity tracking, and a rewards-based EcoPoints system.

The project currently focuses on converting the resident application UI from Figma into Flutter, using offline assets and stateful mock services to simulate application behavior.

The broader project vision includes a standalone admin dashboard for managing smart bins, monitoring capacity alerts, verifying recycling deposits, and managing rewards. Backend integration and the standalone admin website are planned for later development.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Current Development Status](#current-development-status)
- [Resident Application Features](#resident-application-features)
  - [Admin Dashboard Roadmap](#admin-dashboard-roadmap)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Mock Scenarios](#mock-scenarios)
- [Testing and Verification](#testing-and-verification)
- [Project Vision](#project-vision)

## 🌍 Project Overview

EcoLoop AI aims to make recycling more accessible, transparent, and rewarding for residents while supporting more efficient recycling management within communities.

The platform is designed around two user types:

- **Resident:** Uses the mobile application to participate in recycling activities, earn EcoPoints, track recycling history, and redeem rewards.
- **Administrator:** Will use a dedicated dashboard to oversee recycling operations, monitor smart bins, review deposits, and manage reward policies.

## 🚧 Current Development Status

The current implementation focuses on **Goals 1–2: resident Flutter UI conversion and offline behavior**.

| Component | Status |
|---|---|
| Resident Flutter application | Current development scope |
| Mobile-first UI implementation | Current development scope |
| Offline assets and mock services | Implemented for current goals |
| Stateful mock interactions | Used for UI behavior and testing |
| Firebase initialization | Not included in current implementation |
| Backend integration | Future roadmap |
| Standalone admin website | Future roadmap |
| Physical smart-bin integration | Future roadmap |

## 📱 Resident Application Features

### Home Dashboard

- Display available EcoPoints and progress towards rewards.
- View verified deposit counts and total recycled weight.
- Access recent recycling activities.
- Navigate to recycling guides, history, and rewards.

### Smart-Bin Scanning

- Start a recycling session through the smart-bin scanning interface.
- View bin identification, location, accepted materials, and capacity status.
- Follow the recycling session workflow through stateful mock interactions.

### Recycling Verification

- Display item classification and verification states.
- Present the recycling results and corresponding EcoPoints.
- Support mock classification.

### Recycling History

- View recycling activity records.
- Display material types, bin information, timestamps, weights, and statuses.

### How to Recycle

- Learn about accepted recyclable materials.
- View preparation guidelines and recycling instructions.
- Understand the steps involved in using a smart recycling bin.

### Rewards and Vouchers

- Browse available rewards and their EcoPoints requirements.
- View voucher information.
- Simulate redemption flows.

### Account Settings

- View resident profile information.
- Access profile and account settings interfaces.

> Current functionality uses offline assets and mock services. These interfaces do not imply that real recycling hardware, AI inference, merchant redemption, or backend services are connected.

## 🖥️ Admin Dashboard Roadmap

A standalone admin website is planned as a later development goal. The proposed interface includes the following modules.

### Township Overview

- Monitor registered smart bins and active alerts.
- Review verified deposit and EcoPoints statistics.
- Analyze recycling activity and material distribution.
- Identify bins requiring attention.

### Smart-Bin Management

- Search bins by ID or location.
- Review capacity levels and collection status.
- Monitor bins requiring collection.

### Capacity Alerts

- Configure capacity thresholds.
- Track active and resolved alerts.
- Demonstrate collection scheduling, bin reset, and alert resolution workflows.

### Deposit Verification

- Review uncertain recycling classifications.
- Inspect predicted materials and confidence scores.
- Approve or reject deposits before eligible EcoPoints are issued.

### Rewards and Vouchers

- Create and edit rewards.
- Configure points requirements and expiry dates.
- Manage reward availability.

### System Settings

- Configure capacity alert thresholds.
- Select eligible material categories.
- Configure EcoPoints calculation rules.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| Flutter 3.47.0 | Resident mobile application UI |
| Dart 3.13.0 | Application development language |
| Offline assets | Local UI resources |
| Stateful mock services | Simulated application behavior |
| Flutter testing tools | Unit, widget, and integration testing |
| Flutter Web | Browser-based local execution and build verification |

The current resident application does not initialize or call Firebase.

## 🚀 Getting Started

### Prerequisites

Install the following tools:

- Flutter SDK 3.47.0
- Dart SDK 3.13.0
- Google Chrome, if running the application in a browser
- An IDE such as Visual Studio Code or Android Studio (optional)

Verify your installation:

```bash
flutter --version
dart --version
flutter doctor
```

### Installation

Clone the repository and enter the project directory:

```bash
git clone https://github.com/nayzinminlwin/EcoLoop-theSmartRecycling.git
cd EcoLoop-theSmartRecycling
```

Switch to the development branch used for the current work, if necessary:

```bash
git checkout dev2
```

Install the dependencies:

```bash
flutter pub get
```

### Run the Resident Application

Run the application in Chrome using the normal mock scenario:

```bash
flutter run -d chrome --dart-define=MOCK_SCENARIO=normal
```

The resident UI uses a **480 logical-pixel content frame** to match the mobile-first Figma design.

For other supported scenarios, see [Mock Scenarios](#-mock-scenarios).

## 🧪 Mock Scenarios

The application supports repository-test overrides through the `MOCK_SCENARIO` Dart environment define.

| Scenario | Purpose |
|---|---|
| `normal` | Normal application behavior |
| `readFailureOnce` | Simulate a one-time read failure |
| `classificationFailureOnce` | Simulate a one-time classification failure |
| `profileSaveFailureOnce` | Simulate a one-time profile-save failure |
| `emptyActivity` | Test the empty recycling activity state |
| `redemptionFailureOnce` | Simulate a one-time reward redemption failure |

Example:

```bash
flutter run -d chrome --dart-define=MOCK_SCENARIO=emptyActivity
```

These scenarios support development and testing. Production startup remains on the normal, offline configuration.

## ✅ Testing and Verification

Run the following commands from the project root.

### 1. Check Dart Formatting

```bash
dart format --output=none --set-exit-if-changed lib test integration_test
```

This checks whether the Dart files require formatting without modifying them.

### 2. Analyze the Flutter Project

```bash
flutter analyze
```

### 3. Run Unit and Widget Tests

```bash
flutter test
```

### 4. Build the Web Application

```bash
flutter build web
```

### 5. Check Available Devices

```bash
flutter devices
```

### 6. Run the Resident Journey Integration Test

```bash
flutter test integration_test/resident_journey_test.dart -d <device-id>
```

Replace `<device-id>` with an available emulator or physical-device ID.

The integration test requires an attached emulator or physical device. If no device is available, the unit/widget test suite and web build remain the offline acceptance checks.

For additional acceptance details, refer to [`docs/FLUTTER_UI_ACCEPTANCE.md`](https://github.com/nayzinminlwin/EcoLoop-theSmartRecycling/blob/dev2/docs/FLUTTER_UI_ACCEPTANCE.md).

## 🌱 Project Vision

EcoLoop AI aims to connect everyday recycling behavior with meaningful incentives and more efficient community waste management.

**Recycle responsibly. Earn rewards. Build greener communities.**
