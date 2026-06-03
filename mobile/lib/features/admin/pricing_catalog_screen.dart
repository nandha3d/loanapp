import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';

class PricingCatalogScreen extends ConsumerWidget {
  const PricingCatalogScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Pricing Catalog'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: const [
            _PlanCard(
              name: 'Basic Plan',
              price: '₹2,500/mo',
              features: ['Up to 3 Agents', '1 Branch', 'Standard Core Reports', 'Manual KYC Review Queue'],
            ),
            SizedBox(height: 16),
            _PlanCard(
              name: 'Growth Plan',
              price: '₹5,500/mo',
              features: ['Up to 10 Agents', '3 Branches', 'Premium Accounting Suite', 'Biometric Lock & SMS Config'],
            ),
            SizedBox(height: 16),
            _PlanCard(
              name: 'Enterprise Plan',
              price: '₹8,500/mo',
              features: ['Unlimited Agents', 'Unlimited Branches', 'All Core & Add-on Modules', 'Direct API Access & Webhooks'],
            ),
          ],
        ),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.name, required this.price, required this.features});
  final String name;
  final String price;
  final List<String> features;

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
              Text(name, style: AppTypography.nameLg.copyWith(fontSize: 18, color: AppColors.primary)),
              Text(price, style: AppTypography.nameLg.copyWith(fontSize: 16, fontWeight: FontWeight.bold)),
            ],
          ),
          const Divider(height: 24),
          for (final f in features)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  const Icon(Icons.check, color: AppColors.success, size: 16),
                  const SizedBox(width: 8),
                  Expanded(child: Text(f, style: AppTypography.body)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
