package com.opuscube.munshi.voice

import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsKokoroModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig
import java.io.File

/** One voice on disk, as unpacked from a sherpa-onnx `tts-models` archive. */
sealed interface VoiceSpec {
    val id: String
    val label: String
    val dir: File
    val sid: Int

    data class Piper(override val dir: File) : VoiceSpec {
        override val id: String get() = dir.name
        override val label: String get() = "Piper · " + dir.name.removePrefix("vits-piper-hi_IN-").substringBefore('-')
        override val sid: Int get() = 0
    }

    data class Kokoro(override val dir: File, override val sid: Int, val voice: String) : VoiceSpec {
        override val id: String get() = "${dir.name}#$sid"
        override val label: String get() = "Kokoro · $voice"
    }
}

object Voices {
    /** Kokoro v1.0 speaker ids of its Hindi voices (sherpa-onnx Kokoro docs). */
    val KOKORO_HINDI = listOf(31 to "hf_alpha", 33 to "hm_omega")

    fun discover(root: File?): List<VoiceSpec> =
        root?.listFiles().orEmpty().filter { it.isDirectory }.sortedBy { it.name }.flatMap { d ->
            val complete = d.onnx() != null && File(d, "tokens.txt").isFile && File(d, "espeak-ng-data").isDirectory
            when {
                !complete -> emptyList()
                d.name.startsWith("vits-piper-hi_IN-") -> listOf(VoiceSpec.Piper(d))
                d.name.startsWith("kokoro") && File(d, "voices.bin").isFile -> KOKORO_HINDI.map { (sid, v) -> VoiceSpec.Kokoro(d, sid, v) }
                else -> emptyList()
            }
        }

    // Files on disk, no AssetManager: espeak-ng needs a real directory for its data.
    fun config(spec: VoiceSpec): OfflineTtsConfig {
        val model = spec.dir.onnx()!!.path
        val tokens = File(spec.dir, "tokens.txt").path
        val data = File(spec.dir, "espeak-ng-data").path
        val m = when (spec) {
            is VoiceSpec.Piper -> OfflineTtsModelConfig(
                vits = OfflineTtsVitsModelConfig(model = model, tokens = tokens, dataDir = data),
                numThreads = 2, provider = "cpu",
            )
            is VoiceSpec.Kokoro -> OfflineTtsModelConfig(
                kokoro = OfflineTtsKokoroModelConfig(model = model, voices = File(spec.dir, "voices.bin").path, tokens = tokens, dataDir = data, lang = "hi"),
                numThreads = 2, provider = "cpu",
            )
        }
        return OfflineTtsConfig(model = m)
    }

    private fun File.onnx(): File? = listFiles()?.firstOrNull { it.isFile && it.name.endsWith(".onnx") }
}
