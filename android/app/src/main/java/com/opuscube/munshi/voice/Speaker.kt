package com.opuscube.munshi.voice

interface Speaker {
    /** Speaks after anything already queued; returns when done or stopped. */
    suspend fun say(line: Line)
    /** Stops the current utterance (barge-in). Queued lines still play. */
    fun stop()
}
