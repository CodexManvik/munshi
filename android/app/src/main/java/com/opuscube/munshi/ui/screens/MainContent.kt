package com.opuscube.munshi.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.opuscube.munshi.conductor.Mode
import com.opuscube.munshi.conductor.UiState
import com.opuscube.munshi.ui.components.*
import com.opuscube.munshi.ui.theme.Fraunces
import com.opuscube.munshi.ui.theme.Inter
import com.opuscube.munshi.ui.theme.Tokens
import com.opuscube.munshi.ui.theme.rupees

data class MainActions(
    val openShop: () -> Unit, val yes: () -> Unit, val no: () -> Unit,
    val mic: () -> Unit, val camera: () -> Unit, val week: () -> Unit, val repair: () -> Unit,
)

@Composable
fun MainContent(state: UiState, actions: MainActions, today: String, modifier: Modifier = Modifier, animate: Boolean = true) {
    // Paper fills the whole screen; the page and the dock stay inside the safe area, clear of the status bar,
    // the three-button navigation bar and any cutout (Android 15+ draws apps edge to edge).
    BoxWithConstraints(modifier.fillMaxSize().background(Tokens.Paper).windowInsetsPadding(WindowInsets.safeDrawing)) {
        val wide = maxWidth >= 720.dp && maxWidth > maxHeight
        if (wide) {
            Row(Modifier.fillMaxSize()) {
                LedgerPage(Modifier.weight(1.45f)) { Page(state, actions, today, k = 1.3f, animate = animate) }
                InkDock(Modifier.weight(1f).fillMaxHeight().padding(10.dp)) { Spacer(Modifier.weight(1f)); Dock(state, actions) }
            }
        } else {
            LedgerPage {
                Page(state, actions, today, bottomPad = 190.dp, animate = animate)
                InkDock(Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(Tokens.SpaceDockInset.dp)) { Dock(state, actions) }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun Page(s: UiState, a: MainActions, today: String, bottomPad: Dp = 24.dp, k: Float = 1f, animate: Boolean = true) {
    Column(Modifier.fillMaxSize().padding(start = Tokens.SpacePageXWithMargin.dp, end = Tokens.SpacePageX.dp, top = 20.dp, bottom = bottomPad)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Munshi", Modifier.combinedClickable(onClick = {}, onLongClick = a.repair), fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Tokens.Ink)
            Text(" •", fontSize = 15.sp, color = Tokens.Red)
            Spacer(Modifier.weight(1f))
            s.ledger?.let { WeekChip(it.total, flash = s.stamp != null, onClick = a.week) }
        }
        s.banner?.let { Spacer(Modifier.height(10.dp)); Banner(it) }
        Spacer(Modifier.height(30.dp))
        Box(Modifier.fillMaxWidth()) {
            Column {
                when {
                    s.ask != null -> AskBlock(s, k)
                    s.stamp != null -> PaidBlock(s, today, k, animate)
                    !s.shopOpen -> BriefBlock(s, k)
                    else -> s.caption?.let { Text(it.text, fontFamily = Fraunces, fontStyle = FontStyle.Italic, fontSize = (Tokens.TypeLineSize * k).sp, lineHeight = (Tokens.TypeLineSize * Tokens.TypeLineHeight * k).sp, color = Tokens.Ink) }
                }
            }
            // A payment often lands while the next question is already up: stamp the corner of the page.
            if (s.stamp != null && s.ask != null) {
                // Below the "who" line, beside the ₹ figure, so it never covers words.
                ChukaDiyaStamp(today, Modifier.align(Alignment.TopEnd).padding(top = (68 * k).dp, end = 6.dp), animate = animate)
            }
        }
        s.payQr?.let { Spacer(Modifier.height(18.dp)); QrCard(it.url, it.name, it.amount) }
    }
}

// k scales the type up on the wide tablet page, where phone sizes look lost.
@Composable
private fun AskBlock(s: UiState, k: Float) {
    val ask = s.ask ?: return
    Kicker("Munshi bol raha hai", speaking = s.mode == Mode.Speaking)
    val d = ask.display
    if (d != null) {
        Spacer(Modifier.height(20.dp))
        Text(d.who, fontFamily = Fraunces, fontSize = (Tokens.TypeWhoSize * k).sp, color = Tokens.Ink2)
        RupeeFigure(d.amount, size = (Tokens.TypeRupeeSize * k).sp)
        Spacer(Modifier.height(10.dp))
        Text(d.rest, fontFamily = Fraunces, fontStyle = FontStyle.Italic, fontSize = (Tokens.TypeLineSize * k).sp, lineHeight = (Tokens.TypeLineSize * Tokens.TypeLineHeight * k).sp, color = Tokens.Ink)
    } else {
        Spacer(Modifier.height(16.dp))
        Text(ask.line.text, fontFamily = Fraunces, fontStyle = FontStyle.Italic, fontSize = (22 * k).sp, lineHeight = (30 * k).sp, color = Tokens.Ink)
    }
}

@Composable
private fun PaidBlock(s: UiState, today: String, k: Float, animate: Boolean) {
    val st = s.stamp ?: return
    Box(Modifier.fillMaxWidth()) {
        Column {
            Kicker("Payment aaya")
            Spacer(Modifier.height(20.dp))
            Text("${st.name} ne", fontFamily = Fraunces, fontSize = (Tokens.TypeWhoSize * k).sp, color = Tokens.Ink2)
            RupeeFigure(st.amount, size = (Tokens.TypeRupeeSize * k).sp)
            Spacer(Modifier.height(10.dp))
            Text("chuka diye. Hisaab barabar.", fontFamily = Fraunces, fontStyle = FontStyle.Italic, fontSize = (Tokens.TypeLineSize * k).sp, color = Tokens.Ink)
        }
        ChukaDiyaStamp(today, Modifier.align(Alignment.TopEnd).padding(top = 40.dp, end = 6.dp), animate = animate)
    }
}

@Composable
private fun BriefBlock(s: UiState, k: Float) {
    Kicker("Subah ka hisaab")
    Spacer(Modifier.height(16.dp))
    Text("Shubh prabhat,\nRamesh ji.", fontFamily = Fraunces, fontSize = (26 * k).sp, lineHeight = (30 * k).sp, letterSpacing = (-0.01).em, color = Tokens.Ink)
    val b = s.brief ?: return
    Spacer(Modifier.height(8.dp))
    Text("Aaj ${b.items.size} kaam hain, kul", fontFamily = Fraunces, fontStyle = FontStyle.Italic, fontSize = (15 * k).sp, color = Tokens.Ink)
    RupeeFigure(b.total, size = (52 * k).sp)
    Spacer(Modifier.height(12.dp))
    b.items.forEach { item ->
        Row(Modifier.fillMaxWidth().padding(vertical = 9.dp), verticalAlignment = Alignment.Bottom) {
            Text(item.title, Modifier.weight(1f), fontFamily = Inter, fontSize = (12 * k).sp, color = Tokens.Ink)
            Text(rupees(item.amount), fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = (15 * k).sp, color = Tokens.Ink)
        }
    }
}

@Composable
private fun ColumnScope.Dock(s: UiState, a: MainActions) {
    DockStatus(s.mode, s.heard, s.live, s.mind)
    if (!s.shopOpen && s.ask == null) {
        HaanButton(enabled = s.live, onClick = a.openShop, modifier = Modifier.fillMaxWidth(), label = "Dukaan kholo")
    } else {
        val canAnswer = s.ask != null && s.live
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            HaanButton(canAnswer, a.yes, Modifier.weight(1.6f))
            NahiButton(canAnswer, a.no, Modifier.weight(1f))
        }
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
        Text("◉  Boliye", Modifier.clickable(onClick = a.mic).padding(horizontal = 14.dp, vertical = 6.dp),
            fontFamily = Inter, fontSize = 10.sp, color = Tokens.Ink3)
        Text("▣  Shelf photo", Modifier.clickable(onClick = a.camera).padding(horizontal = 14.dp, vertical = 6.dp),
            fontFamily = Inter, fontSize = 10.sp, color = Tokens.Ink3)
    }
}
