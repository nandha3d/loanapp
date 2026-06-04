import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';

class AffiliateAdminScreen extends ConsumerWidget {
  const AffiliateAdminScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Affiliate Administration'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
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
                  Text('Conversion Overview', style: AppTypography.sectionTitle),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: const [
                      _Stat(label: 'Total Referrals', value: '14'),
                      _Stat(label: 'Conversions', value: '8'),
                      _Stat(label: 'Payouts Pending', value: '₹12,400'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Text('Affiliate Referrals', style: AppTypography.sectionTitle),
            const SizedBox(height: 12),
            _ReferralRow(name: 'Vignesh K', code: 'VIGN1101', date: 'May 28, 2026', conversionRate: '15%', status: 'active'),
            _ReferralRow(name: 'Nandhabalan S', code: 'NAND9837', date: 'May 14, 2026', conversionRate: '8%', status: 'active'),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value, style: AppTypography.nameLg.copyWith(fontSize: 18, color: AppColors.primary)),
        const SizedBox(height: 2),
        Text(label, style: AppTypography.caption),
      ],
    );
  }
}

class _ReferralRow extends StatelessWidget {
  const _ReferralRow({
    required this.name,
    required this.code,
    required this.date,
    required this.conversionRate,
    required this.status,
  });

  final String name;
  final String code;
  final String date;
  final String conversionRate;
  final String status;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, style: AppTypography.nameLg.copyWith(fontSize: 14)),
              Text('Code: $code · Joined: $date', style: AppTypography.caption),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('Conv Rate: $conversionRate', style: AppTypography.nameLg.copyWith(fontSize: 13)),
              const SizedBox(height: 2),
              Text(status.toUpperCase(), style: AppTypography.tiny.copyWith(color: AppColors.success, fontWeight: FontWeight.bold)),
            ],
          ),
        ],
      ),
    );
  }
}
