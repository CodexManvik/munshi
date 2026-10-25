package com.opuscube.munshi.conductor

import com.opuscube.munshi.api.*
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

    private fun TestScope.conductor() = Conductor(api, speaker, listener, backgroundScope, listenWindowMs = 6000)

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
}
