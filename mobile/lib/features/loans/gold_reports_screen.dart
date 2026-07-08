import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/services/gold_service.dart';

/// Gold pledge reports (summary KPIs + pending interests) — mobile read-only,
/// no accounting. Money is computed server-side via lib/gold.
class GoldReportsScreen extends ConsumerStatefulWidget {
  const GoldReportsScreen({super.key});

  @override
  ConsumerState<GoldReportsScreen> createState() => _GoldReportsScreenState();
}

class _GoldReportsScreenState extends ConsumerState<GoldReportsScreen> {
  Map<String, dynamic>? _summary;
  Map<String, dynamic>? _pending;
  bool _loading = true;
  String? _error;
  final _fmt =
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final svc = ref.read(goldServiceProvider);
      final s = await svc.reports('summary');
      final p = await svc.reports('pending');
      if (mounted) {
        setState(() {
          _summary = s;
          _pending = p;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    return Scaffold(
      appBar: AppBar(title: Text(t.x('gold.pledge_report')), centerTitle: true),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: AppTypography.body))
              : RefreshIndicator(onRefresh: _load, child: _body()),
    );
  }

  Widget _body() {
    final t = T.of(ref);
    final s = _summary ?? {};
    final rows = (_pending?['rows'] as List<dynamic>? ?? []);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            _kpi('Active pledges', '${s['activePledges'] ?? 0}'),
            _kpi('Total loan', _fmt.format(s['totalLoanAmount'] ?? 0)),
            _kpi('Pending interest',
                _fmt.format(s['totalPendingInterest'] ?? 0)),
            _kpi(
              'Active net wt',
              '${((s['activeOrnamentWeight'] as Map?)?['net'] ?? 0)} g',
            ),
          ],
        ),
        const SizedBox(height: 18),
        Text(
          'Pending Interests (${rows.length})',
          style: AppTypography.label.copyWith(color: AppColors.textSecondary),
        ),
        const SizedBox(height: 8),
        if (rows.isEmpty)
          Padding(
            padding: EdgeInsets.all(20),
            child: Center(child: Text(t.x('gold.no_active_pledges'))),
          )
        else
          ...rows.map((r) {
            final m = (r as Map).cast<String, dynamic>();
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${m['loanCode']} · ${m['customer'] ?? ''}',
                          style: AppTypography.bodyLarge
                              .copyWith(fontWeight: FontWeight.w700),
                        ),
                        Text(
                          'Outstanding ${_fmt.format(m['outstandingPrincipal'] ?? 0)} · ${m['monthsDue']} mo',
                          style: AppTypography.caption
                              .copyWith(color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    _fmt.format(m['interestDue'] ?? 0),
                    style: AppTypography.bodyLarge.copyWith(
                      fontWeight: FontWeight.w800,
                      color: AppColors.primaryDark,
                    ),
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }

  Widget _kpi(String label, String value) => Container(
        width: 160,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: AppTypography.caption
                  .copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style:
                  AppTypography.bodyLarge.copyWith(fontWeight: FontWeight.w800),
            ),
          ],
        ),
      );
}
