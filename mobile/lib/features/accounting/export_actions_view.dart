import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/data/services/accounting_service.dart';

class ExportActionsView extends ConsumerStatefulWidget {
  const ExportActionsView({super.key});

  @override
  ConsumerState<ExportActionsView> createState() => _ExportActionsViewState();
}

class _ExportActionsViewState extends ConsumerState<ExportActionsView> {
  DateTime _date = DateTime.now();
  int _page = 1;
  Map<String, dynamic>? _runs;
  Map<String, dynamic>? _settings;
  String? _error;
  bool _busy = false;

  String get _period => DateFormat('yyyy-MM').format(_date);

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _busy = true; _error = null; });
    try {
      final service = ref.read(accountingServiceProvider);
      final runs = await service.listExportPage(_page);
      final settings = await service.getPremiumSettings();
      if (mounted) setState(() { _runs = runs; _settings = settings; });
    } catch (error) { if (mounted) setState(() => _error = '$error'); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _pickPeriod() async {
    final chosen = await showDatePicker(context: context, initialDate: _date,
      firstDate: DateTime(2000), lastDate: DateTime(2100),);
    if (chosen != null) setState(() => _date = chosen);
  }

  Future<void> _generate(String kind) async {
    setState(() => _busy = true);
    try {
      final service = ref.read(accountingServiceProvider);
      final from = DateFormat('yyyy-MM-dd').format(DateTime(_date.year, _date.month, 1));
      final to = DateFormat('yyyy-MM-dd').format(DateTime(_date.year, _date.month + 1, 0));
      final file = await service.generateAccountingExport(
        kind: kind, periodKey: _period, from: from, to: to,
      );
      final safeName = file.filename.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
      final folder = await getTemporaryDirectory();
      final path = '${folder.path}${Platform.pathSeparator}$safeName';
      await File(path).writeAsBytes(file.bytes, flush: true);
      await Share.shareXFiles([XFile(path)]);
      await _load();
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$error')));
    } finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _testTally() async {
    final t = T.of(ref);
    setState(() => _busy = true);
    try {
      final result = await ref.read(accountingServiceProvider).testTallyConnector();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(
        result['ok'] == true
          ? '${t.x('accounting.tally_connected')}: ${result['company'] ?? ''}'
          : '${t.x('common.error')}: ${result['error'] ?? ''}',
      ),),);
      }
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$error')));
    } finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _pushTally() async {
    final t = T.of(ref);
    final yes = await showDialog<bool>(context: context, builder: (dialogContext) => AlertDialog(
      title: Text(t.x('accounting.push_tally')),
      content: Text(t.x('accounting.push_tally_confirm')),
      actions: [
        TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: Text(t.x('common.cancel'))),
        FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: Text(t.x('accounting.push_tally'))),
      ],
    ),);
    if (yes != true) return;
    setState(() => _busy = true);
    try {
      final result = await ref.read(accountingServiceProvider).pushToTally(_period);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(
        '${t.x('accounting.tally_created')}: ${result['created']} · '
        '${t.x('accounting.tally_ignored')}: ${result['ignored']}',
      ),),);
      }
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$error')));
    } finally { if (mounted) setState(() => _busy = false); }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final role = ref.watch(authControllerProvider).user?.role;
    final canExport = role == UserRole.superadmin || role == UserRole.developer;
    final runs = (_runs?['rows'] as List<dynamic>? ?? [])
        .map((item) => Map<String, dynamic>.from(item as Map)).toList();
    final pages = (_runs?['pages'] as num?)?.toInt() ?? 1;
    return RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(16), children: [
      if (canExport) ...[
        ListTile(title: Text(t.x('accounting.period')), subtitle: Text(_period),
          trailing: const Icon(Icons.calendar_today), onTap: _pickPeriod,),
        Wrap(spacing: 8, runSpacing: 8, children: [
          OutlinedButton(onPressed: _busy ? null : () => _generate('tally_xml'),
            child: Text(t.x('accounting.export_tally_xml')),),
          OutlinedButton(onPressed: _busy ? null : () => _generate('json'),
            child: Text(t.x('accounting.export_json')),),
          OutlinedButton(onPressed: _busy ? null : () => _generate('excel'),
            child: Text(t.x('accounting.export_excel')),),
          if (_settings?['tallyConnectorEnabled'] == true) ...[
            TextButton(onPressed: _busy ? null : _testTally,
              child: Text(t.x('accounting.test_tally')),),
            FilledButton(onPressed: _busy ? null : _pushTally,
              child: Text(t.x('accounting.push_tally')),),
          ],
        ],),
      ],
      if (_busy && _runs == null) const Center(child: CircularProgressIndicator()),
      if (_error != null) ListTile(title: Text('${t.x('common.error')}: $_error'),
        trailing: IconButton(icon: const Icon(Icons.refresh), onPressed: _load),),
      if (runs.isEmpty && !_busy) ListTile(title: Text(t.x('accounting.no_export_runs'))),
      for (final run in runs) Card(child: ListTile(
        title: Text('${run['filename']}'),
        subtitle: Text('${run['kind']} · ${run['periodKey']} · '
          '${t.x('accounting.file_size')}: ${run['fileSize']}'),
        trailing: Text('${(run['byUser'] as Map?)?['name'] ?? ''}'),
      ),),
      if (pages > 1) Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        IconButton(tooltip: t.x('pen.previous_page'),
          onPressed: _busy || _page <= 1 ? null : () { _page--; _load(); },
          icon: const Icon(Icons.chevron_left),),
        Text('$_page / $pages'),
        IconButton(tooltip: t.x('pen.next_page'),
          onPressed: _busy || _page >= pages ? null : () { _page++; _load(); },
          icon: const Icon(Icons.chevron_right),),
      ],),
    ],),);
  }
}
