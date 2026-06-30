import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/services/product_service.dart';
import 'package:loantrack/data/models/loan.dart';

class ProductServicingSheet extends ConsumerStatefulWidget {
  const ProductServicingSheet({super.key, required this.loan});
  final Loan loan;

  @override
  ConsumerState<ProductServicingSheet> createState() => _ProductServicingSheetState();
}

class _ProductServicingSheetState extends ConsumerState<ProductServicingSheet> {
  bool _busy = false;
  String? _status;
  final _reasonCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _status = (widget.loan.productFinanceItem?['repossessionStatus'] ?? 'active') as String?;
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _toggleRepossession() async {
    final bool isCurrentlyRepossessed = _status == 'repossessed';
    final targetStatus = isCurrentlyRepossessed ? 'active' : 'repossessed';

    if (!isCurrentlyRepossessed) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          title: const Text('Flag for Repossession?'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('This will flag the product collateral as Repossessed. Please state the reason:'),
              const SizedBox(height: 12),
              TextField(
                controller: _reasonCtrl,
                decoration: const InputDecoration(
                  labelText: 'Reason',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Repossess'),
            ),
          ],
        ),
      );
      if (ok != true) return;
    } else {
      final ok = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          title: const Text('Revert Repossession?'),
          content: const Text('Revert status of the product collateral back to Active?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Revert'),
            ),
          ],
        ),
      );
      if (ok != true) return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(productServiceProvider).updateRepossession(
            widget.loan.id,
            status: targetStatus,
            reason: _reasonCtrl.text.trim(),
          );
      setState(() {
        _status = targetStatus;
        _busy = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Status updated to: $targetStatus')),
        );
      }
    } catch (e) {
      setState(() => _busy = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final pi = widget.loan.productFinanceItem;
    final isRepossessed = _status == 'repossessed';

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.3,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, scroll) => Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          top: false,
          child: ListView(
            controller: scroll,
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Text('Product Financing · ${widget.loan.loanCode}', style: AppTypography.nameLg),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: isRepossessed
                          ? AppColors.danger.withAlpha(28)
                          : AppColors.success.withAlpha(28),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      isRepossessed ? 'Repossessed' : 'Active',
                      style: AppTypography.caption.copyWith(
                        color: isRepossessed ? AppColors.danger : AppColors.success,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const Divider(height: 32),
              if (pi != null) ...[
                _tile('Product Name', (pi['productName'] ?? '—').toString()),
                _tile('Category', (pi['category'] ?? '—').toString()),
                _tile('Brand', (pi['brand'] ?? '—').toString()),
                _tile('Model No', (pi['modelNo'] ?? '—').toString()),
                _tile('Serial / IMEI', (pi['serialNo'] ?? '—').toString()),
                _tile('Dealer', (pi['dealerName'] ?? '—').toString()),
                _tile('Invoice No', (pi['invoiceNo'] ?? '—').toString()),
                _tile('Invoice Amount', '₹ ${pi['invoiceAmount'] ?? '—'}'),
                _tile('Down Payment', '₹ ${pi['downPayment'] ?? '—'}'),
              ] else
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  child: Text('No product collateral information recorded.', style: AppTypography.body),
                ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: _busy ? null : _toggleRepossession,
                style: FilledButton.styleFrom(
                  backgroundColor: isRepossessed ? AppColors.success : AppColors.danger,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                icon: _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : Icon(isRepossessed ? Icons.replay_outlined : Icons.warning_amber_rounded),
                label: Text(isRepossessed ? 'Revert Repossession (Active)' : 'Flag for Repossession'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tile(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: AppTypography.caption.copyWith(fontWeight: FontWeight.bold)),
          ),
          Expanded(
            child: Text(value, style: AppTypography.body),
          ),
        ],
      ),
    );
  }
}
