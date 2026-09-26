import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/data/services/notifications_service.dart';

class NotificationDeliveryLogScreen extends ConsumerStatefulWidget {
  const NotificationDeliveryLogScreen({super.key});

  @override
  ConsumerState<NotificationDeliveryLogScreen> createState() => _NotificationDeliveryLogScreenState();
}

class _NotificationDeliveryLogScreenState extends ConsumerState<NotificationDeliveryLogScreen> {
  final _search = TextEditingController();
  final _rows = <Map<String, dynamic>>[];
  String? _channel;
  String? _status;
  DateTimeRange? _range;
  String? _cursor;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load({bool more = false}) async {
    if (_loading) return;
    setState(() { _loading = true; _error = null; });
    try {
      final page = await ref.read(notificationsServiceProvider).deliveryLog(
        channel: _channel,
        status: _status,
        from: _range == null ? null : DateFormat('yyyy-MM-dd').format(_range!.start),
        to: _range == null ? null : DateFormat('yyyy-MM-dd').format(_range!.end),
        search: _search.text.trim(),
        cursor: more ? _cursor : null,
      );
      if (!mounted) return;
      setState(() {
        if (!more) _rows.clear();
        _rows.addAll(page.rows);
        _cursor = page.nextCursor;
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    String statusLabel(String value) => t.x('log.$value') == 'log.$value' ? value : t.x('log.$value');
    return Scaffold(
      appBar: AppBar(title: Text(t.x('set.notif_logs'))),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: Column(children: [
            TextField(
              controller: _search,
              decoration: InputDecoration(
                labelText: t.x('common.search'),
                suffixIcon: IconButton(
                  tooltip: t.x('common.search'),
                  icon: const Icon(Icons.search),
                  onPressed: () => _load(),
                ),
              ),
              onSubmitted: (_) => _load(),
            ),
            Row(children: [
              Expanded(child: DropdownButtonFormField<String>(
                initialValue: _channel,
                decoration: InputDecoration(labelText: t.x('log.channel')),
                items: [
                  DropdownMenuItem(value: '', child: Text(t.x('log.all'))),
                  for (final channel in ['sms', 'whatsapp', 'email', 'inapp'])
                    DropdownMenuItem(value: channel, child: Text(channel.toUpperCase())),
                ],
                onChanged: (value) { _channel = value == '' ? null : value; _load(); },
              )),
              const SizedBox(width: 8),
              Expanded(child: DropdownButtonFormField<String>(
                initialValue: _status,
                decoration: InputDecoration(labelText: t.x('log.status')),
                items: [
                  DropdownMenuItem(value: '', child: Text(t.x('log.all'))),
                  for (final status in ['pending', 'sent', 'delivered', 'failed'])
                    DropdownMenuItem(value: status, child: Text(statusLabel(status))),
                ],
                onChanged: (value) { _status = value == '' ? null : value; _load(); },
              )),
            ]),
            TextButton.icon(
              icon: const Icon(Icons.date_range),
              label: Text(_range == null
                  ? t.x('log.dates')
                  : '${DateFormat('dd MMM').format(_range!.start)} – ${DateFormat('dd MMM').format(_range!.end)}'),
              onPressed: () async {
                final now = DateTime.now();
                final picked = await showDateRangePicker(
                  context: context,
                  firstDate: DateTime(2020),
                  lastDate: now,
                  initialDateRange: _range,
                );
                if (!mounted || picked == null) return;
                setState(() => _range = picked);
                _load();
              },
            ),
          ]),
        ),
        if (_error != null)
          ListTile(
            title: Text(_error!),
            trailing: TextButton(onPressed: () => _load(), child: Text(t.x('common.retry'))),
          ),
        Expanded(child: RefreshIndicator(
          onRefresh: () => _load(),
          child: ListView.builder(
            itemCount: _rows.length + (_cursor != null || _loading ? 1 : 0),
            itemBuilder: (context, index) {
              if (index == _rows.length) {
                return Center(child: _loading
                    ? const CircularProgressIndicator()
                    : TextButton(onPressed: () => _load(more: true), child: Text(t.x('log.more'))));
              }
              final row = _rows[index];
              final date = DateTime.tryParse(row['createdAt']?.toString() ?? '');
              return ExpansionTile(
                key: ValueKey(row['id']),
                title: Text('${row['channel']?.toString().toUpperCase() ?? ''} · ${row['recipient'] ?? ''}'),
                subtitle: Text('${statusLabel(row['status']?.toString() ?? '')} · ${row['event'] ?? ''}'),
                trailing: Text(date == null ? '' : DateFormat('dd MMM\nHH:mm').format(date.toLocal())),
                children: [
                  if (row['provider'] != null) ListTile(title: Text(t.x('log.provider')), subtitle: Text(row['provider'].toString())),
                  if (row['messageBody'] != null) ListTile(title: Text(t.x('log.message')), subtitle: Text(row['messageBody'].toString())),
                  if (row['errorMessage'] != null) ListTile(title: Text(t.x('log.error')), subtitle: Text(row['errorMessage'].toString())),
                ],
              );
            },
          ),
        )),
      ]),
    );
  }
}
