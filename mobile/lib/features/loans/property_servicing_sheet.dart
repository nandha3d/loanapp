import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/services/property_service.dart';
import 'package:zolofund/data/models/loan.dart';

class PropertyServicingSheet extends ConsumerStatefulWidget {
  const PropertyServicingSheet({super.key, required this.loan});
  final Loan loan;

  @override
  ConsumerState<PropertyServicingSheet> createState() => _PropertyServicingSheetState();
}

class _PropertyServicingSheetState extends ConsumerState<PropertyServicingSheet> {
  bool _busy = false;
  String? _status;

  @override
  void initState() {
    super.initState();
    // In a real app, you can load property status if there is a get method.
    // For now, we assume the status from the passed loan object's propertyCollateral
    _status = (widget.loan.propertyCollateral?['mortgageStatus'] ?? 'mortgaged') as String?;
  }

  Future<void> _release() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Release Mortgage?'),
        content: const Text('Are you sure you want to release the mortgage registry for this property? This action is audited.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Release'),
          ),
        ],
      ),
    );
    if (ok != true) return;

    setState(() => _busy = true);
    try {
      await ref.read(propertyServiceProvider).releaseProperty(widget.loan.id);
      setState(() {
        _status = 'released';
        _busy = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Mortgage released successfully')),
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
    final pc = widget.loan.propertyCollateral;
    final isReleased = _status == 'released';

    return DraggableScrollableSheet(
      initialChildSize: 0.5,
      minChildSize: 0.3,
      maxChildSize: 0.85,
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
                  Text('Property Mortgage · ${widget.loan.loanCode}', style: AppTypography.nameLg),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: isReleased
                          ? AppColors.success.withAlpha(28)
                          : AppColors.danger.withAlpha(28),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      isReleased ? 'Released' : 'Mortgaged',
                      style: AppTypography.caption.copyWith(
                        color: isReleased ? AppColors.success : AppColors.danger,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const Divider(height: 32),
              if (pc != null) ...[
                _tile('Property Type', (pc['propertyType'] ?? 'residential').toString().toUpperCase()),
                _tile('Address', (pc['address'] ?? '—').toString()),
                _tile('Market Value', '₹ ${pc['marketValue'] ?? '—'}'),
                if (pc['surveyNo'] != null) _tile('Survey No', pc['surveyNo'].toString()),
              ] else
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  child: Text('No property collateral information recorded.', style: AppTypography.body),
                ),
              const SizedBox(height: 24),
              if (!isReleased)
                FilledButton.icon(
                  onPressed: _busy ? null : _release,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.success,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  icon: _busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Icon(Icons.verified_user_outlined),
                  label: const Text('Release Mortgage / Deed'),
                )
              else
                OutlinedButton.icon(
                  onPressed: null,
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  icon: const Icon(Icons.check, color: AppColors.success),
                  label: const Text('Mortgage Released'),
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
