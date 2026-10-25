package com.opuscube.munshi.voice

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

interface Player {
    /** Plays to the end, or until stop(). */
    suspend fun play(pcm: Pcm)
    fun stop()
}

class AudioTrackPlayer : Player {
    @Volatile private var track: AudioTrack? = null

    override suspend fun play(pcm: Pcm) = withContext(Dispatchers.IO) {
        val min = AudioTrack.getMinBufferSize(pcm.sampleRate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_FLOAT)
        val t = AudioTrack.Builder()
            .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_FLOAT).setSampleRate(pcm.sampleRate).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
            .setTransferMode(AudioTrack.MODE_STREAM)
            .setBufferSizeInBytes(maxOf(min, 8192))
            .build()
        track = t
        try {
            t.play()
            var off = 0
            while (off < pcm.samples.size && track === t) {
                val n = t.write(pcm.samples, off, minOf(4096, pcm.samples.size - off), AudioTrack.WRITE_BLOCKING)
                if (n <= 0) break
                off += n
            }
            // write() returns once the data is buffered; wait for the speaker to actually reach the end.
            withTimeoutOrNull(pcm.durationMs + 1000) {
                while (track === t && t.playbackHeadPosition < pcm.samples.size) delay(20)
            }
        } finally {
            runCatching { t.stop() }
            t.release()
            if (track === t) track = null
        }
        Unit
    }

    override fun stop() {
        val t = track ?: return
        track = null
        runCatching { t.pause(); t.flush() }
    }
}
