import 'package:flutter/material.dart';

import 'package:loantrack/shared/widgets/stub_screen.dart';

class AnalyticsScreen extends StatelessWidget {
  const AnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context) => const StubScreen(
        title: 'Analytics',
        sprint: 'Sprint 6',
        icon: Icons.bar_chart_outlined,
        currentRoute: '/analytics',
      );
}
