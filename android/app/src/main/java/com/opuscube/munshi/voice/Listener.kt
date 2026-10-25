package com.opuscube.munshi.voice

interface Listener {
    val available: Boolean
    /** Listens once; returns the final transcript, or null on silence, error or timeout. */
    suspend fun listen(windowMs: Long, onPartial: (String) -> Unit): String?
}
