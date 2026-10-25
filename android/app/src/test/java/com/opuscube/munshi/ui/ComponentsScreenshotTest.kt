package com.opuscube.munshi.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import com.opuscube.munshi.conductor.Mode
import com.opuscube.munshi.ui.components.*
import org.junit.Rule
import org.junit.Test

class ComponentsScreenshotTest {
    @get:Rule val paparazzi = Paparazzi(deviceConfig = DeviceConfig.PIXEL_5)

    @Test fun parts() = paparazzi.snapshot {
        LedgerPage {
            Column(Modifier.padding(start = 32.dp, top = 40.dp, end = 20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                WeekChip(total = 742, flash = false, onClick = {})
                Kicker("Munshi bol raha hai", speaking = false)
                RupeeFigure(450)
                ChukaDiyaStamp("25 Oct", animate = false)
                QrCard("https://munshi.test/pay/ab12", "Sharma ji", 450)
                Banner("₹120 prapt hue")
                InkDock {
                    DockStatus(Mode.Working, heard = null, live = true)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        HaanButton(true, {}, Modifier.weight(1.6f)); NahiButton(true, {}, Modifier.weight(1f))
                    }
                }
            }
        }
    }
}
