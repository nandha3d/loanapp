import 'package:flutter/material.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class BankReconciliationScreen extends StatefulWidget {
  const BankReconciliationScreen({super.key});

  @override
  State<BankReconciliationScreen> createState() => _BankReconciliationScreenState();
}

class _BranchItem {
  _BranchItem({
    required this.id,
    required this.description,
    required this.date,
    required this.amount,
    required this.cleared,
  });

  final String id;
  final String description;
  final String date;
  final double amount;
  bool cleared;
}

class _BankReconciliationScreenState extends State<BankReconciliationScreen> {
  final List<_BranchItem> _bankLines = [
    _BranchItem(id: '1', description: 'UPI Pay Received - Karthik S', date: 'June 02, 2026', amount: 1500.0, cleared: false),
    _BranchItem(id: '2', description: 'Loan Disbursement #LN0394', date: 'June 01, 2026', amount: -25000.0, cleared: false),
    _BranchItem(id: '3', description: 'Bank Interest Credit', date: 'May 31, 2026', amount: 142.50, cleared: true),
  ];

  double get _clearedBalance => _bankLines
      .where((item) => item.cleared)
      .fold(0.0, (sum, item) => sum + item.amount);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Bank Reconciliation'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Top Metrics Card
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                boxShadow: AppTokens.shadow,
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Cleared Balance', style: AppTypography.caption),
                      const SizedBox(height: 4),
                      Text('₹${_clearedBalance.toStringAsFixed(2)}', style: AppTypography.sectionTitle.copyWith(color: AppColors.primary)),
                    ],
                  ),
                  AppButton(
                    size: AppButtonSize.small,
                    label: 'Reconcile All',
                    onPressed: () {
                      setState(() {
                        for (final line in _bankLines) {
                          line.cleared = true;
                        }
                      });
                    },
                  ),
                ],
              ),
            ),

            // Bank Statement Lines
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _bankLines.length,
                itemBuilder: (context, idx) {
                  final line = _bankLines[idx];
                  final isDebit = line.amount < 0;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        Checkbox(
                          value: line.cleared,
                          activeColor: AppColors.success,
                          onChanged: (val) {
                            setState(() {
                              line.cleared = val ?? false;
                            });
                          },
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(line.description, style: AppTypography.bodyLarge.copyWith(fontSize: 14)),
                              const SizedBox(height: 4),
                              Text(line.date, style: AppTypography.caption),
                            ],
                          ),
                        ),
                        Text(
                          '${isDebit ? '-' : '+'}₹${line.amount.abs().toStringAsFixed(2)}',
                          style: AppTypography.bodyLarge.copyWith(
                            color: isDebit ? AppColors.danger : AppColors.success,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
