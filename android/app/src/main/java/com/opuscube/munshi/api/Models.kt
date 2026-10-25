package com.opuscube.munshi.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

val MunshiJson = Json { ignoreUnknownKeys = true; classDiscriminator = "type"; explicitNulls = false }

@Serializable data class Display(val who: String, val amount: Int, val rest: String)
@Serializable data class Next(val id: Long? = null, val type: String? = null, val line: String? = null, val spoken: String? = null, val display: Display? = null)
@Serializable data class BriefItem(val id: Long, val type: String, val title: String, val amount: Int)
@Serializable data class Brief(val items: List<BriefItem>, val total: Int)
@Serializable data class PayFor(val name: String, val amount: Int)
@Serializable data class ActionResult(
    val line: String, val spoken: String? = null, val payUrl: String? = null,
    val payFor: PayFor? = null, val opportunityId: Long? = null,
)
@Serializable data class Offer(val id: Long, val line: String, val spoken: String? = null, val display: Display? = null)
@Serializable data class ShelfResult(val line: String, val spoken: String? = null, val next: Offer? = null)
@Serializable data class LedgerItem(val kind: String, val amount: Int, val label: String, val ts: String, val tool: String)
@Serializable data class Loan(val principal: Int, val totalCost: Int, val dailyDeduction: Int, val tenureDays: Int)
@Serializable data class Ledger(val total: Int, val items: List<LedgerItem>, val loan: Loan? = null)

@Serializable
sealed interface SoundboxEvent {
    @Serializable @SerialName("announce") data class Announce(val text: String, val spoken: String? = null) : SoundboxEvent
    @Serializable @SerialName("brief") data object BriefCue : SoundboxEvent
    @Serializable @SerialName("nudge") data object Nudge : SoundboxEvent
    @Serializable @SerialName("ledger") data object LedgerChanged : SoundboxEvent
    @Serializable @SerialName("paid") data class Paid(val ref: String, val name: String? = null, val amount: Int? = null) : SoundboxEvent
    @Serializable @SerialName("reset") data object Reset : SoundboxEvent
    @Serializable @SerialName("shelf") data class Shelf(val line: String, val spoken: String? = null, val next: Offer? = null) : SoundboxEvent
}

// Newer servers may send event types this build does not know; those are skipped, not fatal.
fun parseEvent(data: String): SoundboxEvent? =
    runCatching { MunshiJson.decodeFromString(SoundboxEvent.serializer(), data) }.getOrNull()
