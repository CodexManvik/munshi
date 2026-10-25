package com.opuscube.munshi.voice

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

// The bundled Hindi voice. One FIFO queue like AndroidSpeaker; it speaks the Devanagari line and hands
// anything it cannot say (no Devanagari, no voice, a native error, silence) to the fallback speaker.
class SherpaSpeaker(
    private val player: Player,
    private val fallback: Speaker,
    private val work: CoroutineDispatcher = Dispatchers.Default,
    private val cacheSize: Int = 40,
) : Speaker {
    @Volatile private var synth: Synth? = null
    private val queue = Mutex()
    private val synthLock = Mutex()   // one native engine, one sentence at a time
    private val cache = LinkedHashMap<String, Pcm>(16, 0.75f, true)

    val voiceId: String? get() = synth?.id

    /** Switches voice (null = fallback only) and drops audio made with the old one. */
    fun use(s: Synth?) { synth = s; synchronized(cache) { cache.clear() } }

    override suspend fun say(line: Line) = queue.withLock {
        val pcm = line.spoken?.let { pcmOrNull(it) }
        if (pcm == null) fallback.say(line) else player.play(pcm)
    }

    override suspend fun prewarm(lines: List<Line>) { for (l in lines) l.spoken?.let { pcmOrNull(it) } }

    override fun stop() { player.stop(); fallback.stop() }

    private suspend fun pcmOrNull(text: String): Pcm? {
        val s = synth ?: return null
        synchronized(cache) { cache[text] }?.let { return it }
        val pcm = try {
            synthLock.withLock { withContext(work) { s.synth(text) } }
        } catch (e: Throwable) {
            if (e is CancellationException) throw e
            return null   // includes UnsatisfiedLinkError from a device without the native library
        }
        if (pcm.samples.isEmpty()) return null
        synchronized(cache) {
            cache[text] = pcm
            if (cache.size > cacheSize) cache.remove(cache.keys.first())
        }
        return pcm
    }
}
