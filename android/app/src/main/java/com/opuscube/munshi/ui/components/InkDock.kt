package com.opuscube.munshi.ui.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.opuscube.munshi.conductor.Mode
import com.opuscube.munshi.ui.theme.Inter
import com.opuscube.munshi.ui.theme.Tokens

@Composable
fun InkDock(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(Tokens.RadiusDock.dp)
    Column(
        modifier.shadow(18.dp, shape).background(Tokens.Ink, shape).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        content = content,
    )
}

@Composable
fun HaanButton(enabled: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier, label: String = "✓  Haan") {
    val shape = RoundedCornerShape(Tokens.RadiusButton.dp)
    Box(
        modifier.height(54.dp).alpha(if (enabled) 1f else 0.4f)
            .background(Brush.verticalGradient(listOf(Tokens.RedTop, Tokens.RedBottom)), shape)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Text(label, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = Tokens.TypeButtonSize.sp, color = Tokens.Ivory) }
}

@Composable
fun NahiButton(enabled: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(Tokens.RadiusButton.dp)
    Box(
        modifier.height(54.dp).alpha(if (enabled) 1f else 0.4f).border(BorderStroke(1.dp, Tokens.DockLine), shape)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Text("Nahi", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = Tokens.Ivory) }
}

@Composable
fun DockStatus(mode: Mode, heard: String?, live: Boolean, mind: String? = null) {
    val text = when {
        !live -> "Jud raha hai…"
        mode == Mode.Listening -> heard?.let { "“$it”" } ?: "Sun raha hoon…"
        mode == Mode.Working -> "Kar raha hoon…"
        heard != null -> "Aapne kaha: “$heard”"
        mind != null -> mind
        else -> null
    } ?: return
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
        if (mode == Mode.Listening && live) { Wave(); Spacer(Modifier.width(8.dp)) }
        if (!live) { Box(Modifier.size(6.dp).background(Tokens.RedOnInk, RoundedCornerShape(3.dp))); Spacer(Modifier.width(6.dp)) }
        Text(text, fontFamily = Inter, fontSize = 11.sp, color = Tokens.Ink3, maxLines = 1)
    }
}

@Composable
private fun Wave() {
    val t = rememberInfiniteTransition(label = "wave")
    Row(Modifier.height(14.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
        repeat(7) { i ->
            val h by t.animateFloat(3f, 14f, infiniteRepeatable(tween(550, delayMillis = (i % 3) * 140), RepeatMode.Reverse), label = "w$i")
            Box(Modifier.width(2.dp).height(h.dp).background(Tokens.RedOnInk, RoundedCornerShape(1.dp)))
        }
    }
}
