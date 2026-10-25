package com.opuscube.munshi.ui

import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import com.android.resources.ScreenOrientation
import com.opuscube.munshi.api.*
import com.opuscube.munshi.conductor.*
import com.opuscube.munshi.ui.screens.MainActions
import com.opuscube.munshi.ui.screens.MainContent
import com.opuscube.munshi.voice.Line
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

@RunWith(Parameterized::class)
class MainContentScreenshotTest(private val device: String) {
    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}") fun devices() = listOf("phone", "tablet")
    }

    @get:Rule val paparazzi = Paparazzi(
        deviceConfig = if (device == "phone") DeviceConfig.PIXEL_5 else DeviceConfig.NEXUS_10.copy(orientation = ScreenOrientation.LANDSCAPE),
    )

    private val noop = MainActions({}, {}, {}, {}, {}, {}, {})
    private val ledger = Ledger(742, listOf(LedgerItem("udhaar_recovered", 230, "Pinky didi ka udhaar wapas", "", "send_udhaar_reminder")))
    private val brief = Brief(listOf(BriefItem(1, "udhaar_overdue", "Sharma ji ka udhaar", 450), BriefItem(6, "local_demand_spike", "Mithai ki maang upar", 246), BriefItem(2, "udhaar_overdue", "Pinky didi ka udhaar", 230)), 926)
    private val sharma = Ask(1, Display("Sharma ji ka", 450, "udhaar 12 din se baaki hai. Reminder bhej doon?"), Line("…"))

    // Snapshots show the settled stamp, not the first frame of its drop-in.
    private fun shot(s: UiState) = paparazzi.snapshot { MainContent(s, noop, today = "25 Oct", animate = false) }

    @Test fun brief() = shot(UiState(mode = Mode.Brief, brief = brief, ledger = ledger, live = true))
    @Test fun speaking() = shot(UiState(mode = Mode.Speaking, ask = sharma, ledger = ledger, live = true, shopOpen = true))
    @Test fun listening() = shot(UiState(mode = Mode.Listening, ask = sharma, heard = "haan bhej", ledger = ledger, live = true, shopOpen = true))
    @Test fun payQr() = shot(UiState(mode = Mode.Idle, ask = sharma.copy(id = 2), payQr = PayQr("https://m.test/pay/ab12", "ab12", "Sharma ji", 450), ledger = ledger, live = true, shopOpen = true))
    @Test fun paid() = shot(UiState(mode = Mode.Idle, stamp = Stamp("ab12", "Sharma ji", 450), ledger = ledger.copy(total = 1192), live = true, shopOpen = true))
    @Test fun paidWhileAsking() = shot(UiState(mode = Mode.Speaking, ask = sharma.copy(id = 2, display = Display("Mohalle mein mithai ki maang 39% upar", 924, "ka stock: Soan Papdi 250g, 12 pack. Mangwa doon?")), stamp = Stamp("ab12", "Sharma ji", 450), banner = "Sharma ji ne ₹450 chuka diye", ledger = ledger.copy(total = 450), live = true, shopOpen = true))
    @Test fun reconnecting() = shot(UiState(mode = Mode.Idle, ask = sharma, ledger = ledger, live = false, shopOpen = true))
    @Test fun banner() = shot(UiState(mode = Mode.Idle, banner = "₹120 prapt hue", caption = Line("Bas itna hi. Aapka din shubh ho!"), ledger = ledger, live = true, shopOpen = true))
}
