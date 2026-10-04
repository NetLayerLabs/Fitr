package day.fitr

import android.content.Context
import android.media.AudioAttributes
import android.speech.tts.TextToSpeech
import android.util.Log
import java.util.Locale

/**
 * Voice coach output: one Android TextToSpeech engine for the activity's lifetime.
 * Main thread only. Phrases spoken before the engine is ready are queued (latest few kept).
 */
class FitrSpeech(context: Context) {
    private var ready = false
    private var released = false
    private val pending = ArrayDeque<Pair<String, Boolean>>()
    private var nextId = 0

    private val tts: TextToSpeech =
        TextToSpeech(context.applicationContext) { status ->
            if (released) return@TextToSpeech
            if (status != TextToSpeech.SUCCESS) {
                Log.w(TAG, "TextToSpeech init failed: $status")
                pending.clear()
                return@TextToSpeech
            }
            configure()
            ready = true
            while (pending.isNotEmpty()) {
                val (text, flush) = pending.removeFirst()
                speakNow(text, flush)
            }
        }

    private fun configure() {
        val preferred = Locale.getDefault()
        val result = runCatching { tts.setLanguage(preferred) }.getOrDefault(TextToSpeech.LANG_NOT_SUPPORTED)
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            runCatching { tts.setLanguage(Locale.ENGLISH) }
        }
        // Coaching cues: duck music instead of pausing it, like navigation prompts.
        tts.setAudioAttributes(
            AudioAttributes
                .Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build(),
        )
        tts.setSpeechRate(1.05f)
    }

    fun speak(
        text: String,
        flush: Boolean,
    ) {
        if (released) return
        val clean = text.replace(Regex("\\s+"), " ").trim().take(MAX_CHARS)
        if (clean.isEmpty()) return
        if (!ready) {
            if (flush) pending.clear()
            pending.addLast(clean to flush)
            while (pending.size > MAX_PENDING) pending.removeFirst()
            return
        }
        speakNow(clean, flush)
    }

    private fun speakNow(
        text: String,
        flush: Boolean,
    ) {
        val mode = if (flush) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD
        tts.speak(text, mode, null, "fitr-${nextId++}")
    }

    fun stop() {
        pending.clear()
        if (ready) tts.stop()
    }

    fun release() {
        if (released) return
        released = true
        pending.clear()
        runCatching {
            tts.stop()
            tts.shutdown()
        }
    }

    private companion object {
        const val TAG = "FitrSpeech"
        const val MAX_CHARS = 300
        const val MAX_PENDING = 4
    }
}
