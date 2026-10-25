package com.opuscube.munshi.conductor

import com.opuscube.munshi.api.*
import com.opuscube.munshi.brain.Brain
import com.opuscube.munshi.brain.BrainState
import com.opuscube.munshi.brain.NoBrain
import com.opuscube.munshi.voice.IntentMatcher
import com.opuscube.munshi.voice.Line
import com.opuscube.munshi.voice.Listener
import com.opuscube.munshi.voice.Speaker
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean

private val OOPS = Line("Kuch gadbad hui. Dobara koshish kijiye.", "कुछ गड़बड़ हुई। दोबारा कोशिश कीजिए।")
private val GONE = Line("Yeh kaam ab baaki nahi.", "यह काम अब बाकी नहीं।")
private val NO_EYES = Line("Munshi ka dimaag abhi taiyaar nahi. Thodi der mein photo dobara kheenchiye.", "मुंशी का दिमाग अभी तैयार नहीं। थोड़ी देर में फ़ोटो दोबारा खींचिए।")
private val UNREADABLE = Line("Photo saaf nahi dikhi. Shelf ki photo dobara kheenchiye.", "फ़ोटो साफ़ नहीं दिखी। शेल्फ़ की फ़ोटो दोबारा खींचिए।")
private val GREET = Line("Suprabhat Ramesh ji! Aaj ke kaam sunaata hoon.", "सुप्रभात रमेश जी! आज के काम सुनाता हूँ।")
private val BYE_DONE = Line("Bas itna hi. Aapka din shubh ho!", "बस इतना ही। आपका दिन शुभ हो!")
private val BYE_NONE = Line("Aaj koi naya kaam nahi. Aapka din shubh ho!", "आज कोई नया काम नहीं। आपका दिन शुभ हो!")

private fun mindNote(s: BrainState): String? = when (s) {
    is BrainState.Downloading -> String.format(Locale.US, "Munshi ka dimaag aa raha hai · %.1f / %.1f GB", s.done / 1e9, s.total / 1e9)
    BrainState.Loading -> "Munshi ka dimaag taiyaar ho raha hai…"
    else -> null
}

// Port of web/Soundbox.tsx: one proposal at a time, answers accepted while speaking,
// free speech goes to the agent, a shelf reading interrupts, a pay QR stays until paid.
class Conductor(
    private val api: MunshiApi,
    private val speaker: Speaker,
    private val listener: Listener,
    private val scope: CoroutineScope,
    private val listenWindowMs: Long,
    private val brain: Brain = NoBrain,
) {
    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state

    private var pending: CompletableDeferred<Answer>? = null
    private val running = AtomicBoolean(false)
    private var bannerJob: Job? = null
    private var sessionJob: Job? = null

    init {
        // Status for the dock, and a warm-up of today's lines the moment the model is ready.
        scope.launch {
            brain.state.collect { s ->
                _state.update { it.copy(mind = mindNote(s)) }
                if (s == BrainState.Ready) scope.launch { warmBrain() }
            }
        }
    }

    fun start() { scope.launch { refreshBrief(); refreshLedger() } }

    fun openShop() { session(greet = true, scope = "brief", max = 3) }

    fun answer(a: Answer) {
        if (pending?.isActive == true && a != Answer.Skip) speaker.stop()
        pending?.complete(a)
    }

    fun mic() {
        if (!listener.available) return
        scope.launch {
            val text = listenOnce() ?: return@launch
            val matched = IntentMatcher.match(text)
            if (pending?.isActive == true) { answer(matched ?: Answer.Text(text)); return@launch }
            if (!running.compareAndSet(false, true)) return@launch
            try { converseAndFollow(text) } finally { running.set(false) }
        }
    }

    // The phone's model reads the photo; only its readings go to the server, which checks them.
    fun shelf(jpeg: ByteArray) {
        scope.launch {
            _state.update { it.copy(mode = Mode.Working) }
            try {
                if (brain.state.value != BrainState.Ready) { say(NO_EYES); return@launch }
                val readings = brain.readShelf(jpeg, api.facts().inventory)
                if (readings == null) { say(UNREADABLE); return@launch }
                handleShelf(api.shelfReadings(readings))
            } catch (e: ApiError) { say(if (e.status == 422) UNREADABLE else OOPS) }
            catch (e: CancellationException) { throw e }
            catch (e: Exception) { say(OOPS) }
        }
    }

    fun onEvent(e: SoundboxEvent) {
        when (e) {
            is SoundboxEvent.Announce -> { showBanner(e.text); scope.launch { speaker.say(Line(e.text, e.spoken)) } }
            is SoundboxEvent.Paid -> _state.update { s ->
                val qr = s.payQr
                if (qr == null || qr.ref != e.ref) s
                else s.copy(payQr = null, stamp = Stamp(e.ref, e.name ?: qr.name.orEmpty(), e.amount ?: qr.amount ?: 0))
            }
            SoundboxEvent.LedgerChanged -> scope.launch { refreshLedger() }
            SoundboxEvent.BriefCue -> openShop()
            SoundboxEvent.Nudge -> session(greet = false, scope = "all", max = 1)
            // Like the web page reloading: stop whatever is running, nothing stale left pending.
            SoundboxEvent.Reset -> scope.launch {
                sessionJob?.cancelAndJoin()
                pending = null
                speaker.stop()
                _state.value = UiState(live = _state.value.live)
                start()
            }
            is SoundboxEvent.Shelf -> scope.launch { handleShelf(ShelfResult(e.line, e.spoken, e.next)) }
            // The link ran out: drop its QR. The server announces it and re-offers the reminder.
            is SoundboxEvent.Expired -> _state.update { s -> if (s.payQr?.ref == e.ref) s.copy(payQr = null) else s }
            SoundboxEvent.Resync -> scope.launch { refreshBrief(); refreshLedger() }
        }
    }

    fun onLive(live: Boolean) {
        val was = _state.value.live
        _state.update { it.copy(live = live) }
        if (live && !was) scope.launch { refreshLedger() }
    }

    // ---------------------------------------------------------------------------------

    private fun session(greet: Boolean, scope: String, max: Int) {
        if (!running.compareAndSet(false, true)) return
        sessionJob = this.scope.launch { runSession(greet, scope, max) }
    }

    private suspend fun runSession(greet: Boolean, scope: String, max: Int) {
        _state.update { it.copy(shopOpen = true, mode = Mode.Idle) }
        try {
            this.scope.launch { warmBrain() }
            if (greet) say(GREET)
            var handled = 0
            while (handled < max) {
                val n = api.next(scope)
                val id = n.id ?: break
                if (resolve(id, n.display, worded(Line(n.line.orEmpty(), n.spoken)), speak = true) == Outcome.Done) handled++
            }
            if (greet) say(if (handled > 0) BYE_DONE else BYE_NONE)
        } catch (e: CancellationException) { throw e }
        catch (e: Exception) { say(OOPS) }
        finally { running.set(false); _state.update { it.copy(mode = Mode.Idle, ask = null) } }
    }

    private enum class Outcome { Done, Skipped }

    private suspend fun resolve(id: Long, display: Display?, line: Line, speak: Boolean): Outcome = coroutineScope {
        val answered = CompletableDeferred<Answer>().also { pending = it }
        _state.update { it.copy(ask = Ask(id, display, line), stamp = null, heard = null, mode = Mode.Speaking) }
        val voice = launch {
            if (speak) speaker.say(line)
            if (listener.available && answered.isActive) {
                val text = listenOnce()
                if (text != null) answered.complete(IntentMatcher.match(text) ?: Answer.Text(text))
            }
            if (answered.isActive) _state.update { it.copy(mode = Mode.Idle) }
        }
        val a = answered.await()
        voice.cancel()
        pending = null
        _state.update { it.copy(ask = null) }
        if (a == Answer.Skip) return@coroutineScope Outcome.Skipped
        _state.update { it.copy(mode = Mode.Working) }
        val result = try {
            when (a) {
                Answer.Yes -> api.confirm(id)
                Answer.No -> api.decline(id)
                is Answer.Text -> freeSpeech(a.text)
                Answer.Skip -> error("unreachable")
            }
        } catch (e: ApiError) {
            if (e.status == 409) { say(GONE); return@coroutineScope Outcome.Done }
            say(OOPS); return@coroutineScope Outcome.Done
        } catch (e: CancellationException) { throw e }
        catch (e: Exception) { say(OOPS); return@coroutineScope Outcome.Done }
        show(result)
        say(Line(result.line, result.spoken))
        if (a is Answer.Text && result.opportunityId != null && result.opportunityId != id && result.payUrl == null) {
            val n = api.next()
            val nid = n.id
            if (nid != null && nid == result.opportunityId) resolve(nid, n.display, Line(n.line.orEmpty(), n.spoken), speak = false)
        }
        Outcome.Done
    }

    private suspend fun converseAndFollow(text: String) {
        _state.update { it.copy(mode = Mode.Working) }
        val r = try { freeSpeech(text) } catch (e: CancellationException) { throw e } catch (e: Exception) { ActionResult(OOPS.text, OOPS.spoken) }
        show(r)
        say(Line(r.line, r.spoken))
        if (r.opportunityId != null && r.payUrl == null) {
            val n = api.next()
            val nid = n.id
            if (nid != null && nid == r.opportunityId) resolve(nid, n.display, Line(n.line.orEmpty(), n.spoken), speak = false)
        }
    }

    // A shelf reading skips the open question; the running session then asks the restock offer
    // (the server has already proposed it). With no session running, ask it here.
    private suspend fun handleShelf(r: ShelfResult) {
        if (pending?.isActive == true) { answer(Answer.Skip); say(Line(r.line, r.spoken)); return }
        if (!running.compareAndSet(false, true)) { say(Line(r.line, r.spoken)); return }
        try {
            say(Line(r.line, r.spoken))
            r.next?.let { resolve(it.id, it.display, worded(Line(it.line, it.spoken)), speak = true) }
        } finally { running.set(false); _state.update { it.copy(mode = Mode.Idle) } }
    }

    private fun worded(line: Line): Line = brain.cached(line) ?: line

    private suspend fun warmBrain() {
        if (brain.state.value != BrainState.Ready) return
        val facts = try { api.facts() } catch (e: CancellationException) { throw e } catch (e: Exception) { return }
        brain.prewarm(facts.tasks.map { Line(it.line, it.spoken) })
    }

    // Anything but haan/nahi. The phone's model answers from the shop's facts and may suggest a reminder,
    // which the server turns into a proposal; Munshi says the answer, then asks the proposal (the caller
    // speaks the returned line and follows its opportunityId). Without a usable answer: the server's line.
    private suspend fun freeSpeech(text: String): ActionResult {
        if (brain.state.value == BrainState.Ready) {
            val facts = try { api.facts() } catch (e: CancellationException) { throw e } catch (e: Exception) { null }
            val reply = facts?.let { brain.answer(text, it) }
            if (reply != null) {
                val k = reply.proposeKhataId ?: return ActionResult(reply.say.text, reply.say.spoken)
                val p = try { api.propose(k) } catch (e: CancellationException) { throw e } catch (e: Exception) { null }
                    ?: return ActionResult(reply.say.text, reply.say.spoken)
                say(reply.say)
                return ActionResult(p.line, p.spoken, opportunityId = p.opportunityId)
            }
        }
        return api.converse(text)
    }

    private suspend fun listenOnce(): String? {
        _state.update { it.copy(mode = Mode.Listening, heard = null) }
        val text = listener.listen(listenWindowMs) { partial -> _state.update { it.copy(heard = partial) } }?.trim()
        _state.update { it.copy(mode = Mode.Idle, heard = text?.takeIf { t -> t.isNotEmpty() }) }
        return text?.takeIf { it.isNotEmpty() }
    }

    private fun show(r: ActionResult) {
        val url = r.payUrl ?: return
        _state.update { it.copy(payQr = PayQr(url, url.substringAfterLast('/'), r.payFor?.name, r.payFor?.amount)) }
    }

    private suspend fun say(line: Line) {
        _state.update { it.copy(caption = line, mode = Mode.Speaking) }
        speaker.say(line)
        _state.update { it.copy(mode = Mode.Idle) }
    }

    private fun showBanner(text: String) {
        bannerJob?.cancel()
        _state.update { it.copy(banner = text) }
        bannerJob = scope.launch { delay(6500); _state.update { it.copy(banner = null) } }
    }

    private suspend fun refreshBrief() = runCatching { api.brief() }.onSuccess { b -> _state.update { it.copy(brief = b) } }
    private suspend fun refreshLedger() = runCatching { api.ledger() }.onSuccess { l -> _state.update { it.copy(ledger = l) } }
}
