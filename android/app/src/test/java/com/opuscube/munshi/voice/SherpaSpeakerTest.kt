package com.opuscube.munshi.voice

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class FakeSynth(override val id: String = "v", var fail: Boolean = false, var samples: Int = 16_000) : Synth {
    override val label = "Fake"
    val calls = mutableListOf<String>()
    override fun synth(text: String): Pcm { calls += text; if (fail) error("boom"); return Pcm(FloatArray(samples), 16_000) }
}

class FakePlayer : Player {
    val played = mutableListOf<Int>()
    var stops = 0
    override suspend fun play(pcm: Pcm) { played += pcm.samples.size }
    override fun stop() { stops++ }
}

class RecordingSpeaker : Speaker {
    val said = mutableListOf<String>()
    var stops = 0
    override suspend fun say(line: Line) { said += line.text }
    override fun stop() { stops++ }
}

class SherpaSpeakerTest {
    private val synth = FakeSynth()
    private val player = FakePlayer()
    private val fallback = RecordingSpeaker()
    private val speaker = SherpaSpeaker(player, fallback, Dispatchers.Unconfined).also { it.use(synth) }
    private val greet = Line("Suprabhat Ramesh ji!", "सुप्रभात रमेश जी!")

    @Test fun `speaks the Devanagari line through the voice`() = runTest {
        speaker.say(greet)
        assertEquals(listOf("सुप्रभात रमेश जी!"), synth.calls)
        assertEquals(listOf(16_000), player.played)
        assertEquals(emptyList<String>(), fallback.said)
    }

    @Test fun `the same line is synthesised once`() = runTest {
        speaker.say(greet); speaker.say(greet)
        assertEquals(1, synth.calls.size)
        assertEquals(2, player.played.size)
    }

    @Test fun `prewarm synthesises without playing`() = runTest {
        speaker.prewarm(listOf(greet, Line("Roman only")))
        assertEquals(1, synth.calls.size)
        assertEquals(emptyList<Int>(), player.played)
        speaker.say(greet)
        assertEquals(1, synth.calls.size)
    }

    @Test fun `a line without Devanagari goes to the fallback`() = runTest {
        speaker.say(Line("Roman only"))
        assertEquals(listOf("Roman only"), fallback.said)
        assertEquals(emptyList<String>(), synth.calls)
    }

    @Test fun `a synth failure or silence goes to the fallback`() = runTest {
        synth.fail = true
        speaker.say(greet)
        synth.fail = false; synth.samples = 0
        speaker.say(Line("Theek hai", "ठीक है"))
        assertEquals(listOf("Suprabhat Ramesh ji!", "Theek hai"), fallback.said)
        assertEquals(emptyList<Int>(), player.played)
    }

    @Test fun `no voice chosen means the fallback speaks`() = runTest {
        speaker.use(null)
        speaker.say(greet)
        assertEquals(listOf("Suprabhat Ramesh ji!"), fallback.said)
        assertEquals(null, speaker.voiceId)
    }

    @Test fun `stop silences both`() {
        speaker.stop()
        assertEquals(1, player.stops)
        assertEquals(1, fallback.stops)
    }
}
