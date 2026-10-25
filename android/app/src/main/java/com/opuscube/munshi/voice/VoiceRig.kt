package com.opuscube.munshi.voice

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

private val Context.voiceStore by preferencesDataStore("voice")
private val CHOICE = stringPreferencesKey("choice")

/** Which voice the team picked on the "Awaaz jaanch" screen (a VoiceSpec id, or ANDROID_TTS). */
class VoiceStore(private val context: Context) {
    val choice: Flow<String?> = context.voiceStore.data.map { it[CHOICE] }.distinctUntilChanged()
    suspend fun choose(id: String) { context.voiceStore.edit { it[CHOICE] = id } }
}

// The app's one voice, shared by every pairing: the chosen sherpa voice when there is one, else Android TTS.
class VoiceRig(private val context: Context, scope: CoroutineScope) {
    val android = AndroidSpeaker(context)
    val player: Player = AudioTrackPlayer()
    val speaker = SherpaSpeaker(player, android)
    val store = VoiceStore(context)

    /** adb push target for the voice test: /sdcard/Android/data/com.opuscube.munshi/files/voices */
    private val pushed: File? get() = context.getExternalFilesDir("voices")
    private val bundled: File get() = File(context.filesDir, "voice")
    private val synths = mutableMapOf<String, Synth>()

    fun specs(): List<VoiceSpec> = (Voices.discover(pushed) + Voices.discover(bundled)).distinctBy { it.id }
    fun synth(spec: VoiceSpec): Synth = synchronized(synths) { synths.getOrPut(spec.id) { SherpaSynth(spec) } }

    init {
        scope.launch {
            store.choice.collect { id -> speaker.use(withContext(Dispatchers.IO) { resolve(id) }) }
        }
    }

    private fun resolve(id: String?): Synth? = when (id) {
        null, ANDROID_TTS -> null
        else -> specs().firstOrNull { it.id == id }?.let(::synth)
    }

    companion object { const val ANDROID_TTS = "android-tts" }
}
