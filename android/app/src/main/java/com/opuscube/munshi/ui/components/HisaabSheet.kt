package com.opuscube.munshi.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.opuscube.munshi.api.Ledger
import com.opuscube.munshi.ui.theme.Fraunces
import com.opuscube.munshi.ui.theme.Inter
import com.opuscube.munshi.ui.theme.Tokens
import com.opuscube.munshi.ui.theme.rupees

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HisaabSheet(ledger: Ledger, onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Tokens.Paper) {
        Column(Modifier.padding(start = 24.dp, end = 24.dp, bottom = 32.dp)) {
            Kicker("Is hafte Munshi ne aapko dilaye")
            RupeeFigure(ledger.total, size = 56.sp)
            Text("Har rupaya us kaam se juda hai jisse woh aaya.", fontFamily = Inter, fontSize = 12.sp, color = Tokens.Ink2)
            Spacer(Modifier.height(16.dp))
            ledger.items.forEach { i ->
                HorizontalDivider(color = Tokens.Rule)
                Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(i.label, Modifier.weight(1f), fontFamily = Inter, fontSize = 13.sp, color = Tokens.Ink)
                    Text("+" + rupees(i.amount), fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Tokens.Ink)
                }
            }
            ledger.loan?.let { l ->
                Spacer(Modifier.height(20.dp))
                Kicker("Loan · kamaai mein nahi gina")
                Row(Modifier.fillMaxWidth().padding(top = 8.dp)) {
                    Text("Roz ${rupees(l.dailyDeduction)} settlement se · kul kharcha ${rupees(l.totalCost)}", Modifier.weight(1f), fontFamily = Inter, fontSize = 12.sp, color = Tokens.Ink2)
                    Text(rupees(l.principal), fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Tokens.Ink)
                }
            }
        }
    }
}
