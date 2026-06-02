import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/customer.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/shared/widgets/app_badge.dart';

class CustomerTile extends ConsumerWidget {
  const CustomerTile({super.key, required this.customer, required this.onTap});

  final Customer customer;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final cs = customer.creditScore;
    final activeLoans = customer.loans.where((l) => l.status == 'active').toList();
    final outstanding = activeLoans.fold<double>(0, (s, l) => s + l.principal);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(8),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Avatar(initials: customer.initials),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            customer.name,
                            style: AppTypography.bodyLarge.copyWith(fontWeight: FontWeight.w700),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Text(
                                customer.customerCode,
                                style: AppTypography.caption.copyWith(
                                  fontFamily: 'monospace',
                                  color: AppColors.textLight,
                                ),
                              ),
                              if (customer.routeName != null) ...[
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: AppColors.primaryLight,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    customer.routeName!,
                                    style: AppTypography.tiny.copyWith(color: AppColors.primaryDark),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                    AppBadge(
                      label: customer.status,
                      kind: _kindFor(customer.status),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _InfoSnippet(
                      icon: Icons.speed_rounded,
                      label: t.x('cust.risk_score'),
                      value: (cs != null && cs.rated) ? '${cs.score}' : '—',
                      valueColor: _scoreColor(cs?.score ?? 0),
                    ),
                    _InfoSnippet(
                      icon: Icons.account_balance_wallet_outlined,
                      label: t.x('loan.outstanding'),
                      value: '₹${outstanding.toInt()}',
                      valueColor: outstanding > 0 ? AppColors.textPrimary : AppColors.textLight,
                    ),
                    _InfoSnippet(
                      icon: Icons.receipt_long_outlined,
                      label: t.x('cust.loans_tab'),
                      value: '${customer.loans.length}',
                      valueColor: AppColors.textPrimary,
                    ),
                  ],
                )
              ],
            ),
          ),
        ),
      ),
    );
  }

  Color _scoreColor(int score) {
    if (score == 0) return AppColors.textLight;
    if (score < 500) return AppColors.danger;
    if (score < 650) return AppColors.warning;
    if (score < 750) return const Color(0xFFEAB308);
    return AppColors.success;
  }

  BadgeKind _kindFor(String status) {
    switch (status) {
      case 'active':
        return BadgeKind.active;
      case 'pending_review':
      case 'pending':
        return BadgeKind.pending;
      case 'suspended':
      case 'blacklisted':
        return BadgeKind.overdue;
      default:
        return BadgeKind.info;
    }
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.initials});
  final String initials;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 52,
      height: 52,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withAlpha(60),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        initials.isEmpty ? '?' : initials,
        style: AppTypography.bodyLarge.copyWith(
          color: Colors.white,
          fontSize: 18,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

class _InfoSnippet extends StatelessWidget {
  const _InfoSnippet({
    required this.icon,
    required this.label,
    required this.value,
    required this.valueColor,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: AppColors.textLight),
        const SizedBox(width: 6),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: AppTypography.tiny.copyWith(color: AppColors.textLight)),
            Text(value, style: AppTypography.caption.copyWith(color: valueColor, fontWeight: FontWeight.w600)),
          ],
        ),
      ],
    );
  }
}
