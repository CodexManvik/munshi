package com.opuscube.munshi

import android.app.Application
import com.opuscube.munshi.api.HttpMunshiApi
import com.opuscube.munshi.api.SoundboxEvent
import com.opuscube.munshi.conductor.Conductor
import com.opuscube.munshi.conductor.Mode
import com.opuscube.munshi.events.EventStream
import com.opuscube.munshi.pairing.Config
import com.opuscube.munshi.pairing.ConfigStore
import com.opuscube.munshi.ui.theme.Tokens
import com.opuscube.munshi.voice.AndroidListener
import com.opuscube.munshi.voice.AndroidSpeaker
import com.opuscube.munshi.voice.Chime
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.runningFold
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

// Everything one paired server needs, wired by hand. Re-pairing builds a new Graph.
class Graph(val config: Config, app: Application, scope: CoroutineScope) {
    private val http = OkHttpClient.Builder().connectTimeout(10, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS).build()
    private val sse = http.newBuilder().readTimeout(0, TimeUnit.MILLISECONDS).build()
    val events = EventStream(config.url, config.key, sse)
    val conductor = Conductor(HttpMunshiApi(config.url, config.key, http), AndroidSpeaker(app), AndroidListener(app), scope, Tokens.MotionListenWindowMs)
    private val job = scope.launch {
        launch { events.live.collect(conductor::onLive) }
        // Soft tick each time Munshi starts listening (spec §5).
        launch { conductor.state.map { it.mode == Mode.Listening }.distinctUntilChanged().filter { it }.collect { Chime.tick() } }
        events.events().collect { e -> if (e is SoundboxEvent.Paid) Chime.payment(); conductor.onEvent(e) }
    }
    init { conductor.start() }
    fun close() = job.cancel()
}

class MunshiApp : Application() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    lateinit var configs: ConfigStore
    val graph: StateFlow<Graph?> by lazy {
        configs.config.distinctUntilChanged()
            .runningFold<Config?, Graph?>(null) { old, c -> old?.close(); c?.let { Graph(it, this, scope) } }
            .stateIn(scope, SharingStarted.Eagerly, null)
    }
    override fun onCreate() { super.onCreate(); configs = ConfigStore(this) }
}
