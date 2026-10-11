import java.util.Properties
import java.io.FileInputStream
import java.util.Base64

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    // Firebase (FCM) — reads google-services.json.
    id("com.google.gms.google-services")
}

// Release signing config — read from android/key.properties (gitignored; written
// from GitHub secrets in CI). Falls back to debug signing when absent so local
// `flutter run` still works without the release keystore.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseKeystore = keystorePropertiesFile.exists()
if (hasReleaseKeystore) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

// Google Play build = `--dart-define=PLAY_RELEASE=true` (see lib/core/config/
// release_flags.dart). Flutter forwards dart-defines to Gradle as a comma-
// separated list of base64 "KEY=value" strings; when PLAY_RELEASE is on, the
// release manifest also merges src/play/AndroidManifest.xml (no background
// location, no cleartext). Every other build is unchanged.
val dartDefines: Map<String, String> = ((project.findProperty("dart-defines") as String?) ?: "")
    .split(",")
    .filter { encoded: String -> encoded.isNotBlank() }
    .mapNotNull { encoded: String ->
        runCatching { String(Base64.getDecoder().decode(encoded), Charsets.UTF_8) }.getOrNull()
    }
    .mapNotNull { kv: String ->
        val parts: List<String> = kv.split("=", limit = 2)
        if (parts.size == 2) parts[0] to parts[1] else null
    }
    .toMap()
val isPlayRelease = dartDefines["PLAY_RELEASE"] == "true"

android {
    namespace = "com.zolofund.app"
    compileSdk = 36
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.zolofund.app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        // Google Play: new apps/updates must target API 36 from 31 Aug 2026.
        targetSdk = 36
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
                enableV1Signing = true
                enableV2Signing = true
            }
        }
    }

    if (isPlayRelease) {
        sourceSets.getByName("release").manifest.srcFile("src/play/AndroidManifest.xml")
    }

    buildTypes {
        release {
            // Sign with the stable release keystore when present (CI + releases);
            // otherwise fall back to debug so local dev builds still work.
            signingConfig = if (hasReleaseKeystore)
                signingConfigs.getByName("release")
            else
                signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
