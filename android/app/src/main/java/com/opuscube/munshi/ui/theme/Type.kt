package com.opuscube.munshi.ui.theme

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import com.opuscube.munshi.R
import java.text.NumberFormat
import java.util.Locale

val Fraunces = FontFamily(
    Font(R.font.fraunces_regular, FontWeight.Normal),
    Font(R.font.fraunces_semibold, FontWeight.SemiBold),
    Font(R.font.fraunces_italic, FontWeight.Normal, FontStyle.Italic),
)
val Inter = FontFamily(
    Font(R.font.inter_regular, FontWeight.Normal),
    Font(R.font.inter_semibold, FontWeight.SemiBold),
    Font(R.font.inter_semibold, FontWeight.Bold),
)

private val indian = NumberFormat.getIntegerInstance(Locale.forLanguageTag("en-IN"))
fun rupees(n: Int): String = "₹" + indian.format(n)
