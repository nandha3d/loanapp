import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

/// Bottom sheet to record a cash collection from an agent / route.
class CollectCashSheet extends ConsumerStatefulWidget {
  const CollectCashSheet({
    super.key,
    required this.routeId,
    required this.routeName,
    required this.agentId,
    required this.fmt,
  });
  final String routeId;
  final String routeName;
  final String agentId;
  final NumberFormat fmt;

  @override
  ConsumerState<CollectCashSheet> createState() => _CollectCashSheetState();
}

class _CollectCashSheetState extends ConsumerState<CollectCashSheet> {
  double _amount = 0;
  String _note = '';
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    if (_amount <= 0) {
      setState(() => _error = 'Amount must be > 0');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioProvider);
      await dio.post<Map<String, dynamic>>(
        Endpoints.dashboardCollectCash,
        data: {
          'action': 'collect-cash',
          'routeId': widget.routeId,
          'agentId': widget.agentId,
          'amount': _amount,
          if (_note.isNotEmpty) 'note': _note,
        },
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
          Text('Collect Cash — ${widget.routeName}',
              style: AppTypography.sectionTitle),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_error!,
                  style: AppTypography.caption.copyWith(color: AppColors.danger)),
            ),
          const SizedBox(height: 16),
          TextFormField(
            decoration: const InputDecoration(labelText: 'Amount'),
            keyboardType: TextInputType.number,
            onChanged: (v) => _amount = double.tryParse(v) ?? 0,
          ),
          const SizedBox(height: 12),
          TextFormField(
            decoration:
                const InputDecoration(labelText: 'Note (optional)'),
            onChanged: (v) => _note = v,
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _loading ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
              ),
              child: Text(_loading ? 'Submitting…' : 'Collect Cash'),
            ),
          ),
        ],
      ),
    );
  }
}
