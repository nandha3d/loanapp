import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/dashboard_summary.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

/// Bottom sheet to verify pending UPI payments (single or bulk).
class VerifyUpiSheet extends ConsumerStatefulWidget {
  const VerifyUpiSheet({super.key, required this.pending, required this.fmt});
  final List<TodayActivity> pending;
  final NumberFormat fmt;

  @override
  ConsumerState<VerifyUpiSheet> createState() => _VerifyUpiSheetState();
}

class _VerifyUpiSheetState extends ConsumerState<VerifyUpiSheet> {
  final _selected = <String>{};
  bool _loading = false;
  String? _error;

  Future<void> _verify(List<String> ids) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioProvider);
      await dio.post<Map<String, dynamic>>(
        Endpoints.dashboardVerifyUpi,
        data: ids.length == 1
            ? {'action': 'upi', 'entryId': ids.single}
            : {'action': 'bulk-upi', 'entryIds': ids},
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() => _error = e.toString());
    }
    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
          16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Verify UPI Payments', style: AppTypography.sectionTitle),
              if (_selected.isNotEmpty)
                TextButton(
                  onPressed: _loading
                      ? null
                      : () => _verify(_selected.toList()),
                  child: Text('Verify ${_selected.length}'),
                ),
            ],
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_error!,
                  style: AppTypography.caption.copyWith(color: AppColors.danger)),
            ),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.5),
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: widget.pending.length,
              itemBuilder: (_, i) {
                final p = widget.pending[i];
                final isSel = _selected.contains(p.id);
                return CheckboxListTile(
                  dense: true,
                  value: isSel,
                  activeColor: AppColors.primary,
                  onChanged: (v) {
                    setState(() {
                      if (v == true) {
                        _selected.add(p.id);
                      } else {
                        _selected.remove(p.id);
                      }
                    });
                  },
                  title: Text('${p.customerName} — ${widget.fmt.format(p.amount)}',
                      style: AppTypography.body),
                  subtitle: Text('${p.loanCode} · ${p.paymentMode}',
                      style: AppTypography.caption),
                  secondary: TextButton(
                    onPressed: _loading
                        ? null
                        : () => _verify([p.id]),
                    style: TextButton.styleFrom(
                        foregroundColor: AppColors.success,
                        padding: const EdgeInsets.symmetric(horizontal: 8)),
                    child: const Text('Verify'),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
