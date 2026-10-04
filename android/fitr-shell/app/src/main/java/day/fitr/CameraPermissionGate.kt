package day.fitr

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.util.Log
import android.webkit.PermissionRequest
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat

/**
 * Fitr camera patch: bridges a page's getUserMedia() camera request to the Android runtime
 * CAMERA permission.
 *
 * Policy (deliberately narrow):
 * - Only the shell's own origin (the start URL's scheme/host/port, https://fitr.day in release)
 *   may get anything. Every other origin, including iframes from other sites, is denied.
 * - Only [PermissionRequest.RESOURCE_VIDEO_CAPTURE] is ever granted. Fitr asks for
 *   `{ video, audio: false }`; microphone, protected media and MIDI requests are denied.
 * - The WebView grant happens only after the OS-level CAMERA permission is granted.
 *
 * Must be constructed in Activity.onCreate (before STARTED), because it registers an
 * activity-result launcher. All methods run on the main thread (WebChromeClient callbacks and
 * activity results are both delivered there).
 */
class CameraPermissionGate(
    private val activity: ComponentActivity,
    allowedOriginUrl: String,
    private val isDebug: Boolean,
) {
    private val allowedOrigin: Uri = Uri.parse(allowedOriginUrl)
    private var pending: PermissionRequest? = null

    private val launcher: ActivityResultLauncher<String> =
        activity.registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val request = pending ?: return@registerForActivityResult
            pending = null
            if (granted) {
                grantVideo(request)
            } else {
                // Denied (or "don't ask again"): the page's getUserMedia rejects with
                // NotAllowedError and Fitr's UI shows its camera-blocked message.
                request.deny()
            }
        }

    fun onPermissionRequest(request: PermissionRequest) {
        val wantsVideo = request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
        if (!wantsVideo || !isAllowedOrigin(request.origin)) {
            if (isDebug) {
                Log.w(TAG, "Denied ${request.resources.joinToString()} for ${request.origin}")
            }
            request.deny()
            return
        }
        if (hasCameraPermission()) {
            grantVideo(request)
            return
        }
        // Only one system dialog at a time: a newer request supersedes an older pending one.
        pending?.deny()
        pending = request
        launcher.launch(Manifest.permission.CAMERA)
    }

    fun onPermissionRequestCanceled(request: PermissionRequest) {
        if (pending === request) pending = null
    }

    private fun grantVideo(request: PermissionRequest) {
        request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
    }

    private fun hasCameraPermission(): Boolean =
        ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED

    private fun isAllowedOrigin(origin: Uri?): Boolean {
        if (origin == null) return false
        val scheme = origin.scheme?.lowercase() ?: return false
        if (scheme != allowedOrigin.scheme?.lowercase()) return false
        // Release builds never grant the camera over plain http.
        if (!isDebug && scheme != "https") return false
        if (!origin.host.equals(allowedOrigin.host, ignoreCase = true)) return false
        return effectivePort(origin) == effectivePort(allowedOrigin)
    }

    private fun effectivePort(uri: Uri): Int =
        when {
            uri.port != -1 -> uri.port
            uri.scheme.equals("https", ignoreCase = true) -> 443
            uri.scheme.equals("http", ignoreCase = true) -> 80
            else -> -1
        }

    private companion object {
        const val TAG = "FitrCamera"
    }
}
