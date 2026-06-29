import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/a11y/ui_prefs.dart';
import 'package:loantrack/core/router/app_router.dart';
import 'package:loantrack/core/theme/app_theme.dart';
import 'package:loantrack/core/theme/theme_controller.dart';

class App extends ConsumerWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    final textScale = ref.watch(textScaleProvider);
    final darkMode = ref.watch(darkModeProvider);
    // Rebuild the ThemeData when the tenant theme changes (see ThemeController).
    ref.watch(themeControllerProvider);
    return MaterialApp.router(
      title: 'LoanTrack',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: darkMode ? ThemeMode.dark : ThemeMode.light,
      routerConfig: router,
      builder: (context, child) {
        // App-wide text-size preference (U6). Multiplies on top of the OS
        // scale, clamped so stacked scaling cannot break layouts.
        final mq = MediaQuery.of(context);
        final effective =
            (mq.textScaler.scale(1.0) * textScale).clamp(0.8, 1.6);
        return MediaQuery(
          data: mq.copyWith(textScaler: TextScaler.linear(effective)),
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
  }
}
