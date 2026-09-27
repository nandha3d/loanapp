import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/data/services/accounting_service.dart';

const _months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

class BudgetDetailScreen extends ConsumerStatefulWidget {
  const BudgetDetailScreen({required this.id, super.key});
  final String id;

  @override
  ConsumerState<BudgetDetailScreen> createState() => _BudgetDetailScreenState();
}

class _BudgetDetailScreenState extends ConsumerState<BudgetDetailScreen> {
  Map<String, dynamic>? _data;
  String? _error;
  bool _busy = false;
  late String _periodKey;

  @override
  void initState() {
    super.initState();
    _periodKey = DateFormat('yyyy-MM').format(DateTime.now());
    _load();
  }

  Future<void> _load() async {
    setState(() { _busy = true; _error = null; });
    try {
      final data = await ref.read(accountingServiceProvider).getBudget(widget.id, periodKey: _periodKey);
      if (mounted) setState(() => _data = data);
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
      await _load();
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addLine() async {
    final t = T.of(ref);
    final accounts = await ref.read(accountingServiceProvider).listCoA();
    if (!mounted) return;
    final budget = Map<String, dynamic>.from(_data?['budget'] as Map? ?? {});
    final used = (budget['lines'] as List<dynamic>? ?? [])
        .map((item) => (item as Map)['accountId']).toSet();
    final available = accounts.where((account) =>
        account['isActive'] == true &&
        ['income', 'expense'].contains(account['classType']) &&
        !used.contains(account['id']),).toList();
    String? selected;
    final accountId = await showDialog<String>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, update) => AlertDialog(
          title: Text(t.x('accounting.add_budget_account')),
          content: DropdownButtonFormField<String>(
            isExpanded: true,
            decoration: InputDecoration(labelText: t.x('accounting.account_name')),
            items: available.map((account) => DropdownMenuItem<String>(
              value: account['id'] as String,
              child: Text('[${account['code']}] ${account['name']}', overflow: TextOverflow.ellipsis),
            ),).toList(),
            onChanged: (value) => update(() => selected = value),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext), child: Text(t.x('common.cancel'))),
            TextButton(onPressed: selected == null ? null : () => Navigator.pop(dialogContext, selected), child: Text(t.x('accounting.add_line'))),
          ],
        ),
      ),
    );
    if (accountId != null) await _run(() => ref.read(accountingServiceProvider).addBudgetLine(widget.id, accountId));
  }

  Future<void> _editMonth(Map<String, dynamic> line) async {
    final t = T.of(ref);
    String field = _months[DateTime.now().month - 1];
    final amount = TextEditingController(text: '${line[field] ?? 0}');
    final change = await showDialog<(String, double)>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, update) => AlertDialog(
          title: Text(t.x('accounting.edit_budget_amount')),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('${(line['account'] as Map?)?['name'] ?? ''}'),
              DropdownButtonFormField<String>(
                initialValue: field,
                decoration: InputDecoration(labelText: t.x('accounting.month')),
                items: [for (var i = 0; i < 12; i++)
                  DropdownMenuItem(value: _months[i], child: Text('${i + 1}'.padLeft(2, '0'))),],
                onChanged: (value) => update(() {
                  field = value ?? field;
                  amount.text = '${line[field] ?? 0}';
                }),
              ),
              TextField(
                controller: amount,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(labelText: t.x('accounting.amount')),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext), child: Text(t.x('common.cancel'))),
            TextButton(onPressed: () {
              final value = amount.text.trim();
              if (!RegExp(r'^\d+(\.\d{1,2})?$').hasMatch(value)) return;
              Navigator.pop(dialogContext, (field, double.parse(value)));
            }, child: Text(t.x('common.save')),),
          ],
        ),
      ),
    );
    amount.dispose();
    if (change != null) {
      await _run(() => ref.read(accountingServiceProvider).updateBudgetLine(
        widget.id, line['id'] as String, change.$1, change.$2,
      ),);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    final role = ref.watch(authControllerProvider).user?.role;
    final canEdit = role == UserRole.superadmin || role == UserRole.developer;
    final budget = Map<String, dynamic>.from(_data?['budget'] as Map? ?? {});
    final lines = (budget['lines'] as List<dynamic>? ?? [])
        .map((item) => Map<String, dynamic>.from(item as Map)).toList();
    final variance = (_data?['variance'] as List<dynamic>? ?? [])
        .map((item) => Map<String, dynamic>.from(item as Map)).toList();
    final draft = budget['status'] == 'draft';

    return Scaffold(
      appBar: AppBar(title: Text(budget['name']?.toString() ?? t.x('accounting.budget'))),
      body: _data == null && _busy
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('${t.x('common.error')}: $_error'))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Text('${budget['fiscalYear'] ?? ''} · ${budget['status'] ?? ''}'),
                      const SizedBox(height: 12),
                      if (canEdit && draft)
                        OutlinedButton.icon(
                          onPressed: _busy ? null : _addLine,
                          icon: const Icon(Icons.add),
                          label: Text(t.x('accounting.add_budget_account')),
                        ),
                      for (final line in lines)
                        Card(child: ListTile(
                          title: Text('${(line['account'] as Map?)?['name'] ?? ''}'),
                          subtitle: Text('${t.x('accounting.annual_total')}: ${fmt.format(double.tryParse('${line['annual']}') ?? 0)}'),
                          trailing: canEdit && draft ? const Icon(Icons.edit_outlined) : null,
                          onTap: canEdit && draft && !_busy ? () => _editMonth(line) : null,
                        ),),
                      if (canEdit && draft)
                        FilledButton(
                          onPressed: _busy ? null : () => _run(() => ref.read(accountingServiceProvider).setBudgetStatus(widget.id, 'approve')),
                          child: Text(t.x('accounting.review_approve')),
                        ),
                      if (canEdit && budget['status'] != 'archived')
                        TextButton(
                          onPressed: _busy ? null : () => _run(() => ref.read(accountingServiceProvider).setBudgetStatus(widget.id, 'archive')),
                          child: Text(t.x('accounting.archive_budget')),
                        ),
                      const Divider(),
                      ListTile(
                        title: Text(t.x('accounting.variance')),
                        subtitle: Text(_periodKey),
                        trailing: const Icon(Icons.calendar_month),
                        onTap: () async {
                          final selected = await showDatePicker(
                            context: context,
                            initialDate: DateTime.parse('$_periodKey-01'),
                            firstDate: DateTime(2000),
                            lastDate: DateTime(2100),
                          );
                          if (selected != null) {
                            _periodKey = DateFormat('yyyy-MM').format(selected);
                            await _load();
                          }
                        },
                      ),
                      for (final row in variance)
                        ListTile(
                          title: Text(row['name']?.toString() ?? ''),
                          subtitle: Text('${t.x('accounting.budget')}: ${fmt.format(double.tryParse('${row['budgetAmt']}') ?? 0)} · ${t.x('accounting.actual')}: ${fmt.format(double.tryParse('${row['actualAmt']}') ?? 0)}'),
                          trailing: Text(fmt.format(double.tryParse('${row['varAmt']}') ?? 0)),
                        ),
                    ],
                  ),
                ),
    );
  }
}
