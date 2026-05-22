# Flutter Mobile App - Windows Setup Guide

The automatic setup script had network connectivity issues. Here's the manual setup process:

## Prerequisites

You need **Flutter SDK 3.22+** installed on your system. Choose one of these options:

### Option A: Manual Download (Recommended)

1. **Download Flutter**
   - Visit: https://flutter.dev/docs/get-started/install/windows
   - Or direct link: https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.24.0-stable.zip
   - Extract to: `C:\flutter`

2. **Add Flutter to PATH**
   - Open Settings → System → About → "Advanced system settings"
   - Click "Environment Variables"
   - Under "User variables", click "New"
   - Variable name: `PATH`
   - Variable value: `C:\flutter\bin`
   - Click OK

3. **Verify Installation**
   ```powershell
   flutter --version
   flutter doctor
   ```

### Option B: Using Scoop or Chocolatey

**Scoop** (faster for Windows):
```powershell
scoop install flutter
flutter doctor
```

**Chocolatey**:
```powershell
choco install flutter
flutter doctor
```

## Setup the Mobile App

Once Flutter is installed, from the `mobile/` directory:

```powershell
# 1. Install dependencies
flutter pub get

# 2. Generate Windows platform files
flutter create . --project-name loantrack --org com.loantrack --platforms=windows

# 3. Verify setup
flutter doctor
```

## Backend Requirements

Before running the app, ensure the backend is running:

```powershell
# From repo root
npm run dev
```

The mobile app will connect to `http://localhost:3000/api/v1` (or `http://10.0.2.2:3000/api/v1` on Android emulator)

## Running the App

### Windows Desktop
```powershell
flutter run -d windows
```

### Android Emulator (if available)
```powershell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

### Build Release
```powershell
flutter build windows --release
```

## Troubleshooting

If `flutter doctor` shows issues:

1. **Android Studio not installed**: Install from https://developer.android.com/studio
2. **Visual Studio Build Tools missing**: Download from https://visualstudio.microsoft.com/visual-cpp-build-tools/
3. **Windows SDK not installed**: Run `flutter doctor --verbose` for specific instructions

## Project Structure

```
mobile/
├── lib/              # Flutter source code
├── windows/          # Windows native code (auto-generated)
├── pubspec.yaml      # Dependencies
└── README.md         # Full documentation
```

## Next Steps

1. Complete `flutter doctor` resolution
2. Start the backend (`npm run dev` from repo root)
3. Run `flutter run -d windows` to launch the app
4. See [README.md](README.md) for more details
