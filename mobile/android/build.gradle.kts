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
// configure. Inject a namespace for any subproject whose android extension is
// missing one. Reflection is used so the root script needs no AGP on classpath.
subprojects {
    afterEvaluate {
        val androidExtension = extensions.findByName("android") ?: return@afterEvaluate
        try {
            val getNamespace = androidExtension.javaClass.getMethod("getNamespace")
            val current = getNamespace.invoke(androidExtension) as? String
            if (current.isNullOrEmpty()) {
                val ns = "com.loantrack." + project.name.replace(Regex("[^A-Za-z0-9_]"), "_")
                androidExtension.javaClass
                    .getMethod("setNamespace", String::class.java)
                    .invoke(androidExtension, ns)
                logger.lifecycle("Injected namespace '$ns' into :${project.name}")
            }
        } catch (e: NoSuchMethodException) {
            // Extension has no namespace accessor (not an AGP module) — skip.
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
