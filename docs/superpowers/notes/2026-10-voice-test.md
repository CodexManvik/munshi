# Voice test, <date>, on <phone model> (8 GB)

Lines: the five in `voice/lab/VoiceLab.kt` (`LAB_LINES`). Voices pushed with `android/scripts/push-voices.ps1`.

| Voice | First audio (ms) | RTF | Natural Hindi (1–5) | Reads "Sharma ji", "Surf Excel" | Reads ₹450 / ₹50,000 right | Verdict |
|---|---|---|---|---|---|---|
| Android TTS (hi-IN) | — | — | | | | |
| Piper · pratham | | | | | | |
| Piper · priyamvada | | | | | | |
| Piper · rohan | | | | | | |
| Kokoro · hf_alpha | | | | | | |
| Kokoro · hm_omega | | | | | | |

RTF = time to make the audio ÷ length of the audio. Under 1 keeps up live; above 1 only works for lines
made ahead of time.

**Emulator smoke test (2026-10-25, x86_64, not for judging quality):**
- Piper fp16 archives fail to load in sherpa-onnx 1.13.8 (float16 layers rejected), so the test uses fp32.
- Kokoro produced audio for all five lines: hf_alpha RTF 12.1, hm_omega RTF 13.3 (first line 127 s,
  including loading the model).

**Chosen:** <voice id from the table in plan f Task 6>
**Why:** <one or two lines>
