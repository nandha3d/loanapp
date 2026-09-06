import 'package:flutter/material.dart';

import 'package:zolofund/shared/widgets/bottom_nav.dart';
import 'package:zolofund/shared/widgets/empty_state.dart';

/// Placeholder screen for modules not yet built (post-Sprint-1 work).
class StubScreen extends StatelessWidget {
  const StubScreen({
    super.key,
    required this.title,
    required this.sprint,
    required this.icon,
    required this.currentRoute,
  });

  final String title;
  final String sprint;
  final IconData icon;
  final String currentRoute;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title), centerTitle: true),
      body: EmptyState(
        icon: icon,
        title: title,
        subtitle: 'Coming in $sprint.',
      ),
      bottomNavigationBar: AppBottomNav(currentRoute: currentRoute),
    );
  }
}
