package com.zolofund.app

import io.flutter.embedding.android.FlutterFragmentActivity

// FragmentActivity is required by the local_auth plugin — with the plain
// FlutterActivity every biometric prompt throws no_fragment_activity and the
// lock screen can never be dismissed.
class MainActivity : FlutterFragmentActivity()
