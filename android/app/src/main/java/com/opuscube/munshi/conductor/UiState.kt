package com.opuscube.munshi.conductor

import com.opuscube.munshi.api.Brief
import com.opuscube.munshi.api.Display
import com.opuscube.munshi.api.Ledger
import com.opuscube.munshi.voice.Line

enum class Mode { Brief, Speaking, Listening, Working, Idle }

data class Ask(val id: Long, val display: Display?, val line: Line)
data class PayQr(val url: String, val ref: String, val name: String?, val amount: Int?)
data class Stamp(val ref: String, val name: String, val amount: Int)

data class UiState(
    val mode: Mode = Mode.Brief,
    val brief: Brief? = null,
    val caption: Line? = null,       // what Munshi last said, when it is not a question
    val ask: Ask? = null,            // the open question; Haan / Nahi are enabled only when set
    val heard: String? = null,       // "Aapne kaha: …"
    val payQr: PayQr? = null,        // stays until its ref is paid
    val stamp: Stamp? = null,        // "Chuka diya", until the next question
    val banner: String? = null,      // announcement band, 6.5 s
    val ledger: Ledger? = null,
    val live: Boolean = false,
    val shopOpen: Boolean = false,
)
