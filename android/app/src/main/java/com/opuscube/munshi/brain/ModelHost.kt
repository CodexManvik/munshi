package com.opuscube.munshi.brain

import android.app.ActivityManager
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.SystemClock
import android.util.Log
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.ExperimentalApi
import com.google.ai.edge.litertlm.ExperimentalFlags
import com.google.ai.edge.litertlm.SamplerConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import java.io.File

// The model on this phone: picks E4B or E2B by memory, takes a file pushed by adb or downloads it on
// Wi-Fi, loads it once (GPU, else CPU) and serves one generation at a time.
class ModelHost(private val context: Context, private val scope: CoroutineScope, private val http: OkHttpClient) {
    private val _state = MutableStateFlow<BrainState>(BrainState.Missing)
    val state: StateFlow<BrainState> = _state
    private val dir = File(context.filesDir, "models")
    private val lock = Mutex()
    @Volatile private var engine: Engine? = null
    private var backendName = "?"

    val llm: Llm = object : Llm {
        override suspend fun generate(system: String, user: String, image: ByteArray?): String = lock.withLock {
            withContext(Dispatchers.IO) {
                val t0 = SystemClock.elapsedRealtime()
                run(system, user, image).also {
                    Log.i(TAG, "${SystemClock.elapsedRealtime() - t0} ms · $backendName · ${if (image != null) "image + " else ""}${user.take(40)}")
                }
            }
        }
    }

    fun start() { scope.launch(Dispatchers.IO) { prepare() } }

    private suspend fun prepare() {
        val m = Models.forRam(totalRam()) ?: run { _state.value = BrainState.Unsupported; return }
        dir.mkdirs()
        val file = File(dir, m.name)
        if (!file.isFile) {
            if (!onUnmeteredNetwork()) { _state.value = BrainState.Missing; return }   // next start on Wi-Fi, or adb push
            if (dir.usableSpace < m.bytes + 500_000_000) { _state.value = BrainState.Failed("not enough space"); return }
            var shown = -1L
            val ok = ModelDownloader(http).fetch(m, file) { done, total ->
                if (done - shown >= 20_000_000 || done == total) { shown = done; _state.value = BrainState.Downloading(done, total) }
            }
            if (!ok) { _state.value = BrainState.Failed("download"); return }
        }
        _state.value = BrainState.Loading
        engine = load(file)
        _state.value = if (engine != null) BrainState.Ready else BrainState.Failed("load")
        Log.i(TAG, "model ${m.name} → ${_state.value} on $backendName")
    }

    @OptIn(ExperimentalApi::class)
    private fun load(file: File): Engine? {
        ExperimentalFlags.enableSpeculativeDecoding = true
        for ((name, backend) in listOf("gpu" to Backend.GPU(), "cpu" to Backend.CPU())) {
            val e = runCatching {
                Engine(EngineConfig(modelPath = file.path, backend = backend, visionBackend = backend, maxNumImages = 1, cacheDir = context.cacheDir.path))
                    .also { it.initialize() }
            }.onFailure { Log.w(TAG, "$name backend failed", it) }.getOrNull()
            if (e != null) { backendName = name; return e }
        }
        return null
    }

    // A fresh conversation per call: no history leaks between questions or customers.
    private fun run(system: String, user: String, image: ByteArray?): String {
        val e = engine ?: error("model not ready")
        val config = ConversationConfig(
            systemInstruction = Contents.of(system),
            samplerConfig = SamplerConfig(topK = 40, topP = 0.95, temperature = 0.3),
            maxOutputToken = 256,
        )
        return e.createConversation(config).use { c ->
            val input = if (image != null) Contents.of(Content.ImageBytes(image), Content.Text(user)) else Contents.of(user)
            c.sendMessage(input).contents.contents.filterIsInstance<Content.Text>().joinToString("") { it.text }
        }
    }

    private fun totalRam(): Long =
        ActivityManager.MemoryInfo().also { context.getSystemService(ActivityManager::class.java).getMemoryInfo(it) }.totalMem

    private fun onUnmeteredNetwork(): Boolean {
        val cm = context.getSystemService(ConnectivityManager::class.java)
        return cm.getNetworkCapabilities(cm.activeNetwork)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED) == true
    }

    private companion object { const val TAG = "MunshiBrain" }
}
