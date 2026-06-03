import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class TenantBillingScreen extends ConsumerWidget {
  const TenantBillingScreen({super.key, this.isSubscriptionOnly = false});
  final bool isSubscriptionOnly;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(isSubscriptionOnly ? 'Subscription & Plan' : 'Billing & Subscriptions'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Current Plan Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: const LinearGradient(
                  colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                ),
                boxShadow: AppTokens.shadow,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Active Plan', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Enterprise Suite', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.successBg.withAlpha(50),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AppColors.success, width: 1),
                        ),
                        child: const Text('PAID', style: TextStyle(color: AppColors.success, fontSize: 10, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Text('Renews on July 01, 2026 · Billing Frequency: Monthly', style: TextStyle(color: Colors.white60, fontSize: 12)),
                  const Divider(color: Colors.white24, height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Next Payment Due: ₹8,500', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                      AppButton(
                        size: AppButtonSize.small,
                        label: 'Manage Sub',
                        onPressed: () {},
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            if (!isSubscriptionOnly) ...[
              Text('Billing Statements', style: AppTypography.sectionTitle),
              const SizedBox(height: 12),
              _InvoiceRow(invoiceId: 'INV-2026-003', date: 'June 01, 2026', amount: '₹8,500', status: 'paid'),
              _InvoiceRow(invoiceId: 'INV-2026-002', date: 'May 01, 2026', amount: '₹8,500', status: 'paid'),
              _InvoiceRow(invoiceId: 'INV-2026-001', date: 'April 01, 2026', amount: '₹8,500', status: 'paid'),
            ],
          ],
        ),
      ),
    );
  }
}

class _InvoiceRow extends StatelessWidget {
  const _InvoiceRow({
    required this.invoiceId,
    required this.date,
    required this.amount,
    required this.status,
  });

  final String invoiceId;
  final String date;
  final String amount;
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
        children: [
          const Icon(Icons.receipt_outlined, color: AppColors.textSecondary, size: 24),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(invoiceId, style: AppTypography.nameLg.copyWith(fontSize: 14)),
                Text(date, style: AppTypography.caption),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(amount, style: AppTypography.nameLg.copyWith(fontSize: 14)),
              const SizedBox(height: 2),
              Text(status.toUpperCase(), style: AppTypography.tiny.copyWith(color: AppColors.success, fontWeight: FontWeight.bold)),
            ],
          ),
        ],
      ),
    );
  }
}
