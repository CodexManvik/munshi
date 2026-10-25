package com.opuscube.munshi.ui.components

import android.graphics.Bitmap
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.opuscube.munshi.ui.theme.Inter
import com.opuscube.munshi.ui.theme.Tokens

// Drawn on the device from the pay link, so it works even when WhatsApp or the network does not.
fun qrBitmap(text: String, px: Int = 360): Bitmap {
    val m = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, px, px, mapOf(EncodeHintType.MARGIN to 1))
    val ink = Tokens.Ink.toArgb()
    val paper = android.graphics.Color.WHITE
    val pixels = IntArray(px * px) { i -> if (m.get(i % px, i / px)) ink else paper }
    return Bitmap.createBitmap(pixels, px, px, Bitmap.Config.ARGB_8888)
}

@Composable
fun QrCard(url: String, name: String?, amount: Int?, modifier: Modifier = Modifier) {
    val bmp = remember(url) { qrBitmap(url) }
    Row(
        modifier.background(Color.White, RoundedCornerShape(Tokens.RadiusCard.dp))
            .border(BorderStroke(1.dp, Tokens.Rule), RoundedCornerShape(Tokens.RadiusCard.dp)).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Image(bmp.asImageBitmap(), contentDescription = "${name ?: "Grahak"} ke liye bhugtaan QR", Modifier.size(96.dp))
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(if (name != null) "$name, scan karke chukayein" else "Scan karke chukayein",
                fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = Tokens.Ink)
            if (amount != null) RupeeFigure(amount, size = 30.sp)
        }
    }
}
