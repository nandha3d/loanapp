import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/customer.dart';
import 'package:loantrack/data/repositories/customer_repository.dart';
import 'package:loantrack/features/customers/widgets/credit_score_ring.dart';
import 'package:loantrack/features/customers/widgets/info_row.dart';
import 'package:loantrack/shared/widgets/app_badge.dart';
import 'package:loantrack/shared/widgets/app_button.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

class CustomerDetailScreen extends ConsumerWidget {
  const CustomerDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(customerDetailProvider(id));
    return Scaffold(
      backgroundColor: AppColors.background,
      body: async.when(
        loading: () => const _LoadingDetail(),
        error: (err, _) => _ErrorDetail(message: err.toString()),
        data: (customer) =>
            _DetailBody(customer: customer, onRefresh: () {
          ref.invalidate(customerDetailProvider(id));
        }),
      ),
    );
  }
}

class _DetailBody extends ConsumerStatefulWidget {
  const _DetailBody({required this.customer, required this.onRefresh});
  final Customer customer;
  final VoidCallback onRefresh;

  @override
  ConsumerState<_DetailBody> createState() => _DetailBodyState();
}

class _DetailBodyState extends ConsumerState<_DetailBody> {
  bool _suspending = false;

  Future<void> _toggleSuspend() async {
    setState(() => _suspending = true);
    try {
      final next = widget.customer.status == 'suspended' ? 'active' : 'suspended';
      await ref
          .read(customerRepositoryProvider)
          .update(widget.customer.id, {'status': next});
      ref.invalidate(customerListProvider);
      widget.onRefresh();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Update failed: $e')),
      );
    } finally {
      if (mounted) setState(() => _suspending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.customer;
    return Column(
      children: [
        _Header(customer: c),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppTokens.radius),
                  boxShadow: AppTokens.shadow,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('CONTACT',
                        style: AppTypography.extraTiny.copyWith(
                            color: AppColors.textLight, letterSpacing: 1)),
                    const SizedBox(height: 8),
                    InfoRow(icon: Icons.phone_outlined, value: c.phone),
                    if (c.address != null)
                      InfoRow(icon: Icons.location_on_outlined, value: c.address!),
                    if (c.aadharNumberMasked != null)
                      InfoRow(
                        icon: Icons.credit_card_outlined,
                        value: c.aadharNumberMasked!,
                        label: 'Aadhaar',
                      ),
                    const Divider(),
                    Text('ASSIGNMENT',
                        style: AppTypography.extraTiny.copyWith(
                            color: AppColors.textLight, letterSpacing: 1)),
                    const SizedBox(height: 8),
                    if (c.routeName != null)
                      InfoRow(icon: Icons.route_outlined, value: c.routeName!, label: 'Route'),
                    if (c.agentName != null)
                      InfoRow(icon: Icons.person_outline, value: c.agentName!, label: 'Agent'),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _ActiveLoansSummary(loans: c.loans),
              const SizedBox(height: 80),
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              border: Border(top: BorderSide(color: AppColors.border)),
              boxShadow: AppTokens.shadowLg,
            ),
            child: Row(
              children: [
                Expanded(
                  child: AppButton(
                    label: c.status == 'suspended' ? 'Unsuspend' : 'Suspend',
                    variant: c.status == 'suspended'
                        ? AppButtonVariant.secondary
                        : AppButtonVariant.danger,
                    expand: true,
                    loading: _suspending,
                    onPressed: _toggleSuspend,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: AppButton(
                    label: 'Edit Profile',
                    expand: true,
                    onPressed: () {}, // Sprint 2b
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.customer});
  final Customer customer;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF1A1D23), Color(0xFF2D1F0E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                  IconButton(
                    icon: const Icon(Icons.more_vert, color: Colors.white),
                    onPressed: () {},
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  customer.initials,
                  style: AppTypography.display.copyWith(color: Colors.white),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                customer.name,
                style: AppTypography.display.copyWith(
                  color: Colors.white,
                  fontSize: 14 * 1.3,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                customer.customerCode,
                style: AppTypography.body.copyWith(
                  color: Colors.white60,
                  fontFamily: 'monospace',
                ),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CreditScoreRing(
                    score: customer.creditScore,
                    diameter: 48,
                    strokeWidth: 5,
                    textColor: Colors.white,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Credit Score: ${customer.creditScore ?? '—'}/100',
                    style: AppTypography.bodySmall.copyWith(
                      color: Colors.white70,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              AppBadge(label: customer.status, kind: _badge(customer.status)),
            ],
          ),
        ),
      ),
    );
  }

  BadgeKind _badge(String s) {
    switch (s) {
      case 'active':
        return BadgeKind.active;
      case 'suspended':
      case 'blacklisted':
        return BadgeKind.overdue;
      case 'pending_review':
      case 'pending':
        return BadgeKind.pending;
      default:
        return BadgeKind.info;
    }
  }
}

class _ActiveLoansSummary extends StatelessWidget {
  const _ActiveLoansSummary({required this.loans});
  final List<CustomerLoanSummary> loans;

  @override
  Widget build(BuildContext context) {
    final active = loans.where((l) => l.status == 'active').toList();
    final outstanding =
        active.fold<double>(0, (sum, l) => sum + l.principal);
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${active.length} Active Loan${active.length == 1 ? '' : 's'}',
                  style: AppTypography.bodyLarge,
                ),
                const SizedBox(height: 4),
                Text(
                  '${fmt.format(outstanding)} outstanding',
                  style: AppTypography.bodySmall.copyWith(color: AppColors.danger),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: AppColors.border),
        ],
      ),
    );
  }
}

class _LoadingDetail extends StatelessWidget {
  const _LoadingDetail();
  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          Skeleton(height: 200, borderRadius: AppTokens.radius),
          SizedBox(height: 16),
          Skeleton(height: 140, borderRadius: AppTokens.radius),
        ],
      ),
    );
  }
}

class _ErrorDetail extends StatelessWidget {
  const _ErrorDetail({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off, size: 56, color: AppColors.textLight),
              const SizedBox(height: 12),
              Text('Could not load customer', style: AppTypography.sectionTitle),
              const SizedBox(height: 6),
              Text(
                message,
                style:
                    AppTypography.body.copyWith(color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
