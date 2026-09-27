import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/data/services/settings_service.dart';

class CustomerImportScreen extends ConsumerStatefulWidget {
  const CustomerImportScreen({super.key});

  @override
  ConsumerState<CustomerImportScreen> createState() =>
      _CustomerImportScreenState();
}

class _CustomerImportScreenState extends ConsumerState<CustomerImportScreen> {
  List<dynamic>? _rows;
  String? _filename;
  Map<String, dynamic>? _result;
  String? _error;
  bool _busy = false;

  Future<void> _select() async {
    final picked = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['json'],
      withData: true,
    );
    if (!mounted || picked == null) return;
    try {
      final bytes = picked.files.single.bytes;
      if (bytes == null) throw const FormatException('File could not be read');
      final decoded = jsonDecode(utf8.decode(bytes));
      if (decoded is! List<dynamic>) {
        throw const FormatException('Expected a JSON array');
      }
      setState(() {
        _rows = decoded;
        _filename = picked.files.single.name;
        _result = null;
        _error = null;
      });
    } catch (_) {
      setState(() {
        _rows = null;
        _filename = null;
        _result = null;
        _error = T.of(ref).x('set.import_invalid_json');
      });
    }
  }

  Future<void> _import() async {
    final rows = _rows;
    if (rows == null || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result =
          await ref.read(settingsServiceProvider).importCustomers(rows);
      if (mounted) {
        setState(() {
          _result = result;
          _rows = null;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final rows = _rows;
    final result = _result;
    return Scaffold(
      appBar: AppBar(title: Text(t.x('set.import_customers'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(t.x('set.import_instructions')),
          const SizedBox(height: 8),
          const SelectableText(
            '[{"name":"Ravi","phone":"9876543210","customerCode":"CUS001"}]',
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: _busy ? null : _select,
            icon: const Icon(Icons.upload_file),
            label: Text(t.x('set.import_select_json')),
          ),
          if (rows != null) ...[
            const SizedBox(height: 12),
            Text('$_filename · ${rows.length} ${t.x('set.import_rows')}'),
            const SizedBox(height: 8),
            Text(t.x('set.import_preview')),
            for (final entry in rows.take(5).toList().asMap().entries)
              Text(
                '${entry.key + 1}. ${entry.value is Map ? (entry.value as Map)['name'] ?? '—' : '—'}',
              ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _busy ? null : _import,
              child: Text(
                _busy ? t.x('set.import_running') : t.x('set.import_confirm'),
              ),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          if (result != null) ...[
            const SizedBox(height: 16),
            Text(
              '${t.x('set.import_complete')}: ${result['success']} ${t.x('set.import_succeeded')}, ${result['failed']} ${t.x('set.import_failed')}',
            ),
            for (final error
                in (result['errors'] as List<dynamic>? ?? const []))
              Text(
                '${t.x('set.import_row')} ${(error as Map)['row']}: ${error['message']}',
              ),
          ],
        ],
      ),
    );
  }
}
