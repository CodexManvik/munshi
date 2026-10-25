package com.opuscube.munshi.voice

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class VoicesTest {
    @get:Rule val tmp = TemporaryFolder()
    private val root by lazy { File(tmp.root, "voices").apply { mkdirs() } }

    private fun voiceDir(name: String, onnx: String, vararg extra: String) = File(root, name).apply {
        mkdirs()
        File(this, onnx).writeText("m")
        File(this, "tokens.txt").writeText("t")
        File(this, "espeak-ng-data").mkdirs()
        extra.forEach { File(this, it).writeText("x") }
    }

    @Test fun `finds Piper Hindi voices in name order and skips incomplete or other folders`() {
        voiceDir("vits-piper-hi_IN-rohan-medium-fp16", "hi_IN-rohan-medium.onnx")
        voiceDir("vits-piper-hi_IN-pratham-medium-fp16", "hi_IN-pratham-medium.onnx")
        voiceDir("vits-piper-en_US-lessac-medium", "en_US-lessac-medium.onnx")
        File(root, "vits-piper-hi_IN-broken").apply { mkdirs(); File(this, "x.onnx").writeText("m") }   // no tokens
        val found = Voices.discover(root)
        assertEquals(listOf("vits-piper-hi_IN-pratham-medium-fp16", "vits-piper-hi_IN-rohan-medium-fp16"), found.map { it.id })
        assertEquals("Piper · pratham", found[0].label)
        assertEquals(0, found[0].sid)
    }

    @Test fun `a Kokoro folder gives one spec per Hindi speaker`() {
        voiceDir("kokoro-int8-multi-lang-v1_0", "model.int8.onnx", "voices.bin")
        val found = Voices.discover(root)
        assertEquals(listOf("kokoro-int8-multi-lang-v1_0#31", "kokoro-int8-multi-lang-v1_0#33"), found.map { it.id })
        assertEquals(listOf("Kokoro · hf_alpha", "Kokoro · hm_omega"), found.map { it.label })
        assertEquals(listOf(31, 33), found.map { it.sid })
    }

    @Test fun `a missing folder finds nothing`() {
        assertTrue(Voices.discover(File(tmp.root, "nope")).isEmpty())
        assertTrue(Voices.discover(null).isEmpty())
    }

    @Test fun `Piper config points at the model, tokens and espeak data`() {
        val d = voiceDir("vits-piper-hi_IN-pratham-medium-fp16", "hi_IN-pratham-medium.onnx")
        val c = Voices.config(Voices.discover(root).single())
        assertEquals(File(d, "hi_IN-pratham-medium.onnx").path, c.model.vits.model)
        assertEquals(File(d, "tokens.txt").path, c.model.vits.tokens)
        assertEquals(File(d, "espeak-ng-data").path, c.model.vits.dataDir)
        assertEquals(2, c.model.numThreads)
    }

    @Test fun `Kokoro config asks espeak for Hindi`() {
        val d = voiceDir("kokoro-int8-multi-lang-v1_0", "model.int8.onnx", "voices.bin")
        val c = Voices.config(Voices.discover(root).first())
        assertEquals(File(d, "model.int8.onnx").path, c.model.kokoro.model)
        assertEquals(File(d, "voices.bin").path, c.model.kokoro.voices)
        assertEquals("hi", c.model.kokoro.lang)
    }

    @Test fun `audio duration comes from samples and rate`() {
        assertEquals(1500L, Pcm(FloatArray(24_000), 16_000).durationMs)
        assertEquals(0L, Pcm(FloatArray(0), 0).durationMs)
    }
}
