import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';

/// Shared step-by-step dividend calculation display — the mobile counterpart
/// of components/chits/DividendBreakdown.tsx (doc 22a). Used by the winner
/// summary sheet (doc 15) and the borrower chit detail screen (doc 22b).
class DividendBreakdown extends StatelessWidget {
  const DividendBreakdown({
    super.key,
    required this.chitValue,
    required this.prizeAmount,
    required this.bidDiscount,
    required this.commissionPct,
    required this.commissionBasis,
    required this.commission,
    this.gstPct,
    required this.gstAmount,
    required this.distributableDividend,
    required this.dividendEligibleMembers,
    required this.dividend,
    required this.roundingIncome,
    required this.dividendPolicy,
    required this.dividendDistribution,
    required this.fmt,
    this.engineType,
    this.reserveFloorAmount,
    this.forfeitedDividendTotal = 0,
    this.foremanCompensationMode,
  });

  final double chitValue;
  final double prizeAmount;
  final double bidDiscount;
  final double commissionPct;
  final String commissionBasis; // BID_DISCOUNT | CHIT_VALUE
  final double commission;
  final double? gstPct;
  final double gstAmount;
  final double distributableDividend;
  final int dividendEligibleMembers;
  final double dividend;
  final double roundingIncome;
  final String dividendPolicy; // ALL_MEMBERS | NON_WINNERS_ONLY | NON_PRIZED_ONLY | NONE
  final String dividendDistribution; // ADJUST_NEXT_DUE | CASH_PAYOUT | ACCUMULATE | DEFERRED_BONUS_POOL | NONE
  final NumberFormat fmt;
  final String? engineType;
  final double? reserveFloorAmount;
  final double forfeitedDividendTotal;
  final String? foremanCompensationMode;

  String get _distributionCopy {
    if (dividendDistribution == 'CASH_PAYOUT') return 'Dividend paid in cash';
    if (dividendDistribution == 'ACCUMULATE') {
      return 'Dividend accrued, no cash movement this period';
    }
    if (dividendDistribution == 'DEFERRED_BONUS_POOL') {
      return 'Dividend pooled as completion bonus for non-defaulting members';
    }
    if (dividendDistribution == 'NONE') {
      return 'No dividend distributed under this chit type';
    }
    return "Dividend credited to next period's due";
  }

  String get _policyCopy {
    if (dividendPolicy == 'NON_WINNERS_ONLY') return '(winner excluded)';
    if (dividendPolicy == 'NON_PRIZED_ONLY') return '(non-prized only)';
    if (dividendPolicy == 'NONE') return '(no dividend)';
    return '(all members)';
  }

  @override
  Widget build(BuildContext context) {
    final commissionBaseLabel =
        commissionBasis == 'CHIT_VALUE' ? 'chit value' : 'bid discount';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (engineType != null && engineType!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(
              foremanCompensationMode != null && foremanCompensationMode!.isNotEmpty
                  ? 'Engine: $engineType · Foreman fee: $foremanCompensationMode'
                  : 'Engine: $engineType',
              style: AppTypography.tiny.copyWith(color: AppColors.textSecondary),
            ),
          ),
        _row('Chit value', fmt.format(chitValue)),
        _row('− Prize amount', fmt.format(prizeAmount)),
        if (reserveFloorAmount != null && reserveFloorAmount! > 0)
          _row('Reserve floor', fmt.format(reserveFloorAmount!), small: true),
        _totalRow('= Bid discount', fmt.format(bidDiscount)),
        _row('− Commission ($commissionPct% of $commissionBaseLabel)',
            fmt.format(commission),),
        if (gstPct != null && gstPct! > 0)
          _row('+ GST ($gstPct% of commission)', fmt.format(gstAmount)),
        _totalRow('= Distributable dividend', fmt.format(distributableDividend)),
        _row(
          '÷ $dividendEligibleMembers eligible ticket${dividendEligibleMembers == 1 ? '' : 's'}',
          _policyCopy,
        ),
        _totalRow('= Dividend per ticket', fmt.format(dividend),
            color: AppColors.success,),
        if (forfeitedDividendTotal > 0)
          _row('Forfeited late-payer dividend retained',
              fmt.format(forfeitedDividendTotal),
              small: true,),
        if (roundingIncome > 0)
          _row('Rounding income (booked as foreman income)',
              fmt.format(roundingIncome),
              small: true,),
        const SizedBox(height: 10),
        Text('$_distributionCopy.',
            style: AppTypography.caption
                .copyWith(color: AppColors.textSecondary),),
      ],
    );
  }

  Widget _row(String label, String value, {bool small = false}) {
    final style = small
        ? AppTypography.tiny.copyWith(color: AppColors.textSecondary)
        : AppTypography.body;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
              child: Text(label,
                  style: small
                      ? style
                      : style.copyWith(color: AppColors.textSecondary),),),
          Text(value, style: style.copyWith(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _totalRow(String label, String value, {Color? color}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      margin: const EdgeInsets.only(top: 2),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: AppTypography.body.copyWith(
                  fontWeight: FontWeight.w800, color: color,),),
          Text(value,
              style: AppTypography.body.copyWith(
                  fontWeight: FontWeight.w800, color: color,),),
        ],
      ),
    );
  }
}
