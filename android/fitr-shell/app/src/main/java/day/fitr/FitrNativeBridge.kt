package day.fitr

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.edit

/**
 * `window.FitrNative`: the contract in src/lib/native/bridge.ts, implemented exactly.
 *
 * Exposure policy:
 * - The interface is added to the main WebView only while its main frame is on the app's own
 *   origin (NativeRoutes.isAppOrigin, https://app.fitr.day in release); it is removed when the
 *   main frame goes anywhere else, and every call is refused (no-op / "") until the main frame is
 *   back on that origin. Popup WebViews (WebShellChromeClient.onCreateWindow) never get it.
 * - Arguments are untrusted: JSON is size-capped and validated (Reminders.parse,
 *   FitrWidget.parse), and paths are reduced to same-origin paths (NativeRoutes.sanitizePath).
 *
 * Threading: @JavascriptInterface methods run on WebView's JavaBridge thread; everything that
 * touches TTS, the activity, alarms or widgets is posted to the main thread.
 *
 * Must be constructed in Activity.onCreate (registers an activity-result launcher).
 */
class FitrNativeBridge(
    private val activity: ComponentActivity,
    private val speech: FitrSpeech,
) {
    private val main = Handler(Looper.getMainLooper())

    @Volatile private var allowed = false
    private var injectedInto: WebView? = null
    private var webView: WebView? = null

    private val permissionLauncher: ActivityResultLauncher<String> =
        activity.registerForActivityResult(ActivityResultContracts.RequestPermission()) {
            dispatchPermission()
        }

    // ------------------------------------------------------------------------------------------
    // Attachment (main thread)
    // ------------------------------------------------------------------------------------------

    /** Call before the first loadUrl with the URL about to load. */
    fun attach(
        view: WebView,
        firstUrl: String,
    ) {
        webView = view
        onMainFrameUrl(view, firstUrl)
    }

    /** Call from WebViewClient.onPageStarted (main frame) with the URL being loaded. */
    fun onMainFrameUrl(
        view: WebView,
        url: String?,
    ) {
        webView = view
        val ok = NativeRoutes.isAppOrigin(url)
        allowed = ok
        if (ok && injectedInto !== view) {
            view.addJavascriptInterface(this, NAME)
            injectedInto = view
        } else if (!ok && injectedInto === view) {
            view.removeJavascriptInterface(NAME)
            injectedInto = null
        }
    }

    fun detach() {
        allowed = false
        webView = null
        injectedInto = null
    }

    /** Tells the page the notification permission may have changed (activity resumed). */
    fun onResume() {
        dispatchPermission()
    }

    // ------------------------------------------------------------------------------------------
    // Contract
    // ------------------------------------------------------------------------------------------

    @JavascriptInterface
    fun version(): String = if (allowed) "${BuildConfig.VERSION_NAME}+${BuildConfig.VERSION_CODE}" else ""

    @JavascriptInterface
    fun speak(
        text: String?,
        flush: Boolean,
    ) {
        if (!allowed || text.isNullOrBlank()) return
        val t = text.take(1_000)
        main.post { if (allowed) speech.speak(t, flush) }
    }

    @JavascriptInterface
    fun stopSpeaking() {
        if (!allowed) return
        main.post { speech.stop() }
    }

    @JavascriptInterface
    fun notificationPermission(): String = if (allowed) currentPermission() else "default"

    @JavascriptInterface
    fun requestNotificationPermission() {
        if (!allowed) return
        main.post { if (allowed) requestPermissionOnMain() }
    }

    @JavascriptInterface
    fun scheduleReminders(json: String?) {
        if (!allowed || json == null) return
        main.post { if (allowed) Reminders.schedule(activity.applicationContext, json) }
    }

    @JavascriptInterface
    fun cancelReminders() {
        if (!allowed) return
        main.post { if (allowed) Reminders.cancel(activity.applicationContext) }
    }

    @JavascriptInterface
    fun updateWidget(json: String?) {
        if (!allowed || json == null) return
        main.post { if (allowed) FitrWidget.update(activity.applicationContext, json) }
    }

    // ------------------------------------------------------------------------------------------
    // Notification permission
    // ------------------------------------------------------------------------------------------

    private fun hasRuntimePermission(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    private fun asked(): Boolean = Reminders.prefs(activity).getBoolean(KEY_ASKED, false)

    /**
     * "granted" when Fitr may post notifications; "denied" when the user said no for good (or
     * switched them off in settings); "default" when the system dialog can still be shown.
     */
    private fun currentPermission(): String {
        if (Reminders.canNotify(activity)) return "granted"
        if (hasRuntimePermission()) return "denied" // granted, but notifications switched off
        if (!asked()) return "default"
        return if (activity.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
            "default"
        } else {
            "denied"
        }
    }

    private fun requestPermissionOnMain() {
        Reminders.ensureChannel(activity)
        when (currentPermission()) {
            "granted" -> dispatchPermission()
            "default" -> {
                Reminders.prefs(activity).edit { putBoolean(KEY_ASKED, true) }
                permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
            // The system dialog will not show again: send the user to Fitr's notification settings.
            else -> openNotificationSettings()
        }
    }

    private fun openNotificationSettings() {
        val intent =
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, activity.packageName)
        try {
            activity.startActivity(intent)
        } catch (_: ActivityNotFoundException) {
            // Nothing to open on this device.
        }
    }

    /** window event "fitrnative" { type: "notificationPermission", value } (see useNativeReminders). */
    private fun dispatchPermission() {
        val view = webView ?: return
        if (!allowed) return
        val value = currentPermission()
        view.evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('fitrnative',{detail:{type:'notificationPermission',value:'$value'}}))",
            null,
        )
    }

    companion object {
        const val NAME = "FitrNative"
        private const val KEY_ASKED = "notification_permission_asked"
    }
}
