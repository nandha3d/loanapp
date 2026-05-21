import 'package:flutter/material.dart';

import 'package:loantrack/shared/widgets/stub_screen.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) => const StubScreen(
        title: 'Settings',
        sprint: 'Sprint 8',
        icon: Icons.settings_outlined,
        currentRoute: '/settings',
      );
}
