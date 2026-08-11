package com.alchim

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.util.Base64
import com.facebook.react.bridge.*
import java.io.ByteArrayOutputStream

class PdfRendererModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

    override fun getName() = "PdfRenderer"

    private fun openPfd(uriOrPath: String): ParcelFileDescriptor {
        // Handle both content:// URIs (from DocumentPicker) and file:// / bare paths
        return if (uriOrPath.startsWith("content://") || uriOrPath.startsWith("file://")) {
            val uri = Uri.parse(uriOrPath)
            reactApplicationContext.contentResolver.openFileDescriptor(uri, "r")
                ?: throw IllegalArgumentException("Cannot open URI: $uriOrPath")
        } else {
            val file = java.io.File(uriOrPath)
            ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
        }
    }

    @ReactMethod
    fun renderPageToBase64(uriOrPath: String, pageIndex: Int, promise: Promise) {
        try {
            val pfd = openPfd(uriOrPath)
            val renderer = PdfRenderer(pfd)

            if (pageIndex >= renderer.pageCount) {
                renderer.close()
                pfd.close()
                promise.reject("PAGE_OUT_OF_RANGE", "Page $pageIndex out of range (${renderer.pageCount} pages)")
                return
            }

            val page = renderer.openPage(pageIndex)

            // Render at 2x scale for better OCR quality
            val scale = 2.0f
            val width = (page.width * scale).toInt()
            val height = (page.height * scale).toInt()

            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            canvas.drawColor(Color.WHITE)
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            page.close()
            renderer.close()
            pfd.close()

            val outputStream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 90, outputStream)
            bitmap.recycle()

            val base64 = Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
            promise.resolve(base64)
        } catch (e: Exception) {
            promise.reject("RENDER_ERROR", e.message ?: "Unknown error rendering PDF")
        }
    }

    @ReactMethod
    fun getPageCount(uriOrPath: String, promise: Promise) {
        try {
            val pfd = openPfd(uriOrPath)
            val renderer = PdfRenderer(pfd)
            val count = renderer.pageCount
            renderer.close()
            pfd.close()
            promise.resolve(count)
        } catch (e: Exception) {
            promise.reject("RENDER_ERROR", e.message ?: "Unknown error")
        }
    }
}
