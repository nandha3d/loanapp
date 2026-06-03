import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';

class DeveloperAdminScreen extends ConsumerWidget {
  const DeveloperAdminScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Developer Console'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Stats Header
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF4F46E5), Color(0xFF312E81)],
                ),
                boxShadow: AppTokens.shadowLg,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Platform Overview',
                    style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _MiniStat(label: 'Total Tenants', value: '42'),
                      _MiniStat(label: 'Active Users', value: '184'),
                      _MiniStat(label: 'Monthly Rev', value: '₹1.2M'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            Text(
              'Administration',
              style: AppTypography.sectionTitle,
            ),
            const SizedBox(height: 12),

            // Navigation Grid
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1.3,
              children: [
                _AdminTile(
                  icon: Icons.business_outlined,
                  color: AppColors.primary,
                  label: 'Tenant List',
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Loading tenant registry...')),
                    );
                  },
                ),
                _AdminTile(
                  icon: Icons.receipt_long_outlined,
                  color: AppColors.success,
                  label: 'Billing & Invoices',
                  onTap: () {
                    context.go('/admin/billing');
                  },
                ),
                _AdminTile(
                  icon: Icons.sell_outlined,
                  color: AppColors.info,
                  label: 'Pricing Catalog',
                  onTap: () {
                    context.go('/admin/billing/pricing');
                  },
                ),
                _AdminTile(
                  icon: Icons.people_outline,
                  color: AppColors.warning,
                  label: 'Users & Roles',
                  onTap: () {
                    context.go('/admin/users');
                  },
                ),
                _AdminTile(
                  icon: Icons.alt_route_outlined,
                  color: AppColors.danger,
                  label: 'Branch Control',
                  onTap: () {
                    context.go('/admin/branches');
                  },
                ),
                _AdminTile(
                  icon: Icons.handshake_outlined,
                  color: Colors.purple,
                  label: 'Affiliates',
                  onTap: () {
                    context.go('/admin/affiliates');
                  },
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Pending request review queues
            Text(
              'System Review Queues',
              style: AppTypography.sectionTitle,
            ),
            const SizedBox(height: 12),

            _QueueTile(
              label: 'Module Activation Requests',
              count: 3,
              color: AppColors.warning,
              onTap: () {},
            ),
            const SizedBox(height: 8),
            _QueueTile(
              label: 'Branch Extension Requests',
              count: 1,
              color: AppColors.info,
              onTap: () {},
            ),
          ],
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(color: Colors.white60, fontSize: 11),
        ),
      ],
    );
  }
}

class _AdminTile extends StatelessWidget {
  const _AdminTile({
    required this.icon,
    required this.color,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTokens.radius),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppTokens.radius),
          boxShadow: AppTokens.shadow,
          border: Border.all(color: AppColors.border, width: 1),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withAlpha(24),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            Text(
              label,
              style: AppTypography.bodyLarge.copyWith(fontWeight: FontWeight.w700, fontSize: 13),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _QueueTile extends StatelessWidget {
  const _QueueTile({
    required this.label,
    required this.count,
    required this.color,
    required this.onTap,
  });

  final String label;
  final int count;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Row(
        children: [
          Icon(Icons.queue_play_next_outlined, color: color, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(label, style: AppTypography.body),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: color.withAlpha(24),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              '$count Pending',
              style: AppTypography.tiny.copyWith(color: color, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }
}
