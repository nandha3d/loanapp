import 'package:flutter/material.dart';

import 'package:loantrack/shared/widgets/stub_screen.dart';

class ChitsScreen extends StatelessWidget {
  const ChitsScreen({super.key});

  @override
  Widget build(BuildContext context) => const StubScreen(
        title: 'Chit Funds',
        sprint: 'Sprint 7',
        icon: Icons.groups_outlined,
        currentRoute: '/chits',
      );
}
