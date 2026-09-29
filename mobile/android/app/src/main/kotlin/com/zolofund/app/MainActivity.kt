package com.zolofund.app

import android.content.ComponentCallbacks2
import io.flutter.embedding.android.FlutterFragmentActivity

// FragmentActivity is required by the local_auth plugin — with the plain
// FlutterActivity every biometric prompt throws no_fragment_activity and the
// lock screen can never be dismissed.
class MainActivity : FlutterFragmentActivity() {
    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        // Cooperate with Android OS Low Memory Killer (LMK):
        // When app is backgrounded (TRIM_MEMORY_UI_HIDDEN) or under memory pressure,
        // release non-critical graphics buffers so Android never terminates the process.
        if (level >= ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN) {
            flutterEngine?.renderer?.clearCurrentFrame()
        }
    }
}
