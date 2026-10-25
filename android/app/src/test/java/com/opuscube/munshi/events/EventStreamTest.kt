package com.opuscube.munshi.events

import com.opuscube.munshi.api.SoundboxEvent
import kotlinx.coroutines.flow.take
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.concurrent.TimeUnit

class EventStreamTest {
    @Test fun `backoff grows to a 15 second ceiling`() {
        assertEquals(listOf(1000L, 2000L, 4000L, 8000L, 15000L, 15000L), (0..5).map(::backoffMs))
    }

    @Test fun `parses SSE data lines, skips comments and unknown types, reconnects after close`() = runBlocking {
        val server = MockWebServer().apply { start() }
        val sse = { body: String -> MockResponse().setHeader("content-type", "text/event-stream").setBody(body) }
        server.enqueue(sse(": connected\n\ndata: {\"type\":\"brief\"}\n\ndata: {\"type\":\"mystery\"}\n\n"))
        server.enqueue(sse("data: {\"type\":\"paid\",\"ref\":\"r1\",\"name\":\"Sharma ji\",\"amount\":450}\n\n"))
        val client = OkHttpClient.Builder().readTimeout(0, TimeUnit.MILLISECONDS).build()
        val stream = EventStream(server.url("/").toString().trimEnd('/'), "k", client, backoff = { 10L })
        val got = withTimeout(5000) { stream.events().take(2).toList() }
        assertEquals(listOf(SoundboxEvent.BriefCue, SoundboxEvent.Paid("r1", "Sharma ji", 450)), got)
        assertEquals("/api/events?key=k", server.takeRequest().path)
        server.shutdown()
    }
}
