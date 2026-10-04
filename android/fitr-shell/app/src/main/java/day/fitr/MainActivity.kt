package day.fitr

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.net.toUri
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import day.fitr.ui.theme.WebShellTheme
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    // Fitr file-chooser patch (profile photo): <input type="file"> opens the system picker.
    // Registered as a property so it exists before the activity is STARTED.
    private var pendingFileCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = pendingFileCallback
            pendingFileCallback = null
            callback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
        }

    private fun showFileChooser(
        callback: ValueCallback<Array<Uri>>,
        params: WebChromeClient.FileChooserParams,
    ): Boolean {
        pendingFileCallback?.onReceiveValue(null)
        pendingFileCallback = callback
        try {
            fileChooserLauncher.launch(params.createIntent())
        } catch (_: ActivityNotFoundException) {
            pendingFileCallback = null
            callback.onReceiveValue(null)
        }
        return true
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        // Fitr camera patch: must be created before the activity is STARTED.
        val cameraGate =
            CameraPermissionGate(
                activity = this,
                allowedOriginUrl = normalizeHttpUrl().orEmpty(),
                isDebug = BuildConfig.DEBUG,
            )
        setContent {
            WebShellTheme {
                WebShellScreen(cameraGate, ::showFileChooser)
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebShellScreen(
    cameraGate: CameraPermissionGate,
    onShowFileChooser: (ValueCallback<Array<Uri>>, WebChromeClient.FileChooserParams) -> Boolean,
) {
    val context = LocalContext.current
    val startUrl = remember { normalizeHttpUrl() }
    if (startUrl == null) {
        Log.e(TAG, "SOLANA_MOBILE_URL is not a valid http(s) URL")
        return
    }
    val scopeHost = remember(startUrl) { startUrl.toUri().host.orEmpty() }
    val refreshIndicatorColor = MaterialTheme.colorScheme.primary.toArgb()
    val refreshIndicatorBackgroundColor = MaterialTheme.colorScheme.surface.toArgb()

    var progress by remember { mutableFloatStateOf(0f) }
    var isLoading by remember { mutableStateOf(true) }
    var isRefreshing by remember { mutableStateOf(false) }
    var hasError by remember { mutableStateOf(false) }
    var showSplash by remember { mutableStateOf(true) }

    val webView =
        remember {
            WebView(context).apply {
                layoutParams =
                    ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    )
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.databaseEnabled = true
                settings.loadWithOverviewMode = false
                settings.useWideViewPort = false
                settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                settings.builtInZoomControls = true
                settings.displayZoomControls = false
                settings.setSupportZoom(true)
                settings.javaScriptCanOpenWindowsAutomatically = true
                settings.setSupportMultipleWindows(true)
                settings.offscreenPreRaster = true
                // Fitr camera patch: the camera <video> autoplays without a tap.
                settings.mediaPlaybackRequiresUserGesture = false

                val originalUa = settings.userAgentString
                settings.userAgentString =
                    appendUserAgentMarker(
                        baseUserAgent = originalUa,
                    )

                if (BuildConfig.DEBUG) {
                    Log.i(TAG, "UA original: $originalUa")
                    Log.i(TAG, "UA verify:   ${settings.userAgentString}")
                }

                CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)

                webChromeClient =
                    WebShellChromeClient(
                        onProgressChanged = { newProgress ->
                            progress = newProgress / 100f
                            if (newProgress > 0) showSplash = false
                            isLoading = newProgress < 100
                        },
                        isDebug = BuildConfig.DEBUG,
                        onPermissionRequest = cameraGate::onPermissionRequest,
                        onPermissionRequestCanceled = cameraGate::onPermissionRequestCanceled,
                        onShowFileChooser = onShowFileChooser,
                    )

                webViewClient =
                    object : WebShellViewClient(context, scopeHostProvider = { scopeHost }) {
                        override fun onPageFinished(
                            view: WebView,
                            url: String?,
                        ) {
                            super.onPageFinished(view, url)
                            hasError = false
                            isRefreshing = false
                            probeViewportAndMaybePatch(view, BuildConfig.DEBUG)
                        }

                        override fun onReceivedError(
                            view: WebView?,
                            request: WebResourceRequest?,
                            error: WebResourceError?,
                        ) {
                            super.onReceivedError(view, request, error)
                            if (request?.isForMainFrame == true) {
                                hasError = true
                                isRefreshing = false
                            }
                        }
                    }

                loadUrl(startUrl)
            }
        }
    val swipeRefreshLayout =
        remember(webView, refreshIndicatorColor, refreshIndicatorBackgroundColor) {
            SwipeRefreshLayout(context).apply {
                layoutParams =
                    ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    )
                setColorSchemeColors(
                    refreshIndicatorColor,
                )
                setProgressBackgroundColorSchemeColor(refreshIndicatorBackgroundColor)
                // Never pull-to-refresh during a workout: a reload would drop the live session.
                setOnChildScrollUpCallback { _, _ ->
                    webView.canScrollVertically(-1) || isNoRefreshPath(webView.url)
                }
                setOnRefreshListener {
                    hasError = false
                    isLoading = true
                    isRefreshing = true
                    webView.reload()
                }
                addView(webView)
            }
        }

    DisposableEffect(Unit) {
        onDispose {
            swipeRefreshLayout.removeView(webView)
            webView.destroy()
        }
    }

    BackHandler(enabled = webView.canGoBack()) {
        webView.goBack()
    }

    WebViewLayer(
        modifier =
            Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .windowInsetsPadding(WindowInsets.systemBars),
        swipeRefreshLayout = swipeRefreshLayout,
        isRefreshing = isRefreshing,
        isLoading = isLoading,
        progress = progress,
        hasError = hasError,
        showSplash = showSplash,
        onRetry = {
            hasError = false
            isLoading = true
            isRefreshing = false
            webView.reload()
        },
    )
}

@Composable
private fun WebViewLayer(
    modifier: Modifier,
    swipeRefreshLayout: SwipeRefreshLayout,
    isRefreshing: Boolean,
    isLoading: Boolean,
    progress: Float,
    hasError: Boolean,
    showSplash: Boolean,
    onRetry: () -> Unit,
) {
    Box(modifier = modifier) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { swipeRefreshLayout },
            update = { view ->
                view.layoutParams =
                    ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    )
                view.isEnabled = !hasError
                view.isRefreshing = isRefreshing
            },
        )

        if (isLoading && !hasError) {
            LinearProgressIndicator(
                progress = { progress },
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .align(Alignment.TopCenter),
            )
        }

        if (hasError) {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.background.copy(alpha = 0.96f)),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "Unable to load page",
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = onRetry) {
                        Text("Retry")
                    }
                }
            }
        }

        AnimatedVisibility(
            visible = showSplash,
            exit = fadeOut(),
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.background),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator()
            }
        }
    }
}

private fun probeViewportAndMaybePatch(
    webView: WebView,
    isDebug: Boolean,
) {
    webView.evaluateJavascript(VIEWPORT_PROBE_AND_PATCH_SCRIPT) { rawResult ->
        val decoded = decodeJavascriptStringResult(rawResult)
        val parsed = runCatching { JSONObject(decoded) }.getOrNull()
        val isBroken = parsed?.optBoolean("broken") == true
        if (isDebug || isBroken) {
            Log.i(TAG, "[VP] ${parsed?.toString() ?: decoded}")
        }
    }
}

private fun decodeJavascriptStringResult(rawResult: String?): String {
    if (rawResult.isNullOrBlank() || rawResult == "null") return ""
    return runCatching { JSONObject("{\"value\":$rawResult}").getString("value") }
        .getOrDefault(rawResult)
}

private fun appendUserAgentMarker(baseUserAgent: String): String {
    val marker = "Solana Mobile Web Shell"
    if (marker.isEmpty()) return baseUserAgent.trim()
    return if (baseUserAgent.contains(marker)) {
        baseUserAgent.trim()
    } else {
        "${baseUserAgent.trim()} $marker".trim()
    }
}

private fun normalizeHttpUrl(): String? {
    val trimmed = BuildConfig.SOLANA_MOBILE_URL.trim()
    if (trimmed.isEmpty()) return null
    val withScheme =
        if ("://" in trimmed) {
            trimmed
        } else {
            "https://$trimmed"
        }
    val uri = withScheme.toUri()
    val scheme = uri.scheme?.lowercase()
    if (scheme != "http" && scheme != "https") return null
    if (uri.host.isNullOrBlank()) return null
    return uri.toString()
}

/** Routes where pull-to-refresh is disabled (an accidental reload would end the workout). */
private fun isNoRefreshPath(url: String?): Boolean {
    val path = url?.toUri()?.path ?: return false
    return path == "/workout" || path.startsWith("/workout/")
}

private const val TAG = "WebShell"

private val VIEWPORT_PROBE_AND_PATCH_SCRIPT =
    """
    (function () {
      function measureViewport() {
        var probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;';
        document.documentElement.appendChild(probe);
        probe.style.height = '100vh';
        var vh = probe.getBoundingClientRect().height;
        probe.style.height = '100dvh';
        var dvh = probe.getBoundingClientRect().height;
        document.documentElement.removeChild(probe);
        return {
          innerHeight: window.innerHeight || 0,
          visualViewportHeight: window.visualViewport ? window.visualViewport.height : 0,
          vh: vh,
          dvh: dvh
        };
      }

      function updateViewportVars() {
        var px = Math.max(window.innerHeight || 0, 1) + 'px';
        document.documentElement.style.setProperty('--webshell-vh-px', px);
        document.documentElement.style.setProperty('--webshell-dvh-px', px);
      }

      function applyFallbackPatch() {
        updateViewportVars();
        if (!window.__webshell_viewport_resize_hook__) {
          window.__webshell_viewport_resize_hook__ = true;
          window.addEventListener('resize', updateViewportVars);
          window.addEventListener('orientationchange', updateViewportVars);
          if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', updateViewportVars);
          }
        }

        var style = document.getElementById('__webshell_viewport_patch_style__');
        if (!style) {
          style = document.createElement('style');
          style.id = '__webshell_viewport_patch_style__';
          style.textContent = [
            ':root { --webshell-vh-px: 100vh; --webshell-dvh-px: 100vh; }',
            'html, body, #root, #app { min-height: var(--webshell-dvh-px) !important; height: auto !important; }',
            '[class~="h-screen"], [class~="h-dvh"], [class*="h-screen"], [class*="h-dvh"] { height: var(--webshell-dvh-px) !important; }',
            '[class~="min-h-screen"], [class~="min-h-dvh"], [class*="min-h-screen"], [class*="min-h-dvh"] { min-height: var(--webshell-dvh-px) !important; }',
            '[class~="max-h-screen"], [class~="max-h-dvh"], [class*="max-h-screen"], [class*="max-h-dvh"] { max-height: var(--webshell-dvh-px) !important; }'
          ].join('\\n');
          document.documentElement.appendChild(style);
        }

        var classElements = document.querySelectorAll('[class]');
        for (var i = 0; i < classElements.length; i++) {
          var className = classElements[i].className;
          if (typeof className !== 'string') continue;
          if (className.indexOf('max-h-[calc(100dvh-1rem)]') !== -1 || className.indexOf('max-h-[calc(100vh-1rem)]') !== -1) {
            classElements[i].style.maxHeight = 'calc(var(--webshell-dvh-px) - 1rem)';
          }
        }
      }

      var before = measureViewport();
      var broken = before.innerHeight > 0 && (before.vh <= 1 || before.dvh <= 1);
      if (broken) {
        applyFallbackPatch();
      }
      var after = measureViewport();
      return JSON.stringify({
        broken: broken,
        patched: broken,
        before: before,
        after: after
      });
    })();
    """.trimIndent()
