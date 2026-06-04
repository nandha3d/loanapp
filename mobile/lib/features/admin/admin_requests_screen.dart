import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class AdminRequestsScreen extends ConsumerWidget {
  const AdminRequestsScreen({super.key, this.isModuleOnly = false});
  final bool isModuleOnly;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(isModuleOnly ? 'Module Upgrades' : 'Branch Requests'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _RequestCard(
              title: isModuleOnly ? 'Chit Funds Expansion Request' : ' Salem Branch Expansion',
              tenant: 'Kandhu Micro Finance',
              date: 'June 02, 2026',
              description: isModuleOnly 
                  ? 'Request to activate the Chit Funds operational suite for Salem area subscribers.'
                  : 'EstablishSalem sub-office, assigning Vijay Chandar as Branch Director with 10 initial staff limits.',
              onApprove: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Request approved successfully')),
                );
              },
              onReject: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Request rejected')),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({
    required this.title,
    required this.tenant,
    required this.date,
    required this.description,
    required this.onApprove,
    required this.onReject,
  });

  final String title;
  final String tenant;
  final String date;
  final String description;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(title, style: AppTypography.nameLg.copyWith(fontSize: 16)),
              ),
              Text(date, style: AppTypography.caption),
            ],
          ),
          const SizedBox(height: 4),
          Text('Tenant: $tenant', style: AppTypography.caption.copyWith(color: AppColors.primary, fontWeight: FontWeight.bold)),
          const Divider(height: 24),
          Text(description, style: AppTypography.body),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: onReject,
                child: const Text('Reject', style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 8),
              AppButton(
                size: AppButtonSize.small,
                label: 'Approve',
                onPressed: onApprove,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
