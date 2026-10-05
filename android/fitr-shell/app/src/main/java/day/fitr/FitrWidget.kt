package day.fitr

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import org.json.JSONObject

/**
 * "Fitr — Today" home-screen widget: streak, today's goal, stake, time left and a mode-specific
 * call to action. The page pushes a WidgetState (src/lib/native/bridge.ts) through the bridge;
 * it is persisted and rendered here. The countdown refreshes itself with inexact, non-waking
 * alarms (only while the screen is on) plus the provider's 30-minute updatePeriodMillis.
 */
object FitrWidget {
    private const val KEY_STATE = "widget_state"
    private const val ACTION_TICK = "day.fitr.action.WIDGET_TICK"
    private const val TAP_REQUEST = 4300
    private const val TICK_REQUEST = 4301
    private val MODES = setOf("none", "commit", "committed", "verifying", "verified", "claimable", "missed")

    data class State(
        val mode: String = "none",
        val streak: Int = 0,
        val goalLabel: String = "",
        val stakeLabel: String = "",
        val deadlineMs: Long = 0,
        val openPath: String = "/",
    ) {
        fun toJson(): String =
            JSONObject()
                .put("mode", mode)
                .put("streak", streak)
                .put("goalLabel", goalLabel)
                .put("stakeLabel", stakeLabel)
                .put("deadlineMs", deadlineMs)
                .put("openPath", openPath)
                .toString()
    }

    fun parse(json: String?): State? {
        if (json == null || json.length > 4_096) return null
        return runCatching {
            val o = JSONObject(json)
            val mode = o.optString("mode", "none")
            State(
                mode = if (mode in MODES) mode else "none",
                streak = o.optInt("streak", 0).coerceIn(0, 99_999),
                goalLabel = o.optString("goalLabel").trim().take(40),
                stakeLabel = o.optString("stakeLabel").trim().take(32),
                deadlineMs = o.optLong("deadlineMs", 0L).coerceAtLeast(0L),
                openPath = NativeRoutes.sanitizePath(o.optString("openPath", "/")) ?: "/",
            )
        }.getOrNull()
    }

    /** Bridge entry: persist the page's state and redraw every placed widget. */
    fun update(
        context: Context,
        json: String,
    ) {
        val state = parse(json) ?: return
        prefs(context).edit { putString(KEY_STATE, state.toJson()) }
        refreshAll(context)
    }

    fun load(context: Context): State = parse(prefs(context).getString(KEY_STATE, null)) ?: State()

    fun refreshAll(context: Context) {
        val manager = AppWidgetManager.getInstance(context) ?: return
        val ids = manager.getAppWidgetIds(ComponentName(context, FitrWidgetProvider::class.java))
        if (ids.isEmpty()) {
            cancelTick(context)
            return
        }
        render(context, manager, ids)
    }

    fun render(
        context: Context,
        manager: AppWidgetManager,
        ids: IntArray,
    ) {
        val state = load(context)
        val now = System.currentTimeMillis()
        val views = buildViews(context, state, now)
        for (id in ids) manager.updateAppWidget(id, views)
        scheduleTick(context, state, now)
    }

    private fun buildViews(
        context: Context,
        s: State,
        now: Long,
    ): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_today)
        val left = if (s.deadlineMs > now) timeLeft(s.deadlineMs - now) else null
        val goal = s.goalLabel.ifEmpty { "Today's goal" }

        val title: String
        val sub: String
        val cta: String?
        var titleLime = false
        when (s.mode) {
            "commit" -> {
                title = "Commit today"
                sub = if (left != null) "Commit window closes in ${left.removeSuffix(" left")}" else "Stake SKR on today's goal"
                cta = "Commit"
            }
            "committed" -> {
                title = if (left != null) "$goal · $left" else "$goal · time's up"
                sub = if (s.stakeLabel.isNotEmpty()) "${s.stakeLabel} at stake" else "Finish before the deadline"
                cta = "Start"
            }
            "verifying" -> {
                title = "Verifying…"
                sub = "$goal done · checking onchain"
                cta = "Open"
            }
            "verified" -> {
                title = "Verified ✓"
                titleLime = true
                sub = "$goal done. See you tomorrow"
                cta = null
            }
            "claimable" -> {
                title = "Claim ready"
                titleLime = true
                sub = if (s.stakeLabel.isNotEmpty()) "${s.stakeLabel} waiting for you" else "Your stake is waiting"
                cta = "Claim"
            }
            "missed" -> {
                title = "Missed today"
                sub = "Commit again and restart your streak"
                cta = "Commit"
            }
            else -> {
                title = "Clock in today"
                sub = if (s.streak > 0) "Keep your ${s.streak}-day streak going" else "Your daily workout, counted on-device"
                cta = "Train"
            }
        }

        val lime = ContextCompat.getColor(context, R.color.fitr_lime)
        val white = ContextCompat.getColor(context, R.color.fitr_text)
        views.setTextViewText(R.id.widget_title, title)
        views.setTextColor(R.id.widget_title, if (titleLime) lime else white)
        views.setTextViewText(R.id.widget_sub, sub)
        views.setTextViewText(
            R.id.widget_streak,
            if (s.streak == 1) "1-day streak" else "${s.streak}-day streak",
        )
        if (cta != null) {
            views.setViewVisibility(R.id.widget_cta, View.VISIBLE)
            views.setTextViewText(R.id.widget_cta, cta)
        } else {
            views.setViewVisibility(R.id.widget_cta, View.GONE)
        }
        val tap =
            PendingIntent.getActivity(
                context,
                TAP_REQUEST,
                NativeRoutes.openIntent(context, s.openPath),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        views.setOnClickPendingIntent(R.id.widget_root, tap)
        views.setContentDescription(R.id.widget_root, "Fitr. $title. $sub")
        return views
    }

    /** "3h left" (whole hours from 1h up), "42m left", "<1m left". */
    fun timeLeft(ms: Long): String {
        val minutes = ms / 60_000L
        return when {
            minutes >= 60 -> "${minutes / 60}h left"
            minutes >= 1 -> "${minutes}m left"
            else -> "<1m left"
        }
    }

    /** Next moment the countdown text changes (hour boundary, then every 5 min), or the deadline. */
    private fun scheduleTick(
        context: Context,
        s: State,
        now: Long,
    ) {
        val left = s.deadlineMs - now
        if (s.deadlineMs <= 0 || left <= 0 || s.mode !in setOf("commit", "committed")) {
            cancelTick(context)
            return
        }
        val hour = 3_600_000L
        val delay =
            when {
                left >= hour -> left % hour + 1_000L
                left > 5 * 60_000L -> 5 * 60_000L
                else -> left + 1_000L
            }
        val alarms = context.getSystemService(AlarmManager::class.java) ?: return
        // RTC (not _WAKEUP): never wakes the phone; delivered when the screen is next on.
        alarms.set(AlarmManager.RTC, now + delay.coerceAtLeast(60_000L), tickIntent(context))
    }

    private fun cancelTick(context: Context) {
        context.getSystemService(AlarmManager::class.java)?.cancel(tickIntent(context))
    }

    private fun tickIntent(context: Context): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            TICK_REQUEST,
            Intent(context, FitrWidgetProvider::class.java).setAction(ACTION_TICK),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    internal fun isTick(intent: Intent) = intent.action == ACTION_TICK

    private fun prefs(context: Context) = context.getSharedPreferences(Reminders.PREFS, Context.MODE_PRIVATE)
}

class FitrWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        FitrWidget.refreshAll(context)
    }

    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        if (FitrWidget.isTick(intent)) {
            FitrWidget.refreshAll(context)
            return
        }
        super.onReceive(context, intent)
    }

    override fun onDisabled(context: Context) {
        FitrWidget.refreshAll(context)
    }
}
