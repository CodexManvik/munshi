package com.opuscube.munshi.voice

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

interface Listener {
    val available: Boolean
    /** Listens once; returns the final transcript, or null on silence, error or timeout. */
    suspend fun listen(windowMs: Long, onPartial: (String) -> Unit): String?
}

class AndroidListener(private val context: Context) : Listener {
    override val available: Boolean
        get() = SpeechRecognizer.isRecognitionAvailable(context) &&
            context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    override suspend fun listen(windowMs: Long, onPartial: (String) -> Unit): String? = withContext(Dispatchers.Main) {
        withTimeoutOrNull(windowMs + 3_000) {
            suspendCancellableCoroutine { cont ->
                val r = SpeechRecognizer.createSpeechRecognizer(context)
                fun finish(text: String?) { if (cont.isActive) cont.resume(text); r.destroy() }
                r.setRecognitionListener(object : RecognitionListener {
                    override fun onResults(results: Bundle) = finish(results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull())
                    override fun onPartialResults(partialResults: Bundle) {
                        partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let(onPartial)
                    }
                    override fun onError(error: Int) = finish(null)
                    override fun onReadyForSpeech(params: Bundle?) {}
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() {}
                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })
                r.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, "hi-IN")
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                    putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1_200L)
                })
                cont.invokeOnCancellation { r.cancel(); r.destroy() }
            }
        }
    }
}
