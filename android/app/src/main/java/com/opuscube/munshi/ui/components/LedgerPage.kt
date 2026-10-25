package com.opuscube.munshi.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.unit.dp
import com.opuscube.munshi.ui.theme.Tokens

// Ivory paper with faint ruled lines and the red margin line, as in the deck.
@Composable
fun LedgerPage(modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    Box(
        modifier.fillMaxSize().background(Tokens.Paper).drawBehind {
            val step = Tokens.SpaceRuleStep.dp.toPx()
            val hair = 1.dp.toPx()
            var y = step
            while (y < size.height) { drawLine(Tokens.Rule, Offset(0f, y), Offset(size.width, y), hair); y += step }
            val x = Tokens.SpaceMarginLineX.dp.toPx()
            drawLine(Tokens.MarginLine, Offset(x, 0f), Offset(x, size.height), hair)
        },
        content = content,
    )
}
