package com.opuscube.munshi

import android.Manifest
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import com.opuscube.munshi.api.MunshiJson
import com.opuscube.munshi.pairing.Config
import com.opuscube.munshi.pairing.parseConfig
import com.opuscube.munshi.service.MunshiService
import com.opuscube.munshi.ui.screens.MainScreen
import com.opuscube.munshi.ui.screens.PairScreen
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val permissions = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)   // counter mode
        val app = application as MunshiApp
        // Pairing without the camera, e.g. from adb: am start ... --es url http://10.0.2.2:3000 [--es key K]
        intent.getStringExtra("url")?.let { parseConfig(Config(it, intent.getStringExtra("key").orEmpty()).let { c -> MunshiJson.encodeToString(Config.serializer(), c) }) }
            ?.let { c -> lifecycleScope.launch { app.configs.save(c) } }
        permissions.launch(buildList {
            add(Manifest.permission.RECORD_AUDIO)
            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
        }.toTypedArray())
        MunshiService.start(this)
        setContent {
            val scope = rememberCoroutineScope()
            val graph by app.graph.collectAsStateWithLifecycle()
            val g = graph
            if (g == null) PairScreen { c -> scope.launch { app.configs.save(c) } }
            else MainScreen(g.conductor) { scope.launch { app.configs.clear() } }
        }
    }
}
