package com.opuscube.munshi.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.opuscube.munshi.pairing.Config
import com.opuscube.munshi.pairing.parseConfig
import com.opuscube.munshi.ui.components.HaanButton
import com.opuscube.munshi.ui.components.InkDock
import com.opuscube.munshi.ui.components.Kicker
import com.opuscube.munshi.ui.components.LedgerPage
import com.opuscube.munshi.ui.theme.Fraunces
import com.opuscube.munshi.ui.theme.Inter
import com.opuscube.munshi.ui.theme.Tokens

@Composable
fun PairScreen(onPaired: (Config) -> Unit) {
    val context = LocalContext.current
    var error by remember { mutableStateOf<String?>(null) }
    var manual by remember { mutableStateOf("") }
    LedgerPage {
        Column(Modifier.windowInsetsPadding(WindowInsets.safeDrawing).padding(start = 32.dp, end = 20.dp, top = 60.dp)) {
            Kicker("Pehli baar")
            Spacer(Modifier.height(16.dp))
            Text("Jodiye", fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 44.sp, color = Tokens.Ink)
            Text("Laptop par /control kholiye aur wahan ka QR scan kijiye.", fontFamily = Inter, fontSize = 14.sp, color = Tokens.Ink2)
            Spacer(Modifier.height(24.dp))
            OutlinedTextField(manual, { manual = it }, label = { Text("Ya server ka pata (http://…)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            error?.let { Text(it, color = Tokens.Red, fontSize = 13.sp) }
        }
        InkDock(Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(10.dp)) {
            HaanButton(true, {
                if (manual.isNotBlank()) {
                    parseConfig("""{"url":"${manual.trim()}","key":""}""")?.let(onPaired) ?: run { error = "Yeh pata sahi nahi lag raha." }
                } else {
                    val opts = GmsBarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build()
                    GmsBarcodeScanning.getClient(context, opts).startScan()
                        .addOnSuccessListener { b -> parseConfig(b.rawValue.orEmpty())?.let(onPaired) ?: run { error = "Yeh Munshi ka QR nahi hai." } }
                        .addOnFailureListener { error = "Scan nahi hua. Dobara koshish kijiye." }
                }
            }, Modifier.fillMaxWidth(), label = if (manual.isBlank()) "QR scan kijiye" else "Jodiye")
        }
    }
}
