package com.alchim

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.*

class FilePickerModule(ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx), ActivityEventListener {

    companion object {
        private const val PICK_PDF_REQUEST = 9001
    }

    private var pendingPromise: Promise? = null

    init {
        ctx.addActivityEventListener(this)
    }

    override fun getName() = "FilePicker"

    @ReactMethod
    fun pickPdf(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No activity available")
            return
        }
        pendingPromise = promise

        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/pdf"
        }
        activity.startActivityForResult(intent, PICK_PDF_REQUEST)
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != PICK_PDF_REQUEST) return
        val promise = pendingPromise ?: return
        pendingPromise = null

        if (resultCode == Activity.RESULT_OK && data?.data != null) {
            val uri: Uri = data.data!!
            try {
                reactApplicationContext.contentResolver.takePersistableUriPermission(
                    uri, Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            } catch (_: Exception) {}
            promise.resolve(uri.toString())
        } else {
            promise.resolve(null) // user cancelled
        }
    }

    // Non-nullable Intent to match ActivityEventListener interface signature
    override fun onNewIntent(intent: Intent) {}
}
