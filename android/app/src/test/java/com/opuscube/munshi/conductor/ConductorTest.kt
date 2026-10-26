package com.opuscube.munshi.conductor

import com.opuscube.munshi.api.*
import com.opuscube.munshi.brain.*
import com.opuscube.munshi.voice.Line
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import org.junit.Assert.*
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ConductorTest {
    private val api = FakeApi()
    private val speaker = FakeSpeaker()
    private val listener = FakeListener()

    private fun TestScope.conductor(brain: Brain = NoBrain) = Conductor(api, speaker, listener, backgroundScope, listenWindowMs = 6000, brain = brain)

    @Test fun `an expired link clears its QR, and a resync refreshes the brief and ledger`() = runTest {
        api.nexts += SHARMA
        api.confirmResult = { ActionResult("Sharma ji ko reminder bhej diya.", payUrl = "https://x/pay/ab12", payFor = PayFor("Sharma ji", 450)) }
        val c = conductor()
        c.openShop(); runCurrent()
        c.answer(Answer.Yes); runCurrent()
        c.onEvent(SoundboxEvent.Expired("other", "Pinky didi", 230)); runCurrent()
        assertNotNull(c.state.value.payQr)
        c.onEvent(SoundboxEvent.Expired("ab12", "Sharma ji", 450)); runCurrent()
        assertNull(c.state.value.payQr)
        api.calls.clear()
        c.onEvent(SoundboxEvent.Resync); runCurrent()
        assertEquals(listOf("brief", "ledger"), api.calls)
    }

    @Test fun `opening the shop greets, asks the top task, and waits for an answer`() = runTest {
        api.nexts += SHARMA
        val c = conductor()
        c.openShop(); runCurrent()
        assertTrue(c.state.value.shopOpen)
        assertEquals(1L, c.state.value.ask!!.id)
        assertEquals(450, c.state.value.ask!!.display!!.amount)
        assertTrue(speaker.said.first().startsWith("Suprabhat Ramesh ji"))
        assertTrue(api.calls.none { it.startsWith("confirm") })
    }

    @Test fun `haan confirms, shows the pay QR, and moves to the next task`() = runTest {
        api.nexts += listOf(SHARMA, MITHAI)
        api.confirmResult = { ActionResult("Sharma ji ko reminder bhej diya.", payUrl = "https://x/pay/ab12", payFor = PayFor("Sharma ji", 450)) }
        val c = conductor()
        c.openShop(); runCurrent()
        c.answer(Answer.Yes); runCurrent()
        assertTrue("confirm:1" in api.calls)
        assertEquals(PayQr("https://x/pay/ab12", "ab12", "Sharma ji", 450), c.state.value.payQr)
        assertTrue("Sharma ji ko reminder bhej diya." in speaker.said)
        assertEquals(2L, c.state.value.ask!!.id)
    }

    @Test fun `an answer during speech stops the voice and acts at once`() = runTest {
        api.nexts += SHARMA
        val c = conductor()
        c.openShop(); runCurrent()
        speaker.gate = CompletableDeferred()          // hold the next line mid-speech
        c.answer(Answer.No); runCurrent()
        assertTrue("decline:1" in api.calls)
        assertTrue(speaker.stops > 0)
    }

    @Test fun `the pay QR stays until its ref is paid, then the stamp lands`() = runTest {
        api.nexts += SHARMA
        api.confirmResult = { ActionResult("ok", payUrl = "https://x/pay/ab12", payFor = PayFor("Sharma ji", 450)) }
        val c = conductor()
        c.openShop(); runCurrent(); c.answer(Answer.Yes); runCurrent()
        c.onEvent(SoundboxEvent.Paid("other", "Pinky didi", 230)); runCurrent()
        assertNotNull(c.state.value.payQr)
        c.onEvent(SoundboxEvent.Paid("ab12", "Sharma ji", 450)); runCurrent()
        assertNull(c.state.value.payQr)
        assertEquals(Stamp("ab12", "Sharma ji", 450), c.state.value.stamp)
    }

    @Test fun `a 409 on confirm says the task is gone and carries on`() = runTest {
        api.nexts += listOf(SHARMA, MITHAI)
        api.confirmResult = { throw ApiError(409, "not_proposed") }
        val c = conductor()
        c.openShop(); runCurrent(); c.answer(Answer.Yes); runCurrent()
        assertTrue("Yeh kaam ab baaki nahi." in speaker.said)
        assertEquals(2L, c.state.value.ask!!.id)
    }

    @Test fun `free speech goes to the agent, and a redirect to another task is asked without repeating it`() = runTest {
        api.nexts += listOf(SHARMA)
        api.converseResult = { ActionResult("Pinky didi ko bhejun?", opportunityId = 3) }
        val c = conductor()
        c.openShop(); runCurrent()
        api.current = PINKY                            // the agent proposed Pinky on the server
        c.answer(Answer.Text("pehle Pinky ko bhejo")); runCurrent()
        assertTrue("converse:pehle Pinky ko bhejo" in api.calls)
        assertEquals(3L, c.state.value.ask!!.id)
        assertTrue("Pinky didi ko bhejun?" in speaker.said)
        assertFalse(PINKY.line in speaker.said)        // the agent already asked; not repeated
    }

    @Test fun `a shelf reading interrupts the open question and the restock offer comes next`() = runTest {
        api.nexts += listOf(SHARMA)
        val c = conductor()
        c.openShop(); runCurrent()
        api.current = SURF                             // the shelf flow proposed the group order on the server
        c.onEvent(SoundboxEvent.Shelf("Shelf dekh li: Surf Excel 1kg aur Parle-G kam hain.", next = Offer(7, SURF.line!!, display = SURF.display))); runCurrent()
        assertTrue("Shelf dekh li: Surf Excel 1kg aur Parle-G kam hain." in speaker.said)
        assertEquals(7L, c.state.value.ask!!.id)
    }

    @Test fun `a question asked during a question is answered, then the open question is asked again`() = runTest {
        api.nexts += SHARMA
        val c = conductor()
        c.openShop(); runCurrent()
        repeat(3) { c.answer(Answer.Text("kitna udhaar baaki hai")); runCurrent() }   // more than the brief's 3 tasks
        assertTrue("Samjha." in speaker.said)
        assertEquals(4, speaker.said.count { it == SHARMA.line })
        assertEquals(1L, c.state.value.ask!!.id)          // Sharma ji still waits for haan or nahi
    }

    @Test fun `talk near the counter after a question is ignored, only haan or nahi answers it`() = runTest {
        listener.available0 = true; listener.replies += listOf("है क्या", "तू पिक्चर जल्दी से हो मेरे उसके लिए")
        api.nexts += SHARMA
        val c = conductor()
        c.openShop(); runCurrent()
        assertTrue(api.calls.none { it.startsWith("converse") })
        assertEquals(1L, c.state.value.ask!!.id)
    }

    @Test fun `a shelf reading during a question from Boliye still asks the restock offer`() = runTest {
        val brain = FakeBrain().apply { reply = BrainReply(Line("Pinky didi ka ₹230 baaki hai."), proposeKhataId = 2) }
        listener.available0 = true; listener.replies += "pinky ko yaad dilao"
        val c = conductor(brain)
        c.mic(); runCurrent()
        assertEquals(PINKY.id, c.state.value.ask!!.id)       // no session: the question came from Boliye
        c.onEvent(SoundboxEvent.Shelf("Shelf dekh li: Parle-G kam hain.", next = Offer(7, SURF.line!!, display = SURF.display))); advanceTimeBy(1_000); runCurrent()
        assertTrue("Shelf dekh li: Parle-G kam hain." in speaker.said)
        assertEquals(7L, c.state.value.ask!!.id)
    }

    @Test fun `heard haan from the listener confirms without a tap`() = runTest {
        listener.available0 = true; listener.replies += "हाँ भेज दो"
        api.nexts += SHARMA
        val c = conductor()
        c.openShop(); runCurrent()
        assertTrue("confirm:1" in api.calls)
    }

    @Test fun `reset returns to the brief with nothing pending`() = runTest {
        api.nexts += SHARMA
        val c = conductor()
        c.openShop(); runCurrent()
        c.onEvent(SoundboxEvent.Reset); runCurrent()
        assertEquals(Mode.Brief, c.state.value.mode)
        assertNull(c.state.value.ask)
        assertFalse(c.state.value.shopOpen)
    }

    @Test fun `announcements show a banner that clears after 6_5 seconds`() = runTest {
        val c = conductor()
        c.onEvent(SoundboxEvent.Announce("₹120 prapt hue")); runCurrent()
        assertEquals("₹120 prapt hue", c.state.value.banner)
        advanceTimeBy(6600); runCurrent()
        assertNull(c.state.value.banner)
    }

    @Test fun `with the model ready, open tasks are warmed and the question uses the warmer wording`() = runTest {
        val warm = "Ramesh ji, Sharma ji ka ₹450 udhaar 12 din se baaki hai. Reminder bhej doon?"
        val brain = FakeBrain().apply { words[SHARMA.line!!] = Line(warm) }
        api.nexts += SHARMA
        val c = conductor(brain)
        c.start(); runCurrent()
        assertTrue(SHARMA.line in brain.prewarmed)
        c.openShop(); runCurrent()
        assertTrue(warm in speaker.said)
        assertEquals(450, c.state.value.ask!!.display!!.amount)
    }

    @Test fun `free speech goes to the model, and its suggested reminder is proposed and asked once`() = runTest {
        val brain = FakeBrain().apply { reply = BrainReply(Line("Pinky didi ka ₹230 baaki hai."), proposeKhataId = 2) }
        listener.available0 = true; listener.replies += "pinky ko yaad dilao"
        val c = conductor(brain)
        c.mic(); runCurrent()
        assertEquals(listOf("pinky ko yaad dilao"), brain.asked)
        assertTrue("propose:2" in api.calls)
        assertTrue(api.calls.none { it.startsWith("converse") })
        assertTrue("Pinky didi ka ₹230 baaki hai." in speaker.said)
        assertEquals(1, speaker.said.count { it == PINKY.line })
        assertEquals(PINKY.id, c.state.value.ask!!.id)
    }

    @Test fun `a ready model with no usable answer says so, and without a model free speech goes to the server`() = runTest {
        conductor(FakeBrain()).hear("kitna udhaar?"); runCurrent()
        assertTrue("Ek second, dekhta hoon." in speaker.said)
        assertTrue("Maaf kijiye, abhi jawab nahi bana. Thodi der mein dobara poochiye." in speaker.said)
        assertTrue(api.calls.none { it.startsWith("converse") })
        api.calls.clear()
        conductor(FakeBrain(ready = false)).hear("kitna udhaar?"); runCurrent()
        assertEquals(listOf("converse:kitna udhaar?"), api.calls.filter { it.startsWith("converse") || it == "facts" })
    }

    @Test fun `Boliye never opens a second recogniser`() = runTest {
        val gate = CompletableDeferred<Unit>()
        val slow = object : com.opuscube.munshi.voice.Listener {
            var opened = 0
            override val available = true
            override suspend fun listen(windowMs: Long, onPartial: (String) -> Unit): String? { opened++; gate.await(); return null }
        }
        val c = Conductor(api, speaker, slow, backgroundScope, listenWindowMs = 6000)
        c.mic(); runCurrent()
        c.mic(); c.mic(); runCurrent()
        assertEquals(1, slow.opened)
        gate.complete(Unit); runCurrent()
    }

    @Test fun `Boliye during a question cuts the voice instead of opening a second recogniser`() = runTest {
        api.nexts += SHARMA
        val c = conductor()
        c.openShop(); runCurrent()
        listener.available0 = true
        val before = speaker.stops
        c.mic(); runCurrent()
        assertEquals(before + 1, speaker.stops)
        assertEquals(1L, c.state.value.ask!!.id)          // still waiting for haan or nahi
    }

    @Test fun `a shelf photo is read on the phone and the server gets only the readings`() = runTest {
        val brain = FakeBrain().apply { readings = listOf(Reading("surf_1kg", "empty")) }
        val c = conductor(brain)
        c.shelf(ByteArray(3)); runCurrent()
        assertEquals(listOf("shelf:3:1"), brain.asked)
        assertTrue("readings:surf_1kg=empty" in api.calls)
        assertTrue("Shelf dekh li: Surf Excel 1kg kam hain." in speaker.said)
    }

    @Test fun `an unreadable photo, or no model, is said plainly`() = runTest {
        conductor(FakeBrain()).shelf(ByteArray(3)); runCurrent()
        assertTrue("Photo saaf nahi dikhi. Shelf ki photo dobara kheenchiye." in speaker.said)
        conductor(FakeBrain(ready = false)).shelf(ByteArray(3)); runCurrent()
        assertTrue("Munshi ka dimaag abhi taiyaar nahi. Thodi der mein photo dobara kheenchiye." in speaker.said)
    }

    @Test fun `the download shows in the dock, and becoming ready warms the tasks`() = runTest {
        val brain = FakeBrain(ready = false)
        val c = conductor(brain)
        brain.state.value = BrainState.Downloading(1_200_000_000, 3_660_000_000); runCurrent()
        assertEquals("Munshi ka dimaag aa raha hai · 1.2 / 3.7 GB", c.state.value.mind)
        brain.state.value = BrainState.Ready; runCurrent()
        assertNull(c.state.value.mind)
        assertTrue("facts" in api.calls)
    }
}
