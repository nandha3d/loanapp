# LoanTrack Mobile App - Windows Setup Instructions

**Status**: Network download failed. Flutter SDK installation requires manual setup.

## Quick Summary

The LoanTrack mobile app is a **Flutter** application. To run it on Windows, you need:

1. **Flutter SDK** (not installed yet)
2. **Visual Studio Build Tools** (for native compilation)
3. **Project dependencies** (Dart packages)

## Step 1: Install Flutter SDK

### Option A: Manual Download (Most Reliable)

1. Open browser and visit: https://flutter.dev/docs/get-started/install/windows
2. Download the stable Windows build (3.24.0 or later)
3. Extract the ZIP file to: **`C:\flutter`**
   - Right-click flutter.zip → Extract All
   - Destination: `C:\flutter`

### Option B: Download Link
Direct download: https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.24.0-stable.zip

### Option C: Use Scoop (if available)
```powershell
scoop install flutter
```

## Step 2: Add Flutter to System PATH

1. Open Windows Start Menu → Search "Environment Variables"
2. Click "Edit the system environment variables"
3. Click "Environment Variables" button (bottom right)
4. Under "User variables", click "New"
5. Enter:
   - Variable name: `PATH`
   - Variable value: `C:\flutter\bin`
6. Click OK on all dialogs
7. **Restart PowerShell/Terminal**

## Step 3: Verify Flutter Installation

Open a **new** PowerShell window and run:

```powershell
flutter --version
flutter doctor
```

If `flutter doctor` shows issues:
- Install **Visual Studio Build Tools** for C++ development
- Install **Android Studio** (if you plan to test on emulator)

## Step 4: Setup the Mobile App

Once Flutter is working, navigate to the mobile directory:

```powershell
cd c:\Projects\loanapp\mobile

# Install Dart dependencies
flutter pub get

# Generate Windows native files (one-time)
flutter create . --project-name loantrack --org com.loantrack --platforms=windows
```

## Step 5: Verify Setup

```powershell
flutter doctor
```

All checkmarks should be green.

## Step 6: Start the Backend

The mobile app needs the Next.js backend running:

```powershell
# From repo root (c:\Projects\loanapp)
npm run dev
```

Backend will run at: `http://localhost:3000`

## Step 7: Run the App

### To run on Windows desktop:
```powershell
flutter run -d windows
```

### To build a release version:
```powershell
flutter build windows --release
```

Output will be at: `build\windows\runner\Release\loantrack.exe`

## Troubleshooting

### "flutter command not found"
- Make sure you restarted PowerShell after adding to PATH
- Verify PATH is set to `C:\flutter\bin`

### "Visual Studio Build Tools not found"
- Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
- Install with C++ workload selected

### "Windows SDK not installed"
- Run: `flutter doctor --verbose` for specific instructions

### App crashes on startup
- Ensure backend is running: `npm run dev` (from repo root)
- Check that backend is at `http://localhost:3000`

## Project Info

- **Framework**: Flutter (Dart)
- **Target**: Windows Desktop, Android, iOS
- **Backend API**: Next.js (`http://localhost:3000/api/v1`)
- **Auth**: JWT + TOTP (see README.md)

## Next Steps

1. ✅ Download and extract Flutter to `C:\flutter`
2. ✅ Add `C:\flutter\bin` to system PATH
3. ✅ Restart PowerShell
4. ✅ Run `flutter pub get` in `mobile/` directory
5. ✅ Run `flutter create . --project-name loantrack --org com.loantrack --platforms=windows`
6. ✅ Run `flutter run -d windows`

## Support Files

- [README.md](README.md) - Full project documentation
- [WINDOWS_SETUP.md](WINDOWS_SETUP.md) - Additional Windows setup notes
- [setup_windows.bat](setup_windows.bat) - Automated setup script (requires Flutter pre-installed)

---

**Need help?** Check the [main README.md](README.md) for authentication flow and project structure details.
