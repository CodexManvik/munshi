package com.opuscube.munshi.voice.lab

import com.opuscube.munshi.voice.Line
import com.opuscube.munshi.voice.Pcm
import com.opuscube.munshi.voice.Player
import com.opuscube.munshi.voice.Speaker
import com.opuscube.munshi.voice.Synth
import com.opuscube.munshi.voice.VoiceRig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.withContext

// Real lines the server sends, Devanagari exactly as server/spoken.ts writes it (names stay Roman).
val LAB_LINES = listOf(
    Line("Suprabhat Ramesh ji! Aaj ke kaam sunaata hoon.", "सुप्रभात रमेश जी! आज के काम सुनाता हूँ।"),
    Line("Sharma ji ka ₹450 udhaar 12 din se baaki hai. Reminder bhej doon?", "Sharma ji का ₹450 उधार 12 दिन से बाकी है। रिमाइंडर भेज दूँ?"),
    Line("Sharma ji ne ₹450 chuka diye", "Sharma ji ने ₹450 चुका दिए"),
    Line("Shelf dekh li: Surf Excel 1kg aur Parle-G kam hain.", "शेल्फ़ देख ली: Surf Excel 1kg और Parle-G कम हैं।"),
    Line("₹50,000 aapke khaate mein aa gaye. Roz ₹400 settlement se katega.", "₹50,000 आपके खाते में आ गए। रोज़ ₹400 सेटलमेंट से कटेगा।"),
)

private const val MIN_AUDIO_MS = 300L

sealed interface LabStatus {
    data object Untested : LabStatus
    data object Testing : LabStatus
    data object Baseline : LabStatus
    data class Measured(val firstAudioMs: Long, val rtf: Double) : LabStatus
    data class NotSupported(val why: String) : LabStatus
}

data class LabRow(val id: String, val label: String, val status: LabStatus)

// "Awaaz jaanch": time every candidate voice on the real lines, play any line, so the team can pick one.
class VoiceLab(
    private val candidates: List<Synth>,
    private val player: Player,
    private val baseline: Speaker,
    private val lines: List<Line> = LAB_LINES,
    private val work: CoroutineDispatcher = Dispatchers.Default,
    private val nanos: () -> Long = System::nanoTime,
) {
    private val audio = mutableMapOf<Pair<String, Int>, Pcm>()
    private val _rows = MutableStateFlow(
        listOf(LabRow(VoiceRig.ANDROID_TTS, "Android TTS (hi-IN)", LabStatus.Baseline)) +
            candidates.map { LabRow(it.id, it.label, LabStatus.Untested) },
    )
    val rows: StateFlow<List<LabRow>> = _rows

    suspend fun measureAll() {
        for (c in candidates) {
            set(c.id, LabStatus.Testing)
            set(c.id, measure(c))
        }
    }

    suspend fun play(id: String, line: Int) {
        val l = lines[line]
        if (id == VoiceRig.ANDROID_TTS) { baseline.say(l); return }
        val c = candidates.firstOrNull { it.id == id } ?: return
        val pcm = audio[id to line] ?: synthOrNull(c, l.spoken!!) ?: return
        player.play(pcm)
    }

    fun stop() { player.stop(); baseline.stop() }

    // First audio = time to synthesise line 1 (we synthesise whole lines). RTF = synth time / audio time.
    private suspend fun measure(c: Synth): LabStatus {
        var synthMs = 0L; var audioMs = 0L; var firstMs = 0L
        lines.forEachIndexed { i, line ->
            val t0 = nanos()
            val pcm = try { withContext(work) { c.synth(line.spoken!!) } } catch (e: Throwable) {
                if (e is CancellationException) throw e
                return LabStatus.NotSupported(e.message ?: e.javaClass.simpleName)
            }
            val ms = (nanos() - t0) / 1_000_000
            if (pcm.durationMs < MIN_AUDIO_MS) return LabStatus.NotSupported("no speech for line ${i + 1}")
            if (i == 0) firstMs = ms
            synthMs += ms; audioMs += pcm.durationMs
            audio[c.id to i] = pcm
        }
        return LabStatus.Measured(firstMs, synthMs.toDouble() / audioMs)
    }

    private suspend fun synthOrNull(c: Synth, text: String): Pcm? = try { withContext(work) { c.synth(text) } } catch (e: Throwable) {
        if (e is CancellationException) throw e
        null
    }

    private fun set(id: String, s: LabStatus) = _rows.update { rows -> rows.map { if (it.id == id) it.copy(status = s) else it } }
}
