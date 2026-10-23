package com.example.eco_loop

import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    private var startupSplash: StartupSplashView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startupSplash = StartupSplashView(this)
        addContentView(
            startupSplash,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ),
        )
    }

    override fun onFlutterUiDisplayed() {
        super.onFlutterUiDisplayed()
        startupSplash?.let { splash ->
            (splash.parent as? ViewGroup)?.removeView(splash)
            startupSplash = null
        }
    }
}

private class StartupSplashView(context: Context) : View(context) {
    private val density = resources.displayMetrics.density
    private val icon = BitmapFactory.decodeResource(resources, R.drawable.eco_loop_icon)
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val iconRect = RectF()
    private val spinnerRect = RectF()

    init {
        setBackgroundColor(Color.rgb(248, 250, 246))
        paint.typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.NORMAL)
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val iconSize = 84f * density
        val contentHeight = 84f + 20f + 43f + 8f + 24f + 28f + 48f
        val top = (height / density - contentHeight) / 2f

        iconRect.set(
            (width - iconSize) / 2f,
            top * density,
            (width + iconSize) / 2f,
            (top + 84f) * density,
        )
        canvas.drawBitmap(icon, null, iconRect, paint)

        paint.textAlign = Paint.Align.CENTER
        paint.color = Color.rgb(32, 40, 32)
        paint.typeface = android.graphics.Typeface.create(
            "sans-serif",
            android.graphics.Typeface.BOLD,
        )
        paint.textSize = 32f * density
        canvas.drawText(
            "EcoLoop AI",
            width / 2f,
            (top + 84f + 20f + 34f) * density,
            paint,
        )

        paint.typeface = android.graphics.Typeface.create(
            "sans-serif",
            android.graphics.Typeface.NORMAL,
        )
        paint.textSize = 18f * density
        canvas.drawText(
            "Making recycling a little greener.",
            width / 2f,
            (top + 84f + 20f + 43f + 8f + 22f) * density,
            paint,
        )

        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 8f * density
        paint.strokeCap = Paint.Cap.BUTT
        paint.color = Color.rgb(23, 107, 69)
        val spinnerSize = 48f * density
        val spinnerTop = (top + 84f + 20f + 43f + 8f + 24f + 28f)
        spinnerRect.set(
            (width - spinnerSize) / 2f,
            spinnerTop * density,
            (width + spinnerSize) / 2f,
            (spinnerTop + 48f) * density,
        )
        canvas.drawArc(spinnerRect, -70f, 280f, false, paint)
        paint.style = Paint.Style.FILL
    }
}
