allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// AGP 8+/9 requires every Android module to declare a `namespace`. Some older
// Flutter plugins (e.g. isar_flutter_libs 3.1.0+1) predate this and fail to
// configure. Inject a namespace for any module whose android extension lacks
// one. Done via plugins.withId (runs as AGP is applied, before the variant
// builder is created) — afterEvaluate is too late here because another
// subprojects block forces early evaluation via evaluationDependsOn(":app").
// Reflection is used so the root script needs no AGP on its classpath.
fun Project.injectNamespaceIfMissing() {
    val androidExtension = extensions.findByName("android") ?: return
    try {
        val current = androidExtension.javaClass.getMethod("getNamespace")
            .invoke(androidExtension) as? String
        if (current.isNullOrEmpty()) {
            val ns = "com.zolofund." + name.replace(Regex("[^A-Za-z0-9_]"), "_")
            androidExtension.javaClass
                .getMethod("setNamespace", String::class.java)
                .invoke(androidExtension, ns)
            logger.lifecycle("Injected namespace '$ns' into :$name")
        }
    } catch (e: NoSuchMethodException) {
        // Extension has no namespace accessor (not an AGP module) — skip.
    }
}

// Android dependencies (e.g. flutter_plugin_android_lifecycle) require compiling
// against SDK 36. Older plugins (like file_picker) hardcode compileSdk 34.
// Enforce compileSdk 36 across all subprojects via reflection.
fun Project.enforceCompileSdk(minSdkTarget: Int = 36) {
    val androidExtension = extensions.findByName("android") ?: return
    try {
        var currentSdk: Int? = null
        try {
            val getCompileSdk = androidExtension.javaClass.getMethod("getCompileSdk")
            currentSdk = getCompileSdk.invoke(androidExtension) as? Int
        } catch (_: NoSuchMethodException) {
            try {
                val getCompileSdkVersion = androidExtension.javaClass.getMethod("getCompileSdkVersion")
                val str = getCompileSdkVersion.invoke(androidExtension) as? String
                currentSdk = str?.removePrefix("android-")?.toIntOrNull()
            } catch (_: Exception) {}
        }

        if (currentSdk == null || currentSdk < minSdkTarget) {
            var updated = false
            try {
                val setCompileSdk = androidExtension.javaClass.getMethod("setCompileSdk", Integer::class.java)
                setCompileSdk.invoke(androidExtension, minSdkTarget)
                updated = true
            } catch (_: NoSuchMethodException) {
                try {
                    val compileSdkVersionMethod = androidExtension.javaClass.getMethod("compileSdkVersion", Integer.TYPE)
                    compileSdkVersionMethod.invoke(androidExtension, minSdkTarget)
                    updated = true
                } catch (_: Exception) {}
            }
            if (updated) {
                logger.lifecycle("Enforced compileSdk $minSdkTarget on :$name (was $currentSdk)")
            }
        }
    } catch (e: Exception) {
        // Extension has no compileSdk accessor — skip.
    }
}

subprojects {
    plugins.withId("com.android.library") {
        injectNamespaceIfMissing()
        enforceCompileSdk()
    }
    plugins.withId("com.android.application") {
        injectNamespaceIfMissing()
        enforceCompileSdk()
    }
    enforceCompileSdk()
    tasks.configureEach {
        if (name.contains("AarMetadata")) {
            enabled = false
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
