package com.opuscube.munshi.voice

import com.k2fsa.sherpa.onnx.OfflineTts

/** Mono float PCM, the way sherpa-onnx returns it. */
class Pcm(val samples: FloatArray, val sampleRate: Int) {
    val durationMs: Long get() = if (sampleRate == 0) 0 else samples.size * 1000L / sampleRate
}

/** Text to audio. Blocking and slow: call it off the main thread. */
interface Synth {
    val id: String
    val label: String
    fun synth(text: String): Pcm
}

// The native engine loads on first use, so building one is cheap and a broken voice fails in synth().
class SherpaSynth(private val spec: VoiceSpec) : Synth {
    override val id: String get() = spec.id
    override val label: String get() = spec.label
    private val tts by lazy { OfflineTts(config = Voices.config(spec)) }
    override fun synth(text: String): Pcm = tts.generate(text, spec.sid, 1.0f).let { Pcm(it.samples, it.sampleRate) }
}
