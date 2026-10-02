import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/loan_funding.dart';

/// Fills `{name}` placeholders in a loan_funding.* string with server figures.
/// Formatting only — every amount comes from [LoanFunding] (FUND-1).
String fundingText(T t, String key, LoanFunding f, NumberFormat fmt, {String? agentName}) {
  final vars = <String, String>{
    'agent': agentName ?? '—',
    'required': fmt.format(f.required),
    'available': fmt.format(f.available),
    'shortfall': fmt.format(f.shortfall),
    'committed': fmt.format(f.committed),
    'queueShortfall': fmt.format(f.queueShortfall),
    'pool': fmt.format(f.branchPool ?? 0),
    'capital': fmt.format(f.capitalNeeded),
    'amount': fmt.format(f.shortfall),
  };
  return t.x(key).replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => vars[m[1]] ?? m[0]!);
}

/// FUND-2/FUND-4 popup — same content as the web FundingPopup. [canAct]
/// (admin/superadmin) adds the button that opens the wallet with the
/// server's shortfall filled in: release to the agent, or add capital.
Future<void> showFundingDialog(
  BuildContext context,
  WidgetRef ref,
  LoanFunding f, {
  required bool canAct,
  bool submitted = false,
  String? agentName,
}) {
  final t = T.of(ref);
  final fmt = ref.read(currencyFmtProvider);
  final body = !f.isAgent
      ? 'loan_funding.capital_popup_body'
      : agentName != null
          ? 'loan_funding.approve_blocked'
          : 'loan_funding.float_popup_body';
  final rows = <(String, double, bool)>[
    (t.x('loan_funding.label_required'), f.required, false),
    (t.x(f.isAgent ? 'loan_funding.label_float' : 'loan_funding.label_pool'), f.available, false),
    if (f.isAgent && f.committed > 0) (t.x('loan_funding.label_committed'), f.committed, false),
    (t.x('loan_funding.label_short'), f.shortfall, true),
  ];
  return showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTokens.radius)),
      title: Text(t.x(f.isAgent ? 'loan_funding.float_popup_title' : 'loan_funding.capital_popup_title')),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (submitted) ...[
              Row(children: [
                const Icon(Icons.task_alt, color: AppColors.success, size: 18),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(t.x('loan_funding.sent_for_approval'),
                      style: AppTypography.body.copyWith(color: AppColors.success, fontWeight: FontWeight.w600),),
                ),
              ],),
              const SizedBox(height: 10),
            ],
            Text(fundingText(t, body, f, fmt, agentName: agentName), style: AppTypography.body),
            const SizedBox(height: 12),
            for (final (label, value, strong) in rows)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Expanded(child: Text(label, style: AppTypography.caption)),
                    Text(
                      fmt.format(value),
                      style: AppTypography.caption.copyWith(
                        fontWeight: strong ? FontWeight.w800 : FontWeight.w600,
                        color: strong ? AppColors.danger : AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            if (f.isAgent && f.committed > 0) ...[
              const SizedBox(height: 8),
              Text(fundingText(t, 'loan_funding.queue_note', f, fmt), style: AppTypography.tiny),
            ],
            if (f.isAgent && canAct && f.capitalNeeded > 0) ...[
              const SizedBox(height: 8),
              Text(fundingText(t, 'loan_funding.capital_first', f, fmt),
                  style: AppTypography.tiny.copyWith(color: AppColors.warning, fontWeight: FontWeight.w600),),
            ],
            if (submitted && f.alertsSent) ...[
              const SizedBox(height: 8),
              Text(t.x('loan_funding.admins_notified'), style: AppTypography.tiny),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: Text(t.x('loan_funding.close'))),
        if (canAct)
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.onPrimary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTokens.radiusSm)),
            ),
            icon: Icon(f.isAgent ? Icons.add_card : Icons.account_balance, size: 16),
            label: Text(f.isAgent
                ? fundingText(t, 'loan_funding.release_amount', f, fmt)
                : t.x('loan_funding.add_capital'),),
            onPressed: () {
              Navigator.pop(ctx);
              context.push(f.walletRoute());
            },
          ),
      ],
    ),
  );
}
