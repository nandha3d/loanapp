import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/data/services/accounting_service.dart';

double _money(dynamic value) => double.tryParse('$value') ?? 0;

String _quarter(DateTime day) {
  final fy = day.month >= 4 ? day.year : day.year - 1;
  final quarter = ((day.month - 4 + 12) % 12) ~/ 3 + 1;
  return 'Q$quarter-$fy-${(fy + 1).toString().substring(2)}';
}

class TaxActionsView extends ConsumerStatefulWidget {
  const TaxActionsView({super.key});

  @override
  ConsumerState<TaxActionsView> createState() => _TaxActionsViewState();
}

class _TaxActionsViewState extends ConsumerState<TaxActionsView> {
  DateTime _date = DateTime.now();
  Map<String, dynamic>? _summary;
  List<Map<String, dynamic>> _tds = [];
  final _selected = <String>{};
  String? _error;
  bool _busy = false;

  String get _period => DateFormat('yyyy-MM').format(_date);

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _busy = true; _error = null; });
    try {
      final service = ref.read(accountingServiceProvider);
      final summary = await service.getTaxSummary(periodKey: _period);
      final tds = await service.getTdsRegister(_quarter(_date));
      if (mounted) setState(() { _summary = summary; _tds = tds; _selected.clear(); });
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _pickPeriod() async {
    final chosen = await showDatePicker(context: context, initialDate: _date,
      firstDate: DateTime(2000), lastDate: DateTime(2100),);
    if (chosen != null) { setState(() => _date = chosen); await _load(); }
  }

  Future<void> _act(Future<void> Function() action) async {
    setState(() => _busy = true);
    try { await action(); await _load(); }
    catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$error')));
    } finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _file() async {
    final t = T.of(ref);
    final ack = TextEditingController();
    final value = await showDialog<String>(context: context, builder: (dialogContext) => AlertDialog(
      title: Text(t.x('accounting.mark_gst_filed')),
      content: TextField(controller: ack, decoration: InputDecoration(labelText: t.x('accounting.ack_number'))),
      actions: [
        TextButton(onPressed: () => Navigator.pop(dialogContext), child: Text(t.x('common.cancel'))),
        FilledButton(onPressed: () { if (ack.text.trim().isNotEmpty) Navigator.pop(dialogContext, ack.text.trim()); },
          child: Text(t.x('accounting.mark_gst_filed')),),
      ],
    ),);
    ack.dispose();
    if (value != null) await _act(() => ref.read(accountingServiceProvider).markGstFiled(_period, value));
  }

  Future<void> _recordChallan() async {
    final t = T.of(ref);
    final no = TextEditingController();
    final amount = TextEditingController();
    DateTime date = DateTime.now();
    final values = await showDialog<(String, String, double)>(context: context,
      builder: (dialogContext) => StatefulBuilder(builder: (dialogContext, update) => AlertDialog(
        title: Text(t.x('accounting.record_challan')),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: no, decoration: InputDecoration(labelText: t.x('accounting.challan_number'))),
          TextField(controller: amount, keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(labelText: t.x('accounting.amount')),),
          ListTile(title: Text(t.x('accounting.challan_date')),
            subtitle: Text(DateFormat('yyyy-MM-dd').format(date)),
            onTap: () async {
              final picked = await showDatePicker(context: dialogContext, initialDate: date,
                firstDate: DateTime(2000), lastDate: DateTime(2100),);
              if (picked != null) update(() => date = picked);
            },),
        ],),),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: Text(t.x('common.cancel'))),
          FilledButton(onPressed: () {
            final money = RegExp(r'^\d+(\.\d{1,2})?$');
            if (no.text.trim().isEmpty || !money.hasMatch(amount.text.trim()) || double.parse(amount.text) <= 0) return;
            Navigator.pop(dialogContext, (no.text.trim(), DateFormat('yyyy-MM-dd').format(date), double.parse(amount.text)));
          }, child: Text(t.x('accounting.record_challan')),),
        ],
      ),),
    );
    no.dispose(); amount.dispose();
    if (values != null) {
      await _act(() => ref.read(accountingServiceProvider).recordChallan(
      challanNo: values.$1, challanDate: values.$2, amount: values.$3,
      deductionIds: _selected.toList(),
    ),);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    final role = ref.watch(authControllerProvider).user?.role;
    final canReview = role == UserRole.superadmin || role == UserRole.developer;
    final gst = Map<String, dynamic>.from((_summary?['gst'] as Map?) ?? {});
    final global = _summary?['gstScope'] != 'all_branches_required';
    return RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(16), children: [
      ListTile(title: Text(t.x('accounting.period')), subtitle: Text('$_period · ${_quarter(_date)}'),
        trailing: const Icon(Icons.calendar_today), onTap: _pickPeriod,),
      if (_busy && _summary == null) const Center(child: CircularProgressIndicator()),
      if (_error != null) ListTile(title: Text('${t.x('common.error')}: $_error'),
        trailing: IconButton(icon: const Icon(Icons.refresh), onPressed: _load),),
      if (!global) ListTile(title: Text(t.x('accounting.select_all_branches_gst'))),
      if (global && _summary != null) ...[
        Card(child: Column(children: [
          ListTile(title: Text(t.x('accounting.gst_liability')),
            trailing: Text(fmt.format(_money(gst['netLiability']))),),
          ListTile(title: Text(t.x('accounting.gst_status')),
            trailing: Text(t.x(gst['status'] == 'filed' ? 'accounting.filed' : 'accounting.draft')),),
          Wrap(spacing: 8, children: [
            FilledButton(onPressed: _busy ? null : () => _act(() =>
              ref.read(accountingServiceProvider).recomputeGst(_period),),
              child: Text(t.x('accounting.recompute_gst')),),
            if (canReview && gst['status'] != 'filed')
              OutlinedButton(onPressed: _busy ? null : _file,
                child: Text(t.x('accounting.mark_gst_filed')),),
          ],),
        ],),),
      ],
      const SizedBox(height: 16),
      Text(t.x('accounting.tds_register'), style: Theme.of(context).textTheme.titleMedium),
      if (canReview && _selected.isNotEmpty)
        FilledButton(onPressed: _busy ? null : _recordChallan,
          child: Text(t.x('accounting.record_challan')),),
      if (_tds.isEmpty && !_busy) ListTile(title: Text(t.x('accounting.no_tds'))),
      for (final row in _tds) Card(child: CheckboxListTile(
        value: _selected.contains('${row['id']}'),
        onChanged: canReview && row['status'] == 'deducted' ? (value) => setState(() {
          if (value == true) { _selected.add('${row['id']}'); }
          else { _selected.remove('${row['id']}'); }
        }) : null,
        title: Text('${row['vendorName']} · ${row['section']}'),
        subtitle: Text('${row['challanNo'] ?? ''} · ${t.x(row['status'] == 'remitted' ? 'accounting.remitted' : 'accounting.deducted')}'),
        secondary: Text(fmt.format(_money(row['tdsAmount']))),
      ),),
    ],),);
  }
}
