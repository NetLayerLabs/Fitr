package day.fitr

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.net.toUri

/**
 * Single place that turns anything that wants to open the app at a path (App Links, the
 * fitr.day/c/... crew invites, static shortcuts, reminder notifications, the home-screen widget)
 * into a URL on the app's own origin. Everything is reduced to a same-origin path first, so a
 * hostile intent can never point the WebView at another site.
 */
object NativeRoutes {
    /** Internal extra carrying a path ("/workout/pushup") from a notification or the widget. */
    const val EXTRA_OPEN_PATH = "day.fitr.OPEN_PATH"

    /** Public landing host whose crew-invite links (/c/...) open inside the app. */
    private const val LANDING_HOST = "fitr.day"
    private const val MAX_PATH = 512
    private val SAFE_PATH = Regex("^/(?!/)[A-Za-z0-9/_.~%=&?+,:@!'()*;-]*\$")

    /** The shell's start URL (SOLANA_MOBILE_URL), normalised; null when misconfigured. */
    fun startUrl(): String? {
        val trimmed = BuildConfig.SOLANA_MOBILE_URL.trim()
        if (trimmed.isEmpty()) return null
        val withScheme = if ("://" in trimmed) trimmed else "https://$trimmed"
        val uri = withScheme.toUri()
        val scheme = uri.scheme?.lowercase()
        if (scheme != "http" && scheme != "https") return null
        if (uri.host.isNullOrBlank()) return null
        return uri.toString()
    }

    /** "https://app.fitr.day" (scheme://host[:port], no trailing slash). */
    fun origin(): String? {
        val uri = startUrl()?.toUri() ?: return null
        val port = if (uri.port != -1) ":${uri.port}" else ""
        return "${uri.scheme}://${uri.host}$port"
    }

    /** True when [url] is on exactly the app's origin (scheme, host and port). */
    fun isAppOrigin(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        val app = startUrl()?.toUri() ?: return false
        val uri = runCatching { url.toUri() }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase() ?: return false
        if (scheme != app.scheme?.lowercase()) return false
        if (!BuildConfig.DEBUG && scheme != "https") return false
        if (!uri.host.equals(app.host, ignoreCase = true)) return false
        return effectivePort(uri) == effectivePort(app)
    }

    /**
     * A same-origin path ("/workout/pushup?x=1") or null. Rejects anything that is not a plain
     * absolute path (no "//host", backslashes, schemes, fragments or control characters).
     */
    fun sanitizePath(raw: String?): String? {
        val path = raw?.trim() ?: return null
        if (path.isEmpty() || path.length > MAX_PATH) return null
        if (!SAFE_PATH.matches(path)) return null
        if (path.contains("/../") || path.endsWith("/..")) return null
        return path
    }

    /** Full app URL for a sanitised path, or null. */
    fun urlForPath(raw: String?): String? {
        val path = sanitizePath(raw) ?: return null
        val origin = origin() ?: return null
        val url = origin + path
        return if (isAppOrigin(url)) url else null
    }

    /** Where an incoming intent wants the WebView to go; null = just show the app as it is. */
    fun targetUrl(intent: Intent?): String? {
        if (intent == null) return null
        intent.getStringExtra(EXTRA_OPEN_PATH)?.let { return urlForPath(it) }
        if (intent.action != Intent.ACTION_VIEW) return null
        val data: Uri = intent.data ?: return null
        val scheme = data.scheme?.lowercase()
        if (scheme != "https" && !(BuildConfig.DEBUG && scheme == "http")) return null
        val path = (data.encodedPath ?: "/").ifEmpty { "/" }
        val query = data.encodedQuery?.let { "?$it" }.orEmpty()
        val host = data.host?.lowercase() ?: return null
        val appHost = startUrl()?.toUri()?.host?.lowercase()
        return when {
            host == appHost -> urlForPath(path + query)
            // Crew invites shared as https://fitr.day/c/<code>: same path on the app host.
            host == LANDING_HOST && path.startsWith("/c/") -> urlForPath(path + query)
            else -> null
        }
    }

    /** Intent that opens MainActivity at [path] (notifications, widget). */
    fun openIntent(context: Context, path: String): Intent =
        Intent(context, MainActivity::class.java)
            .setAction(Intent.ACTION_VIEW)
            .putExtra(EXTRA_OPEN_PATH, sanitizePath(path) ?: "/")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)

    private fun effectivePort(uri: Uri): Int =
        when {
            uri.port != -1 -> uri.port
            uri.scheme.equals("https", ignoreCase = true) -> 443
            uri.scheme.equals("http", ignoreCase = true) -> 80
            else -> -1
        }
}
