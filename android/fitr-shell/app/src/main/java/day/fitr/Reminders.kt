package day.fitr

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import org.json.JSONObject

/**
 * Daily clock-in reminders ("2h left: 20 push-ups"). The page hands over a ReminderPlan
 * (src/lib/native/bridge.ts); it is persisted, so BootReceiver can re-arm it after a reboot,
 * app update or clock change. Alarms are inexact but allowed while idle
 * (setAndAllowWhileIdle): no exact-alarm special permission.
 */
object Reminders {
    const val CHANNEL_ID = "clock_in"
    private const val ACTION_FIRE = "day.fitr.action.REMINDER"
    private const val EXTRA_PLAN_ID = "plan"
    private const val EXTRA_OFFSET = "offset"
    private const val KEY_PLAN = "reminder_plan"
    private const val KEY_ARMED = "reminder_armed"
    private const val MAX_OFFSETS = 6
    private const val REQUEST_BASE = 4100
    private const val NOTIFICATION_ID = 4100
    private const val NOTIFICATION_TAP_REQUEST = 4200
    private const val MAX_TEXT = 200
    private const val MAX_HORIZON_MS = 3L * 24 * 60 * 60 * 1000
    private const val TAG = "FitrReminders"

    data class Plan(
        val deadlineMs: Long,
        val offsetsMin: List<Int>,
        val title: String,
        val body: String,
        val openPath: String,
    ) {
        /** Identifies this plan, so an alarm from a replaced plan never fires. */
        val id: String get() = "${deadlineMs}:${(title + body + openPath + offsetsMin).hashCode()}"

        fun toJson(): String =
            JSONObject()
                .put("deadlineMs", deadlineMs)
                .put("offsetsMin", org.json.JSONArray(offsetsMin))
                .put("title", title)
                .put("body", body)
                .put("openPath", openPath)
                .toString()
    }

    /** Parses and validates a page-supplied plan; null when it is unusable. */
    fun parse(json: String?): Plan? {
        if (json == null || json.length > 8_192) return null
        return runCatching {
            val o = JSONObject(json)
            val deadline = o.getLong("deadlineMs")
            val arr = o.getJSONArray("offsetsMin")
            val offsets =
                (0 until arr.length())
                    .map { arr.getInt(it) }
                    .filter { it in 1..(24 * 60) }
                    .distinct()
                    .sortedDescending()
                    .take(MAX_OFFSETS)
            val path = NativeRoutes.sanitizePath(o.optString("openPath", "/")) ?: "/"
            val title = o.optString("title").trim().take(MAX_TEXT)
            val body = o.optString("body").trim().take(MAX_TEXT)
            if (deadline <= 0 || offsets.isEmpty() || title.isEmpty()) null else Plan(deadline, offsets, title, body, path)
        }.getOrNull()
    }

    /** Replaces any previous plan. */
    fun schedule(
        context: Context,
        json: String,
    ) {
        val plan = parse(json)
        if (plan == null) {
            cancel(context)
            return
        }
        prefs(context).edit { putString(KEY_PLAN, plan.toJson()) }
        arm(context, plan)
    }

    fun cancel(context: Context) {
        disarm(context)
        prefs(context).edit { remove(KEY_PLAN) }
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }

    /** Re-arms the persisted plan (boot, update, time change). */
    fun rearm(context: Context) {
        val plan = load(context)
        if (plan == null || plan.deadlineMs <= System.currentTimeMillis()) {
            cancel(context)
            return
        }
        arm(context, plan)
    }

    private fun load(context: Context): Plan? = parse(prefs(context).getString(KEY_PLAN, null))

    private fun arm(
        context: Context,
        plan: Plan,
    ) {
        disarm(context)
        val now = System.currentTimeMillis()
        if (plan.deadlineMs <= now || plan.deadlineMs - now > MAX_HORIZON_MS) return
        val alarms = context.getSystemService(AlarmManager::class.java) ?: return
        var armed = 0
        plan.offsetsMin.forEachIndexed { i, offset ->
            val at = plan.deadlineMs - offset * 60_000L
            if (at <= now + 5_000) return@forEachIndexed
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, firePendingIntent(context, i, plan.id, offset))
            armed = i + 1
        }
        prefs(context).edit { putInt(KEY_ARMED, armed) }
    }

    private fun disarm(context: Context) {
        val alarms = context.getSystemService(AlarmManager::class.java) ?: return
        for (i in 0 until MAX_OFFSETS) {
            val pi =
                PendingIntent.getBroadcast(
                    context,
                    REQUEST_BASE + i,
                    Intent(context, ReminderReceiver::class.java).setAction(ACTION_FIRE),
                    PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
                ) ?: continue
            alarms.cancel(pi)
            pi.cancel()
        }
        prefs(context).edit { remove(KEY_ARMED) }
    }

    private fun firePendingIntent(
        context: Context,
        index: Int,
        planId: String,
        offset: Int,
    ): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            REQUEST_BASE + index,
            Intent(context, ReminderReceiver::class.java)
                .setAction(ACTION_FIRE)
                .putExtra(EXTRA_PLAN_ID, planId)
                .putExtra(EXTRA_OFFSET, offset),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    /** Called by ReminderReceiver when an alarm goes off. */
    internal fun onAlarm(
        context: Context,
        intent: Intent,
    ) {
        if (intent.action != ACTION_FIRE) return
        val plan = load(context) ?: return
        if (intent.getStringExtra(EXTRA_PLAN_ID) != plan.id) return
        val now = System.currentTimeMillis()
        if (plan.deadlineMs <= now) return
        val offset = intent.getIntExtra(EXTRA_OFFSET, 0)
        // The alarm may be late (Doze): never claim more time than is really left.
        val leftMin = minOf(offset.toLong(), (plan.deadlineMs - now) / 60_000L).toInt().coerceAtLeast(1)
        val left = formatLeft(leftMin)
        notify(
            context,
            plan.title.replace("{left}", left),
            plan.body.replace("{left}", left),
            plan.openPath,
            plan.deadlineMs - now,
        )
        FitrWidget.refreshAll(context)
    }

    /** 120 -> "2h", 90 -> "1h 30m", 30 -> "30m". */
    fun formatLeft(minutes: Int): String {
        val h = minutes / 60
        val m = minutes % 60
        return when {
            h > 0 && m == 0 -> "${h}h"
            h > 0 -> "${h}h ${m}m"
            else -> "${m}m"
        }
    }

    fun ensureChannel(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java) ?: return
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        val channel =
            NotificationChannel(CHANNEL_ID, context.getString(R.string.channel_clock_in), NotificationManager.IMPORTANCE_HIGH)
        channel.description = context.getString(R.string.channel_clock_in_description)
        nm.createNotificationChannel(channel)
    }

    fun canNotify(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return false
        }
        return NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    private fun notify(
        context: Context,
        title: String,
        body: String,
        openPath: String,
        timeoutMs: Long,
    ) {
        if (!canNotify(context)) return
        ensureChannel(context)
        val tap =
            PendingIntent.getActivity(
                context,
                NOTIFICATION_TAP_REQUEST,
                NativeRoutes.openIntent(context, openPath),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val notification =
            NotificationCompat
                .Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_fitr)
                .setColor(ContextCompat.getColor(context, R.color.fitr_lime))
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(tap)
                .setAutoCancel(true)
                .setTimeoutAfter(timeoutMs.coerceAtLeast(60_000L))
                .build()
        try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
        } catch (e: SecurityException) {
            Log.w(TAG, "Notification permission revoked", e)
        }
    }

    internal fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    const val PREFS = "fitr_native"
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        Reminders.onAlarm(context, intent)
    }
}

/** Re-arms reminders and refreshes the widget after reboot, app update or a clock/zone change. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            -> {
                Reminders.rearm(context)
                FitrWidget.refreshAll(context)
            }
        }
    }
}
