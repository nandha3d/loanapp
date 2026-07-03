import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/network/authed_image.dart';
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

class LoansScreen extends ConsumerStatefulWidget {
  const LoansScreen({super.key});

  @override
  ConsumerState<LoansScreen> createState() => _LoansScreenState();
}

class _LoansScreenState extends ConsumerState<LoansScreen> {
  // Default: hide closed loans — only active/ongoing loans are shown until the
  // user opts in via the toggle.
  bool _showClosed = false;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_loansProvider);
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(t.x('title.loans')),
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
          itemBuilder: (_, __) => const Skeleton(height: 84, borderRadius: 12),
        ),
        error: (e, _) => EmptyState(
          icon: Icons.cloud_off,
          title: t.x('err.failed_to_load'),
          subtitle: e.toString(),
        ),
        data: (loans) {
          final closedCount =
              loans.where((l) => (l['status'] as String?) == 'closed').length;
          final visible = _showClosed
              ? loans
              : loans
                  .where((l) => (l['status'] as String?) != 'closed')
                  .toList(growable: false);

          return Column(
            children: [
              _ClosedToggle(
                value: _showClosed,
                closedCount: closedCount,
                activeCount: loans.length - closedCount,
                onChanged: (v) => setState(() => _showClosed = v),
                t: t,
              ),
              Expanded(
                child: RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: () async => ref.refresh(_loansProvider.future),
                  child: visible.isEmpty
                      ? ListView(
                          // Keep it scrollable so pull-to-refresh still works.
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            const SizedBox(height: 80),
                            EmptyState(
                              icon: Icons.account_balance_wallet_outlined,
                              title: t.x('title.loans'),
                              subtitle: _showClosed
                                  ? t.x('empty.tap_new')
                                  : t.x('empty.tap_new'),
                            ),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                          physics: const AlwaysScrollableScrollPhysics(),
                          itemCount: visible.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 10),
                          itemBuilder: (_, i) => _LoanTile(
                            loan: visible[i],
                            fmt: fmt,
                            onTap: () =>
                                context.push('/loans/${visible[i]['id']}'),
                          ),
                        ),
                ),
              ),
            ],
          );
        },
      ),
      floatingActionButton: FabExtended(
        icon: Icons.add,
        label: t.x('title.new_loan'),
        onPressed: () => context.push('/loans/new'),
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/loans'),
    );
  }
}

/// Header strip with the "show closed loans" toggle + live counts.
class _ClosedToggle extends StatelessWidget {
  const _ClosedToggle({
    required this.value,
    required this.closedCount,
    required this.activeCount,
    required this.onChanged,
    required this.t,
  });
  final bool value;
  final int closedCount;
  final int activeCount;
  final ValueChanged<bool> onChanged;
  final T t;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Row(
        children: [
          const Icon(
            Icons.check_circle_outline,
            size: 18,
            color: AppColors.textSecondary,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  t.x('loans.show_closed'),
                  style: AppTypography.bodyLarge.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                Text(
                  value
                      ? '${activeCount + closedCount} ${t.x('loans.total_suffix')}'
                      : '$activeCount ${t.x('loans.active_suffix')} · $closedCount ${t.x('loans.closed_suffix')}',
                  style: AppTypography.caption,
                ),
              ],
            ),
          ),
          Switch.adaptive(
            value: value,
            activeThumbColor: AppColors.primary,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}

class _LoanTile extends ConsumerWidget {
  const _LoanTile({required this.loan, required this.fmt, required this.onTap});
  final Map<String, dynamic> loan;
  final NumberFormat fmt;
  final VoidCallback onTap;

  double _toDouble(dynamic v) => v is num
      ? v.toDouble()
      : double.tryParse(v?.toString() ?? '') ?? 0;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final customer = (loan['customer'] as Map<String, dynamic>?) ?? const {};
    final customerName = customer['name']?.toString() ?? '—';
    final customerPhoto = customer['profilePhoto']?.toString();
    final principal = _toDouble(loan['principal']);
    final status = (loan['status'] as String?) ?? 'pending_review';

    final paid = (loan['paidCount'] as num?)?.toInt() ?? 0;
    final total = (loan['totalInstalments'] as num?)?.toInt() ?? 0;
    final pct = total > 0 ? (paid / total).clamp(0.0, 1.0) : 0.0;

    final BadgeKind kind = switch (status) {
      'active' => BadgeKind.active,
      'overdue' => BadgeKind.overdue,
      'closed' => BadgeKind.closed,
      'pending_review' || 'pending' => BadgeKind.pending,
      _ => BadgeKind.info,
    };
    final Color progressColor = status == 'overdue'
        ? AppColors.danger
        : pct >= 1.0
            ? AppColors.success
            : AppColors.primary;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppTokens.radius),
        child: Material(
          color: AppColors.surface,
          child: InkWell(
            onTap: onTap,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
                  child: Row(
                    children: [
                      _Avatar(
                        name: customerName,
                        size: 44,
                        image: customerPhoto != null && customerPhoto.isNotEmpty
                            ? authedImage(ref, customerPhoto)
                            : null,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              loan['loanCode']?.toString() ?? '—',
                              style: AppTypography.bodyLarge.copyWith(
                                fontFamily: 'monospace',
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              customerName,
                              style: AppTypography.caption,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (total > 0) ...[
                              const SizedBox(height: 4),
                              Text(
                                '$paid / $total · ${(pct * 100).round()}%',
                                style: AppTypography.extraTiny.copyWith(
                                  color: AppColors.textLight,
                                  fontFeatures: const [
                                    FontFeature.tabularFigures(),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            fmt.format(principal),
                            style: AppTypography.bodyLarge.copyWith(
                              color: AppColors.primaryDark,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 6),
                          AppBadge(label: status, kind: kind),
                        ],
                      ),
                    ],
                  ),
                ),
                // Progress bar hugging the bottom edge of the card.
                LinearProgressIndicator(
                  value: pct,
                  minHeight: 4,
                  backgroundColor: AppColors.border.withAlpha(90),
                  valueColor: AlwaysStoppedAnimation<Color>(progressColor),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Customer avatar — profile photo when available (fetched with the Bearer
/// token via [authedImage]), colored initials otherwise.
class _Avatar extends StatelessWidget {
  const _Avatar({required this.name, this.size = 40, this.image});
  final String name;
  final double size;
  final ImageProvider? image;

  Color _color() {
    const palette = [
      AppColors.primary,
      AppColors.info,
      AppColors.purple,
      AppColors.success,
      AppColors.warning,
    ];
    if (name.isEmpty) return AppColors.textLight;
    final h = name.codeUnits.fold<int>(0, (a, b) => (a + b) & 0xFF);
    return palette[h % palette.length];
  }

  String _initials() {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '—';
    return parts
        .take(2)
        .map((p) => p.isEmpty ? '' : p[0].toUpperCase())
        .join();
  }

  @override
  Widget build(BuildContext context) {
    final c = _color();
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: c.withAlpha(40),
        borderRadius: BorderRadius.circular(size / 2),
        image: image != null
            ? DecorationImage(image: image!, fit: BoxFit.cover)
            : null,
      ),
      alignment: Alignment.center,
      child: image != null
          ? null
          : Text(
              _initials(),
              style: TextStyle(
                color: c,
                fontWeight: FontWeight.w800,
                fontSize: size * 0.34,
              ),
            ),
    );
  }
}
