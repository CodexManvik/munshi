package com.opuscube.munshi.events

import com.opuscube.munshi.api.SoundboxEvent
import com.opuscube.munshi.api.parseEvent
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.channels.trySendBlocking
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.channelFlow
import kotlinx.coroutines.isActive
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import java.net.URLEncoder

fun backoffMs(attempt: Int): Long = minOf(15_000L, 1000L shl minOf(attempt, 4))

// The server's live feed: announcements, payments, cues from /control. Reconnects forever
// with backoff; `live` drives the "Jud raha hai…" dot.
class EventStream(
    private val baseUrl: String,
    private val key: String,
    private val client: OkHttpClient,
    private val backoff: (Int) -> Long = ::backoffMs,
) {
    private val _live = MutableStateFlow(false)
    val live: StateFlow<Boolean> = _live

    fun events(): Flow<SoundboxEvent> = channelFlow {
        var attempt = 0
        while (isActive) {
            val closed = CompletableDeferred<Unit>()
            val req = Request.Builder().url("$baseUrl/api/events?key=${URLEncoder.encode(key, "UTF-8")}").build()
            val source = EventSources.createFactory(client).newEventSource(req, object : EventSourceListener() {
                override fun onOpen(eventSource: EventSource, response: Response) { _live.value = true; attempt = 0 }
                override fun onEvent(eventSource: EventSource, id: String?, type: String?, data: String) {
                    parseEvent(data)?.let { trySendBlocking(it) }
                }
                override fun onClosed(eventSource: EventSource) { _live.value = false; closed.complete(Unit) }
                override fun onFailure(eventSource: EventSource, t: Throwable?, response: Response?) { _live.value = false; closed.complete(Unit) }
            })
            try { closed.await() } finally { source.cancel() }
            delay(backoff(attempt++))
        }
    }
}
