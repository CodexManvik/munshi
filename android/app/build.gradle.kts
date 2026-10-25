import java.net.URI
import java.security.MessageDigest

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.paparazzi)
}

// sherpa-onnx and its voices are GitHub release files, not Maven artifacts: fetch each pinned file once
// into android/.cache and refuse it unless the SHA-256 matches.
fun sha256Of(f: File): String {
    val md = MessageDigest.getInstance("SHA-256")
    f.inputStream().use { s ->
        val buf = ByteArray(1 shl 16)
        while (true) { val n = s.read(buf); if (n < 0) break; md.update(buf, 0, n) }
    }
    return md.digest().joinToString("") { "%02x".format(it) }
}

fun fetchPinned(url: String, sha256: String, dest: File): File {
    if (dest.isFile && sha256Of(dest) == sha256) return dest
    dest.parentFile.mkdirs()
    val part = File(dest.path + ".part")
    logger.lifecycle("Downloading $url")
    URI(url).toURL().openStream().use { input -> part.outputStream().use { input.copyTo(it) } }
    val got = sha256Of(part)
    check(got == sha256) { "SHA-256 mismatch for $url: got $got, want $sha256" }
    check(part.renameTo(dest) || (dest.delete() && part.renameTo(dest))) { "Could not move $part to $dest" }
    return dest
}

val sherpaAar = fetchPinned(
    "https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/sherpa-onnx-static-link-onnxruntime-1.13.8.aar",
    "b22c3fc1b6a45666d28892bb2f7694beeb77a8362d7ebd77c1a5431ec9435471",
    rootProject.file(".cache/sherpa-onnx-static-link-onnxruntime-1.13.8.aar"),
)

android {
    namespace = "com.opuscube.munshi"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.opuscube.munshi"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        ndk { abiFilters += listOf("arm64-v8a", "x86_64") }
    }
    buildFeatures { compose = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    testOptions { unitTests.isReturnDefaultValues = true }
}

dependencies {
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.activity.compose)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.coroutines.android)
    implementation(libs.serialization.json)
    implementation(libs.okhttp)
    implementation(libs.okhttp.sse)
    implementation(libs.datastore.preferences)
    implementation(libs.code.scanner)
    implementation(libs.zxing.core)
    implementation(files(sherpaAar))
    debugImplementation(libs.compose.ui.tooling)

    testImplementation(libs.junit)
    testImplementation(libs.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver)
}
