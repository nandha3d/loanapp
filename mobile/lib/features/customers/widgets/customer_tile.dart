import 'package:flutter/material.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/customer.dart';
import 'package:loantrack/shared/widgets/app_badge.dart';

class CustomerTile extends StatelessWidget {
  const CustomerTile({super.key, required this.customer, required this.onTap});

  final Customer customer;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
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
              _Avatar(initials: customer.initials),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      customer.name,
                      style: AppTypography.bodyLarge,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      customer.customerCode,
                      style: AppTypography.caption.copyWith(
                        fontFamily: 'monospace',
                        color: AppColors.textLight,
                      ),
                    ),
                    if (customer.routeName != null) ...[
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          customer.routeName!,
                          style: AppTypography.tiny.copyWith(
                            color: AppColors.primaryDark,
                          ),
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
                  AppBadge(
                      label: customer.status, kind: _kindFor(customer.status)),
                  const SizedBox(height: 8),
                  const Icon(
                    Icons.chevron_right,
                    size: 18,
                    color: AppColors.border,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
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
      width: 48,
      height: 48,
      decoration: const BoxDecoration(
        color: AppColors.primary,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        initials.isEmpty ? '?' : initials,
        style: AppTypography.bodyLarge.copyWith(
          color: Colors.white,
          fontSize: 14 * 1.1,
        ),
      ),
    );
  }
}
