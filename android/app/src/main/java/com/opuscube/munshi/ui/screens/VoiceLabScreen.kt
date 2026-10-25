package com.opuscube.munshi.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.opuscube.munshi.ui.components.LedgerPage
import com.opuscube.munshi.ui.theme.Fraunces
import com.opuscube.munshi.ui.theme.Inter
import com.opuscube.munshi.ui.theme.Tokens
import com.opuscube.munshi.voice.VoiceRig
import com.opuscube.munshi.voice.lab.LAB_LINES
import com.opuscube.munshi.voice.lab.LabRow
import com.opuscube.munshi.voice.lab.LabStatus
import com.opuscube.munshi.voice.lab.VoiceLab
import kotlinx.coroutines.launch
import java.util.Locale

data class LabActions(val measure: () -> Unit, val play: (String, Int) -> Unit, val choose: (String) -> Unit, val close: () -> Unit)

@Composable
fun VoiceLabScreen(rows: List<LabRow>, chosen: String, busy: Boolean, a: LabActions) {
    LedgerPage {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                .padding(start = Tokens.SpacePageXWithMargin.dp, end = Tokens.SpacePageX.dp, top = 28.dp, bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Awaaz jaanch", Modifier.weight(1f), fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 26.sp, color = Tokens.Ink)
                Pill("Band karo", filled = false, onClick = a.close)
            }
            Text("Har awaaz hamari asli lines bolti hai. Suniye, phir chuniye.", fontFamily = Inter, fontSize = 13.sp, color = Tokens.Ink2)
            LAB_LINES.forEachIndexed { i, l ->
                Text("${i + 1}. ${l.text}", fontFamily = Inter, fontSize = 12.sp, color = Tokens.Ink3)
            }
            Pill(if (busy) "Jaanch rahe hain…" else "Sab jaancho", filled = true, onClick = { if (!busy) a.measure() })
            rows.forEach { r -> LabRowView(r, r.id == chosen, a) }
        }
    }
}

@Composable
private fun LabRowView(r: LabRow, chosen: Boolean, a: LabActions) {
    Column(
        Modifier.fillMaxWidth().border(BorderStroke(1.dp, if (chosen) Tokens.Red else Tokens.Rule), RoundedCornerShape(Tokens.RadiusCard.dp)).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(r.label, fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, color = Tokens.Ink)
        Text(statusText(r.status), fontFamily = Inter, fontSize = 12.sp, color = if (r.status is LabStatus.NotSupported) Tokens.Red else Tokens.Ink2)
        if (r.status !is LabStatus.NotSupported) Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            LAB_LINES.indices.forEach { i -> Pill("${i + 1}", filled = false) { a.play(r.id, i) } }
            Spacer(Modifier.weight(1f))
            Pill(if (chosen) "Chuni hui ✓" else "Chuno", filled = chosen) { a.choose(r.id) }
        }
    }
}

@Composable
private fun Pill(text: String, filled: Boolean, onClick: () -> Unit) {
    Text(
        text,
        Modifier.border(BorderStroke(1.dp, if (filled) Tokens.Red else Tokens.Rule), RoundedCornerShape(Tokens.RadiusPill.dp))
            .clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 6.dp),
        fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = Tokens.TypeChipSize.sp,
        color = if (filled) Tokens.Red else Tokens.Ink,
    )
}

private fun statusText(s: LabStatus): String = when (s) {
    LabStatus.Baseline -> "Phone ki apni awaaz (aaj wali)"
    LabStatus.Untested -> "Abhi jaancha nahi"
    LabStatus.Testing -> "Jaanch rahe hain…"
    is LabStatus.Measured -> "Pehli awaaz ${s.firstAudioMs} ms · RTF ${String.format(Locale.US, "%.2f", s.rtf)}"
    is LabStatus.NotSupported -> "Nahi chalta: ${s.why}"
}

@Composable
fun VoiceLabRoute(rig: VoiceRig, onClose: () -> Unit) {
    val scope = rememberCoroutineScope()
    val lab = remember { VoiceLab(rig.specs().map(rig::synth), rig.player, rig.android) }
    val rows by lab.rows.collectAsStateWithLifecycle()
    val chosen by rig.store.choice.collectAsStateWithLifecycle(null)
    var busy by remember { mutableStateOf(false) }
    val close = { lab.stop(); onClose() }
    BackHandler(onBack = close)
    VoiceLabScreen(rows, chosen ?: rig.speaker.voiceId ?: VoiceRig.ANDROID_TTS, busy, LabActions(
        measure = { scope.launch { busy = true; try { lab.measureAll() } finally { busy = false } } },
        play = { id, i -> scope.launch { lab.stop(); lab.play(id, i) } },
        choose = { id -> scope.launch { rig.store.choose(id) } },
        close = close,
    ))
}
