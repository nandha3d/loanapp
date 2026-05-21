import 'package:flutter/material.dart';

import 'package:loantrack/shared/widgets/stub_screen.dart';

class ApprovalsScreen extends StatelessWidget {
  const ApprovalsScreen({super.key});

  @override
  Widget build(BuildContext context) => const StubScreen(
        title: 'Approvals',
        sprint: 'Sprint 5',
        icon: Icons.fact_check_outlined,
        currentRoute: '/approvals',
      );
}
