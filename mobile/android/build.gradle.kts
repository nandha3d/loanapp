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

subprojects {
    plugins.withId("com.android.library") { injectNamespaceIfMissing() }
    plugins.withId("com.android.application") { injectNamespaceIfMissing() }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
