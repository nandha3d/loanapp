import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/collection_run.dart';
import 'package:loantrack/data/services/collection_run_service.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

final _sheetProvider =
    FutureProvider.autoDispose.family<RunSheet, String>((ref, runId) {
  return ref.watch(collectionRunServiceProvider).fetchSheet(runId);
});

/// mCollect-A — batch collection sheet for a route run.
class RunSheetScreen extends ConsumerStatefulWidget {
  const RunSheetScreen({super.key, required this.runId});
  final String runId;

  @override
  ConsumerState<RunSheetScreen> createState() => _RunSheetScreenState();
}

class _RunSheetScreenState extends ConsumerState<RunSheetScreen> {
  final Map<String, TextEditingController> _amounts = {};
  final Map<String, String> _modes = {};
  bool _busy = false;

  @override
  void dispose() {
    for (final c in _amounts.values) {
      c.dispose();
    }
    super.dispose();
  }

  TextEditingController _ctrl(String id) =>
      _amounts.putIfAbsent(id, () => TextEditingController());

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: error ? AppColors.danger : AppColors.success,
      ),
    );
  }

  Future<void> _collect(List<RunSheetRow> rows) async {
    final lines = <Map<String, dynamic>>[];
    for (final r in rows) {
      final amt = double.tryParse(_ctrl(r.instalmentId).text.trim()) ?? 0;
      if (amt > 0) {
        lines.add({
          'instalmentId': r.instalmentId,
          'receivedAmount': amt,
          'paymentMode': _modes[r.instalmentId] ?? 'cash',
        });
      }
    }
    if (lines.isEmpty) {
      _snack('Enter at least one amount', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      final res = await ref
          .read(collectionRunServiceProvider)
          .collect(widget.runId, lines);
      _snack(
          'Posted ${res.posted}${res.skipped > 0 ? ', ${res.skipped} skipped' : ''}',);
      for (final l in lines) {
        _ctrl(l['instalmentId'] as String).clear();
      }
      ref.invalidate(_sheetProvider(widget.runId));
    } catch (e) {
      _snack(e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _close() async {
    setState(() => _busy = true);
    try {
      await ref.read(collectionRunServiceProvider).close(widget.runId);
      ref.invalidate(_sheetProvider(widget.runId));
      _snack('Run closed — deposit cash on Cash Float');
    } catch (e) {
      _snack(e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sendPayLink(RunSheetRow r) async {
    try {
      final url = await ref
          .read(collectionRunServiceProvider)
          .selfPayLink(r.instalmentId);
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        builder: (ctx) => _PayLinkSheet(name: r.name, url: url),
      );
    } catch (e) {
      _snack(e.toString(), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sheetAsync = ref.watch(_sheetProvider(widget.runId));
    final fmt = ref.watch(currencyFmtProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Run Sheet'), centerTitle: true),
      body: sheetAsync.when(
        loading: () => const Padding(
            padding: EdgeInsets.all(16), child: Skeleton(height: 320),),
        error: (e, _) => Center(
          child: Text(e.toString(),
              style: AppTypography.body.copyWith(color: AppColors.danger),),
        ),
        data: (sheet) {
          final run = sheet.run;
          return Column(
            children: [
              _Header(run: run, fmt: fmt),
              Expanded(
                child: run.isLocked
                    ? _DepositHint(run: run, fmt: fmt)
                    : sheet.rows.isEmpty
                        ? const EmptyState(
                            icon: Icons.check_circle_outline_rounded,
                            title: 'Nothing due on this route',)
                        : ListView.builder(
                            padding: const EdgeInsets.all(12),
                            itemCount: sheet.rows.length,
                            itemBuilder: (_, i) => _RowTile(
                              row: sheet.rows[i],
                              fmt: fmt,
                              amountCtrl: _ctrl(sheet.rows[i].instalmentId),
                              mode:
                                  _modes[sheet.rows[i].instalmentId] ?? 'cash',
                              onMode: (m) => setState(
                                  () => _modes[sheet.rows[i].instalmentId] = m,),
                              onFill: () => setState(() =>
                                  _ctrl(sheet.rows[i].instalmentId).text = sheet
                                      .rows[i].outstanding
                                      .toStringAsFixed(0),),
                              onPayLink: () => _sendPayLink(sheet.rows[i]),
                            ),
                          ),
              ),
              if (!run.isLocked && sheet.rows.isNotEmpty)
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Expanded(
                          child: FilledButton.icon(
                            onPressed:
                                _busy ? null : () => _collect(sheet.rows),
                            icon: const Icon(Icons.check_rounded),
                            label: Text(_busy ? 'Posting…' : 'Collect'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        OutlinedButton(
                          onPressed: _busy ? null : _close,
                          child: const Text('Close run'),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.run, required this.fmt});
  final CollectionRun run;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    Widget stat(String label, String value, [Color? c]) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: AppTypography.caption),
            Text(value,
                style: AppTypography.bodyLarge.copyWith(
                    fontWeight: FontWeight.w800,
                    color: c ?? AppColors.textPrimary,),),
          ],
        );
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      color: AppColors.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Run · ${run.date}', style: AppTypography.sectionTitle),
              Chip(
                label: Text(run.status, style: AppTypography.caption),
                backgroundColor: AppColors.primaryLight,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 22,
            runSpacing: 10,
            children: [
              stat('Expected', fmt.format(run.expectedTotal)),
              stat('Collected', fmt.format(run.collectedTotal),
                  AppColors.success,),
              stat('Cash', fmt.format(run.cashCollected)),
              stat('Digital', fmt.format(run.digitalCollected)),
              stat('Stops', '${run.stopsCollected}/${run.stopsExpected}'),
            ],
          ),
        ],
      ),
    );
  }
}

class _RowTile extends StatelessWidget {
  const _RowTile({
    required this.row,
    required this.fmt,
    required this.amountCtrl,
    required this.mode,
    required this.onMode,
    required this.onFill,
    required this.onPayLink,
  });
  final RunSheetRow row;
  final NumberFormat fmt;
  final TextEditingController amountCtrl;
  final String mode;
  final ValueChanged<String> onMode;
  final VoidCallback onFill;
  final VoidCallback onPayLink;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(row.name, style: AppTypography.bodyLarge),
                    Text('${row.loanCode} · #${row.instalmentNo}',
                        style: AppTypography.caption,),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(fmt.format(row.outstanding),
                      style: AppTypography.bodyLarge
                          .copyWith(fontWeight: FontWeight.w700),),
                  if (row.overdue)
                    Text('overdue ${row.daysOverdue}d',
                        style: AppTypography.caption
                            .copyWith(color: AppColors.danger),),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: amountCtrl,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    isDense: true,
                    hintText: 'Amount',
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              DropdownButton<String>(
                value: mode,
                items: const [
                  DropdownMenuItem(value: 'cash', child: Text('Cash')),
                  DropdownMenuItem(value: 'upi', child: Text('UPI')),
                  DropdownMenuItem(value: 'cheque', child: Text('Cheque')),
                ],
                onChanged: (v) => onMode(v ?? 'cash'),
              ),
              IconButton(
                tooltip: 'Fill due',
                onPressed: onFill,
                icon: const Icon(Icons.bolt_rounded, color: AppColors.primary),
              ),
              IconButton(
                tooltip: 'Send pay link',
                onPressed: onPayLink,
                icon:
                    const Icon(Icons.qr_code_2_rounded, color: AppColors.info),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Run closed → settle cash via the single path: the Cash Float deposit.
/// (Collecting already credited the agent's float; depositing it to the branch
/// is the one settlement action, shared with the Cash Float screen.)
class _DepositHint extends StatelessWidget {
  const _DepositHint({required this.run, required this.fmt});
  final CollectionRun run;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Run closed', style: AppTypography.sectionTitle),
          const SizedBox(height: 10),
          Text('Cash collected this run: ${fmt.format(run.cashCollected)}',
              style: AppTypography.bodyLarge,),
          const SizedBox(height: 6),
          Text(
            'Your collections are now in your cash float. Hand the cash to the office from Cash Float — that is the single place cash is settled.',
            style: AppTypography.body.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () => context.push('/wallet'),
            icon: const Icon(Icons.account_balance_wallet_rounded),
            label: const Text('Go to Cash Float'),
          ),
        ],
      ),
    );
  }
}

class _PayLinkSheet extends StatelessWidget {
  const _PayLinkSheet({required this.name, required this.url});
  final String name;
  final String url;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Pay link · $name', style: AppTypography.sectionTitle),
            const SizedBox(height: 12),
            SelectableText(url, style: AppTypography.body),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: url));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Link copied')),
                      );
                    },
                    icon: const Icon(Icons.copy_rounded),
                    label: const Text('Copy'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () {
                      final wa = Uri.parse(
                          'https://wa.me/?text=${Uri.encodeComponent('Pay here: $url')}',);
                      launchUrl(wa, mode: LaunchMode.externalApplication);
                    },
                    icon: const Icon(Icons.share_rounded),
                    label: const Text('Share'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
