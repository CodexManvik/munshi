package com.opuscube.munshi.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateIntAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.opuscube.munshi.ui.theme.Inter
import com.opuscube.munshi.ui.theme.Tokens
import com.opuscube.munshi.ui.theme.rupees

@Composable
fun WeekChip(total: Int, flash: Boolean, onClick: () -> Unit) {
    val shown by animateIntAsState(total, tween(900), label = "week")
    val ink by animateColorAsState(if (flash) Tokens.Red else Tokens.Ink, label = "flash")
    Text(
        buildAnnotatedString { append("Is hafte "); withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = ink)) { append(rupees(shown)) } },
        Modifier.border(BorderStroke(1.dp, Tokens.Rule), RoundedCornerShape(Tokens.RadiusPill.dp)).clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 5.dp),
        fontFamily = Inter, fontSize = Tokens.TypeChipSize.sp, color = Tokens.Ink2,
    )
}
