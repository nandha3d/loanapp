import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/data/services/settings_service.dart';

class TwoFactorScreen extends ConsumerStatefulWidget {
  const TwoFactorScreen({super.key});

  @override
  ConsumerState<TwoFactorScreen> createState() => _TwoFactorScreenState();
}

class _TwoFactorScreenState extends ConsumerState<TwoFactorScreen> {
  final _code = TextEditingController();
  bool? _enabled;
  bool _busy = false;
  String? _secret;
  String? _qrCodeUrl;
  String? _setupToken;
  String? _error;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final enabled = await ref.read(settingsServiceProvider).twoFactorEnabled();
      if (mounted) setState(() { _enabled = enabled; _error = null; });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    }
  }

  Future<void> _start() async {
    setState(() { _busy = true; _error = null; });
    try {
      final data = await ref.read(settingsServiceProvider).startTwoFactorSetup();
      if (!mounted) return;
      setState(() {
        _secret = data['secret'] as String?;
        _qrCodeUrl = data['qrCodeUrl'] as String?;
        _setupToken = data['setupToken'] as String?;
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    final token = _setupToken;
    if (token == null) return;
    setState(() { _busy = true; _error = null; });
    try {
      await ref.read(settingsServiceProvider).verifyTwoFactorSetup(token, _code.text.trim());
      if (!mounted) return;
      setState(() {
        _enabled = true;
        _secret = null;
        _qrCodeUrl = null;
        _setupToken = null;
        _code.clear();
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _disable() async {
    final t = T.of(ref);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(t.x('2fa.disable')),
        content: Text(t.x('2fa.disable_confirm')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false), child: Text(t.x('common.cancel'))),
          TextButton(onPressed: () => Navigator.pop(dialog, true), child: Text(t.x('2fa.disable'))),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() { _busy = true; _error = null; });
    try {
      await ref.read(settingsServiceProvider).disableTwoFactor();
      if (mounted) setState(() => _enabled = false);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final qr = _qrCodeUrl;
    return Scaffold(
      appBar: AppBar(title: Text(t.x('2fa.title'))),
      body: _enabled == null && _error == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(20), children: [
              Text(_enabled == true ? t.x('2fa.enabled') : t.x('2fa.disabled')),
              const SizedBox(height: 16),
              if (_enabled == true)
                FilledButton(onPressed: _busy ? null : _disable, child: Text(t.x('2fa.disable')))
              else if (_setupToken == null)
                FilledButton(onPressed: _busy ? null : _start, child: Text(t.x('2fa.enable')))
              else ...[
                if (qr != null) Center(child: Image.memory(base64Decode(qr.split(',').last), width: 220, height: 220)),
                const SizedBox(height: 12),
                Text(t.x('2fa.manual')),
                SelectableText(_secret ?? ''),
                const SizedBox(height: 16),
                TextField(
                  controller: _code,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  decoration: InputDecoration(labelText: t.x('2fa.code')),
                ),
                FilledButton(onPressed: _busy ? null : _verify, child: Text(t.x('2fa.verify'))),
              ],
              if (_busy) const LinearProgressIndicator(),
              if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
            ]),
    );
  }
}
