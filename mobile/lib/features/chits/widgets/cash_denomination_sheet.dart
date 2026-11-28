import 'package:flutter/material.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';

const List<int> inrDenominations = [500, 200, 100, 50, 20, 10, 5, 2, 1];

int computeDenominationTotal(Map<int, int> counts) {
  var total = 0;
  for (final denom in inrDenominations) {
    final qty = counts[denom] ?? 0;
    if (qty > 0) total += denom * qty;
  }
  return total;
}

Map<int, int> greedyFillInrDenominations(double targetAmount) {
  var remaining = targetAmount.round();
  if (remaining < 0) remaining = 0;
  final out = <int, int>{};
  for (final denom in inrDenominations) {
    if (remaining <= 0) break;
    final c = remaining ~/ denom;
    if (c > 0) {
      out[denom] = c;
      remaining -= c * denom;
    }
  }
  return out;
}

Map<String, dynamic>? serializeDenominationBreakdown(Map<int, int> counts) {
  final clean = <String, int>{};
  var total = 0;
  for (final denom in inrDenominations) {
    final qty = counts[denom] ?? 0;
    if (qty > 0) {
      clean['$denom'] = qty;
      total += denom * qty;
    }
  }
  if (clean.isEmpty) return null;
  return {
    'currency': 'INR',
    'counts': clean,
    'computedTotal': total,
  };
}

class CashDenominationCounter extends StatelessWidget {
  const CashDenominationCounter({
    super.key,
    required this.expectedAmount,
    required this.mode,
    required this.counts,
    required this.onChanged,
  });

  final double expectedAmount;
  final String mode; // DISABLED | OPTIONAL | REQUIRED
  final Map<int, int> counts;
  final ValueChanged<Map<int, int>> onChanged;

  @override
  Widget build(BuildContext context) {
    if (mode.toUpperCase() == 'DISABLED') {
      return const SizedBox.shrink();
    }
    final total = computeDenominationTotal(counts);
    final diff = total - expectedAmount.round();
    final isMatch = diff == 0;
    final isRequired = mode.toUpperCase() == 'REQUIRED';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: (!isMatch && isRequired) ? AppColors.danger : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('💵 ', style: TextStyle(fontSize: 15)),
              Expanded(
                child: Text(
                  'Cash Note Counter (${isRequired ? 'Required' : 'Optional'})',
                  style: AppTypography.body.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              TextButton(
                onPressed: expectedAmount <= 0
                    ? null
                    : () => onChanged(greedyFillInrDenominations(expectedAmount)),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  minimumSize: const Size(0, 32),
                ),
                child: const Text('Auto-fill'),
              ),
              TextButton(
                onPressed: total == 0 ? null : () => onChanged(const {}),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  minimumSize: const Size(0, 32),
                ),
                child: const Text('Clear'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: inrDenominations.map((denom) {
              final qty = counts[denom] ?? 0;
              return Container(
                width: 148,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: qty > 0 ? AppColors.primary : AppColors.border,
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '₹$denom',
                      style: AppTypography.caption.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        InkWell(
                          onTap: qty <= 0
                              ? null
                              : () {
                                  final next = Map<int, int>.from(counts);
                                  if (qty - 1 <= 0) {
                                    next.remove(denom);
                                  } else {
                                    next[denom] = qty - 1;
                                  }
                                  onChanged(next);
                                },
                          child: const Padding(
                            padding: EdgeInsets.all(4),
                            child: Icon(Icons.remove_circle_outline, size: 18),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 6),
                          child: Text(
                            '$qty',
                            style: AppTypography.body
                                .copyWith(fontWeight: FontWeight.w700),
                          ),
                        ),
                        InkWell(
                          onTap: () {
                            final next = Map<int, int>.from(counts);
                            next[denom] = qty + 1;
                            onChanged(next);
                          },
                          child: const Padding(
                            padding: EdgeInsets.all(4),
                            child: Icon(Icons.add_circle_outline, size: 18),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Counted: ₹$total / Expected: ₹${expectedAmount.round()}',
                style: AppTypography.caption,
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: isMatch
                      ? AppColors.successBg
                      : AppColors.dangerBg,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  isMatch
                      ? '✓ Match'
                      : (diff > 0 ? '+₹$diff excess' : '₹${diff.abs()} short'),
                  style: AppTypography.caption.copyWith(
                    fontWeight: FontWeight.w700,
                    color: isMatch ? AppColors.success : AppColors.danger,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
