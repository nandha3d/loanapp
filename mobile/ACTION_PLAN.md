# LoanTrack Mobile - Action Plan for Windows

## Current Status ✅

The mobile app project is **partially configured**:
- ✅ Flutter dependencies resolved (`pubspec.lock` exists)
- ✅ Windows platform files generated (`windows/` folder complete)
- ✅ Project structure ready

**What's missing**: Flutter SDK installation and system PATH configuration

## Required Actions

### 1. Download Flutter SDK (Required)

Since network download failed, manual setup is needed:

1. Visit: https://flutter.dev/docs/get-started/install/windows
2. Download Flutter SDK (3.24.0 stable or later)
3. Extract ZIP to: **`C:\flutter`**

**Direct download link**: https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.24.0-stable.zip

### 2. Add Flutter to System PATH (Required)

1. Press `Win + X` → "System"
2. Click "Advanced system settings" → "Environment Variables"
3. Under "User variables", click "New"
4. Variable name: `PATH`
5. Variable value: `C:\flutter\bin`
6. Click OK → OK → OK
7. **Close and reopen PowerShell**

### 3. Verify Installation

Open **new** PowerShell and run:
```powershell
flutter --version
flutter doctor
```

Resolve any missing tools shown by `flutter doctor`

### 4. Run the App

**Backend** (from repo root):
```powershell
npm run dev
```

**Mobile app** (from `mobile/` folder):
```powershell
flutter run -d windows
```

## If You Have Issues

### "Flutter not found"
- Make sure you extracted to `C:\flutter` (not `C:\flutter\flutter`)
- Verify `C:\flutter\bin\flutter.bat` exists
- Restart PowerShell after adding to PATH

### Compilation errors
- Run `flutter doctor` and install any missing tools
- May need Visual Studio Build Tools or Windows SDK

### Backend connection errors
- Ensure `npm run dev` is running on port 3000
- App looks for `http://localhost:3000/api/v1`

## Helper Scripts

We've created these scripts in the `mobile/` folder:

- **`check_setup.bat`** - Checks current setup status
- **`setup_windows.bat`** - Automated setup (after Flutter is in PATH)
- **`setup_windows.ps1`** - PowerShell setup script

## Estimated Time

- Download Flutter: 5-10 minutes
- Add to PATH: 2 minutes
- First run: 5-10 minutes (builds app)

**Total**: ~20 minutes first time, instant on subsequent runs

## Documentation

See these files for more details:
- [`README.md`](README.md) - Project overview & structure
- [`MANUAL_SETUP.md`](MANUAL_SETUP.md) - Detailed setup guide
- [`WINDOWS_SETUP.md`](WINDOWS_SETUP.md) - Windows-specific tips

---

**Next Step**: Download Flutter SDK to `C:\flutter`, then run `flutter run -d windows` from the `mobile/` directory.
