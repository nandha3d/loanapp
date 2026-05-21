import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/services/loan_service.dart';
import 'package:loantrack/shared/widgets/app_badge.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/fab_extended.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

final _loansProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(loanServiceProvider).list();
});

class LoansScreen extends ConsumerWidget {
  const LoansScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_loansProvider);
    final fmt =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Loans'),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/dashboard'),
        ),
      ),
      body: async.when(
        loading: () => ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: 5,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, __) => const Skeleton(height: 80, borderRadius: 12),
        ),
        error: (e, _) => EmptyState(
          icon: Icons.cloud_off,
          title: 'Could not load loans',
          subtitle: e.toString(),
        ),
        data: (loans) => loans.isEmpty
            ? const EmptyState(
                icon: Icons.account_balance_wallet_outlined,
                title: 'No loans',
                subtitle: 'Tap the button below to create one.',
              )
            : RefreshIndicator(
                color: AppColors.primary,
                onRefresh: () async => ref.refresh(_loansProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                  itemCount: loans.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => _LoanTile(
                    loan: loans[i],
                    fmt: fmt,
                    onTap: () =>
                        context.push('/loans/${loans[i]['id']}'),
                  ),
                ),
              ),
      ),
      floatingActionButton: FabExtended(
        icon: Icons.add,
        label: 'New Loan',
        onPressed: () => context.push('/loans/new'),
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/loans'),
    );
  }
}

class _LoanTile extends StatelessWidget {
  const _LoanTile({required this.loan, required this.fmt, required this.onTap});
  final Map<String, dynamic> loan;
  final NumberFormat fmt;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final customer = (loan['customer'] as Map<String, dynamic>?) ?? const {};
    final principalRaw = loan['principal'];
    final principal = principalRaw is num
        ? principalRaw.toDouble()
        : double.tryParse(principalRaw?.toString() ?? '0') ?? 0;
    final status = (loan['status'] as String?) ?? 'pending_review';
    final BadgeKind kind = switch (status) {
      'active' => BadgeKind.active,
      'overdue' => BadgeKind.overdue,
      'closed' => BadgeKind.closed,
      'pending_review' || 'pending' => BadgeKind.pending,
      _ => BadgeKind.info,
    };

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppTokens.radius),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTokens.radius),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
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
                      loan['loanCode']?.toString() ?? '—',
                      style: AppTypography.bodyLarge.copyWith(
                        fontFamily: 'monospace',
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      customer['name']?.toString() ?? '—',
                      style: AppTypography.caption,
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(fmt.format(principal),
                      style: AppTypography.bodyLarge.copyWith(
                          color: AppColors.primaryDark)),
                  const SizedBox(height: 4),
                  AppBadge(label: status, kind: kind),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
