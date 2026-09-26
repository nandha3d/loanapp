import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/data/services/settings_service.dart';

class NotificationTemplatesScreen extends ConsumerStatefulWidget {
  const NotificationTemplatesScreen({super.key});

  @override
  ConsumerState<NotificationTemplatesScreen> createState() => _NotificationTemplatesScreenState();
}

class _NotificationTemplatesScreenState extends ConsumerState<NotificationTemplatesScreen> {
  static const _events = [
    ('payment_received', 'set.notif_payment_received'),
    ('payment_due_reminder', 'set.notif_due_reminder'),
    ('loan_disbursed', 'set.notif_loan_disbursed'),
    ('loan_overdue', 'set.notif_loan_overdue'),
    ('loan_closed', 'set.notif_loan_closed'),
    ('penalty_accrued', 'set.notif_penalty_accrued'),
  ];
  static const _channels = ['sms', 'whatsapp', 'push'];
  static const _languages = ['en', 'ta', 'hi', 'te', 'kn', 'ml'];

  final _body = TextEditingController();
  final _subject = TextEditingController();
  List<Map<String, dynamic>> _templates = [];
  String _event = _events.first.$1;
  String _channel = _channels.first;
  String _lang = _languages.first;
  bool _active = true;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _body.dispose();
    _subject.dispose();
    super.dispose();
  }

  void _showSelection() {
    final matches = _templates.where((row) =>
        row['name'] == _event && row['channel'] == _channel && row['lang'] == _lang);
    final row = matches.isEmpty ? null : matches.first;
    _body.text = row?['body']?.toString() ?? '';
    _subject.text = row?['subject']?.toString() ?? '';
    _active = row?['isActive'] != false;
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final templates = await ref.read(settingsServiceProvider).notificationTemplates();
      if (!mounted) return;
      setState(() { _templates = templates; _showSelection(); });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    final t = T.of(ref);
    if (_body.text.trim().isEmpty) {
      setState(() => _error = t.x('tmpl.body_required'));
      return;
    }
    setState(() { _saving = true; _error = null; });
    try {
      await ref.read(settingsServiceProvider).saveNotificationTemplate({
        'name': _event,
        'channel': _channel,
        'lang': _lang,
        'body': _body.text.trim(),
        'subject': _channel == 'push' ? _subject.text.trim() : null,
        'isActive': _active,
      });
      await _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t.x('tmpl.saved'))),
      );
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    return Scaffold(
      appBar: AppBar(title: Text(t.x('tmpl.title'))),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(16), children: [
              DropdownButtonFormField<String>(
                initialValue: _event,
                decoration: InputDecoration(labelText: t.x('tmpl.event')),
                items: [for (final event in _events)
                  DropdownMenuItem(value: event.$1, child: Text(t.x(event.$2)))],
                onChanged: (value) => setState(() { _event = value ?? _event; _showSelection(); }),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _lang,
                decoration: InputDecoration(labelText: t.x('tmpl.language')),
                items: [for (final lang in _languages)
                  DropdownMenuItem(value: lang, child: Text(lang.toUpperCase()))],
                onChanged: (value) => setState(() { _lang = value ?? _lang; _showSelection(); }),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _channel,
                decoration: InputDecoration(labelText: t.x('log.channel')),
                items: [for (final channel in _channels)
                  DropdownMenuItem(value: channel, child: Text(channel.toUpperCase()))],
                onChanged: (value) => setState(() { _channel = value ?? _channel; _showSelection(); }),
              ),
              const SizedBox(height: 12),
              if (_channel == 'push') ...[
                TextField(controller: _subject, decoration: InputDecoration(labelText: t.x('tmpl.subject'))),
                const SizedBox(height: 12),
              ],
              TextField(
                controller: _body,
                maxLines: 6,
                decoration: InputDecoration(labelText: t.x('tmpl.body')),
              ),
              SwitchListTile.adaptive(
                title: Text(t.x('tmpl.active')),
                value: _active,
                onChanged: (value) => setState(() => _active = value),
              ),
              if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
              const SizedBox(height: 12),
              FilledButton(onPressed: _saving ? null : _save, child: Text(t.x('common.save'))),
            ]),
    );
  }
}
