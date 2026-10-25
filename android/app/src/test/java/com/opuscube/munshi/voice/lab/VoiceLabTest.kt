package com.opuscube.munshi.voice.lab

import com.opuscube.munshi.voice.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class VoiceLabTest {
    private var clock = 0L
    // Every synth call "takes" 100 ms and returns 1 s of audio.
    private fun timed(id: String) = object : Synth {
        override val id = id
        override val label = "Voice $id"
        var calls = 0
        override fun synth(text: String): Pcm { calls++; clock += 100_000_000; return Pcm(FloatArray(16_000), 16_000) }
    }
    private val player = FakePlayer()
    private val baseline = RecordingSpeaker()

    @Test fun `rows start with the phone voice and untested candidates`() {
        val lab = VoiceLab(listOf(timed("a")), player, baseline, work = Dispatchers.Unconfined) { clock }
        assertEquals(listOf("android-tts" to LabStatus.Baseline, "a" to LabStatus.Untested), lab.rows.value.map { it.id to it.status })
    }

    @Test fun `measuring reports first audio time and real-time factor`() = runTest {
        val lab = VoiceLab(listOf(timed("a")), player, baseline, work = Dispatchers.Unconfined) { clock }
        lab.measureAll()
        assertEquals(LabStatus.Measured(firstAudioMs = 100, rtf = 0.1), lab.rows.value[1].status)
    }

    @Test fun `a voice that throws or stays silent is not supported`() = runTest {
        val broken = FakeSynth("b", fail = true)
        val silent = FakeSynth("s", samples = 100)
        val lab = VoiceLab(listOf(broken, silent), player, baseline, work = Dispatchers.Unconfined) { clock }
        lab.measureAll()
        assertEquals(LabStatus.NotSupported("boom"), lab.rows.value[1].status)
        assertEquals(LabStatus.NotSupported("no speech for line 1"), lab.rows.value[2].status)
    }

    @Test fun `play uses measured audio and the phone voice speaks the baseline`() = runTest {
        val a = timed("a")
        val lab = VoiceLab(listOf(a), player, baseline, work = Dispatchers.Unconfined) { clock }
        lab.measureAll()
        lab.play("a", 2)
        assertEquals(LAB_LINES.size, a.calls)
        assertEquals(listOf(16_000), player.played)
        lab.play("android-tts", 0)
        assertEquals(listOf(LAB_LINES[0].text), baseline.said)
    }
}
