import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/data/services/accounting_service.dart';

class JournalEntryForm extends ConsumerStatefulWidget {
  const JournalEntryForm({super.key});

  @override
  ConsumerState<JournalEntryForm> createState() => _JournalEntryFormState();
}

class _Line {
  String? accountId;
  final debit = TextEditingController();
  final credit = TextEditingController();

  void dispose() {
    debit.dispose();
    credit.dispose();
  }
}

class _JournalEntryFormState extends ConsumerState<JournalEntryForm> {
  late final Future<List<Map<String, dynamic>>> _accounts;
  final _narration = TextEditingController();
  final _lines = <_Line>[_Line(), _Line()];
  DateTime _date = DateTime.now();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _accounts = ref.read(accountingServiceProvider).listCoA();
  }

  @override
  void dispose() {
    _narration.dispose();
    for (final line in _lines) {
      line.dispose();
    }
    super.dispose();
  }

  int? _cents(String raw) {
    final value = raw.trim();
    if (value.isEmpty) return 0;
    if (!RegExp(r'^\d+(\.\d{1,2})?$').hasMatch(value)) return null;
    final parts = value.split('.');
    final whole = int.tryParse(parts[0]);
    if (whole == null || whole > 9000000000000) return null;
    return whole * 100 +
        (parts.length == 2 ? int.parse(parts[1].padRight(2, '0')) : 0);
  }

  Future<void> _submit({required bool draft}) async {
    final t = T.of(ref);
    final payload = <Map<String, dynamic>>[];
    var totalDebit = 0;
    var totalCredit = 0;
    var meaningful = 0;
    for (var i = 0; i < _lines.length; i++) {
      final line = _lines[i];
      final debit = _cents(line.debit.text);
      final credit = _cents(line.credit.text);
      if (line.accountId == null || debit == null || credit == null ||
          (debit > 0 && credit > 0)) {
        _message(t.x('accounting.invalid_lines'));
        return;
      }
      if (debit > 0 || credit > 0) meaningful++;
      totalDebit += debit;
      totalCredit += credit;
      payload.add({
        'accountId': line.accountId,
        'debit': debit / 100,
        'credit': credit / 100,
        'lineNo': i,
      });
    }
    if (!draft && (meaningful < 2 || totalDebit == 0 || totalDebit != totalCredit)) {
      _message(t.x('accounting.unbalanced_lines'));
      return;
    }
    setState(() => _busy = true);
    try {
      final service = ref.read(accountingServiceProvider);
      final date = DateFormat('yyyy-MM-dd').format(_date);
      if (draft) {
        await service.draftJournal(entryDate: date, narration: _narration.text.trim(), lines: payload);
      } else {
        await service.postJournal(entryDate: date, narration: _narration.text.trim(), lines: payload);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) _message('${t.x('common.error')}: $error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _message(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    return Scaffold(
      appBar: AppBar(title: Text(t.x('accounting.new_journal'))),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _accounts,
        builder: (context, snapshot) {
          if (snapshot.hasError) return Center(child: Text('${t.x('common.error')}: ${snapshot.error}'));
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          final accounts = snapshot.data!.where((a) => a['isActive'] == true).toList();
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              ListTile(
                title: Text(t.x('accounting.entry_date')),
                subtitle: Text(DateFormat('yyyy-MM-dd').format(_date)),
                trailing: const Icon(Icons.calendar_today_outlined),
                onTap: _busy ? null : () async {
                  final selected = await showDatePicker(
                    context: context,
                    initialDate: _date,
                    firstDate: DateTime(2000),
                    lastDate: DateTime(2100),
                  );
                  if (selected != null) setState(() => _date = selected);
                },
              ),
              TextField(
                controller: _narration,
                enabled: !_busy,
                decoration: InputDecoration(labelText: t.x('accounting.narration')),
              ),
              const SizedBox(height: 16),
              for (var i = 0; i < _lines.length; i++)
                Card(
                  key: ObjectKey(_lines[i]),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Expanded(child: Text('${t.x('accounting.line')} ${i + 1}')),
                            if (_lines.length > 2)
                              IconButton(
                                tooltip: t.x('accounting.remove_line'),
                                onPressed: _busy ? null : () {
                                  final removed = _lines.removeAt(i);
                                  setState(() {});
                                  WidgetsBinding.instance.addPostFrameCallback((_) => removed.dispose());
                                },
                                icon: const Icon(Icons.remove_circle_outline),
                              ),
                          ],
                        ),
                        DropdownButtonFormField<String>(
                          initialValue: _lines[i].accountId,
                          isExpanded: true,
                          decoration: InputDecoration(labelText: t.x('accounting.account_name')),
                          items: accounts.map((account) => DropdownMenuItem<String>(
                            value: account['id'] as String,
                            child: Text('[${account['code']}] ${account['name']}', overflow: TextOverflow.ellipsis),
                          ),).toList(),
                          onChanged: _busy ? null : (value) => _lines[i].accountId = value,
                        ),
                        Row(
                          children: [
                            Expanded(child: TextField(
                              controller: _lines[i].debit,
                              enabled: !_busy,
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              decoration: InputDecoration(labelText: t.x('accounting.debit')),
                            ),),
                            const SizedBox(width: 12),
                            Expanded(child: TextField(
                              controller: _lines[i].credit,
                              enabled: !_busy,
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              decoration: InputDecoration(labelText: t.x('accounting.credit')),
                            ),),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              TextButton.icon(
                onPressed: _busy ? null : () => setState(() => _lines.add(_Line())),
                icon: const Icon(Icons.add),
                label: Text(t.x('accounting.add_line')),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(child: OutlinedButton(
                    onPressed: _busy ? null : () => _submit(draft: true),
                    child: Text(t.x('accounting.save_draft')),
                  ),),
                  const SizedBox(width: 12),
                  Expanded(child: FilledButton(
                    onPressed: _busy ? null : () => _submit(draft: false),
                    child: Text(t.x('accounting.post_journal')),
                  ),),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}
