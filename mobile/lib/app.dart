import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
          child: _BackButtonGuard(
            router: router,
            child: child ?? const SizedBox.shrink(),
          ),
        );
      },
    );
  }
}

/// All routes navigate with `context.go()` (single flat stack, no per-tab
/// shell), so the system back button used to have nothing left to pop after
/// a tab switch and would exit the app straight away. This intercepts that:
/// pop within the route stack if possible, else return to the dashboard tab,
/// else require a second back press within 2s to actually exit.
class _BackButtonGuard extends StatefulWidget {
  const _BackButtonGuard({required this.router, required this.child});
  final GoRouter router;
  final Widget child;

  @override
  State<_BackButtonGuard> createState() => _BackButtonGuardState();
}

class _BackButtonGuardState extends State<_BackButtonGuard> {
  DateTime? _lastBackPress;

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        if (widget.router.canPop()) {
          widget.router.pop();
          return;
        }
        final loc =
            widget.router.routerDelegate.currentConfiguration.uri.toString();
        if (loc != '/dashboard') {
          widget.router.go('/dashboard');
          return;
        }
        final now = DateTime.now();
        if (_lastBackPress != null &&
            now.difference(_lastBackPress!) < const Duration(seconds: 2)) {
          SystemNavigator.pop();
          return;
        }
        _lastBackPress = now;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Press back again to exit'),
            duration: Duration(seconds: 2),
          ),
        );
      },
      child: widget.child,
    );
  }
}
