package com.opuscube.munshi.ui

import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import com.opuscube.munshi.ui.screens.LabActions
import com.opuscube.munshi.ui.screens.VoiceLabScreen
import com.opuscube.munshi.voice.lab.LabRow
import com.opuscube.munshi.voice.lab.LabStatus
import org.junit.Rule
import org.junit.Test

class VoiceLabScreenshotTest {
    @get:Rule val paparazzi = Paparazzi(deviceConfig = DeviceConfig.PIXEL_5)

    @Test fun lab() = paparazzi.snapshot {
        VoiceLabScreen(
            listOf(
                LabRow("android-tts", "Android TTS (hi-IN)", LabStatus.Baseline),
                LabRow("vits-piper-hi_IN-pratham-medium-fp16", "Piper · pratham", LabStatus.Measured(180, 0.12)),
                LabRow("vits-piper-hi_IN-priyamvada-medium-fp16", "Piper · priyamvada", LabStatus.Testing),
                LabRow("kokoro-int8-multi-lang-v1_0#31", "Kokoro · hf_alpha", LabStatus.NotSupported("no speech for line 1")),
            ),
            chosen = "vits-piper-hi_IN-pratham-medium-fp16", busy = true,
            a = LabActions({}, { _, _ -> }, {}, {}),
        )
    }
}
