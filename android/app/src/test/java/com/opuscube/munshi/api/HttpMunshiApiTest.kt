package com.opuscube.munshi.api

import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class HttpMunshiApiTest {
    private val server = MockWebServer()
    private lateinit var api: HttpMunshiApi

    @Before fun up() { server.start(); api = HttpMunshiApi(server.url("/").toString().trimEnd('/'), "k1", OkHttpClient()) }
    @After fun down() = server.shutdown()

    @Test fun `next posts scope and sends the demo key`() = runTest {
        server.enqueue(MockResponse().setBody("""{"id":3,"line":"x","display":{"who":"a","amount":1,"rest":"b"}}"""))
        val n = api.next(scope = "all", interrupt = true)
        val req = server.takeRequest()
        assertEquals("/api/next", req.path)
        assertEquals("k1", req.getHeader("x-demo-key"))
        assertEquals("""{"scope":"all","interrupt":true}""", req.body.readUtf8())
        assertEquals(3L, n.id)
    }

    @Test fun `server errors become ApiError with the status and message`() = runTest {
        server.enqueue(MockResponse().setResponseCode(409).setBody("""{"error":"not_proposed"}"""))
        val e = runCatching { api.confirm(5) }.exceptionOrNull() as ApiError
        assertEquals(409, e.status)
        assertEquals("not_proposed", e.message)
        assertEquals("/api/opportunities/5/confirm", server.takeRequest().path)
    }
}
