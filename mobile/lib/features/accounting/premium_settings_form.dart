import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/data/services/accounting_service.dart';

const _textFields = [
  'gstin', 'state', 'baseCurrency', 'postingOverrides',
  'tallyConnectorUrl', 'tallyCompanyName',
];
const _moneyFields = [
  'adminJeCap', 'adminBillCap', 'twoLevelApprovalThreshold', 'varianceAlertPct',
];
const _integerFields = ['apOverdueAlertDays'];
const _boolFields = [
  'costCentresEnabled', 'showPremiumBannerInBase', 'adminCanEditCoA',
  'adminCanLockPeriod', 'tallyConnectorEnabled', 'allowFutureDated',
];

class PremiumSettingsForm extends ConsumerStatefulWidget {
  const PremiumSettingsForm({required this.initial, super.key});
  final Map<String, dynamic> initial;

  @override
  ConsumerState<PremiumSettingsForm> createState() => _PremiumSettingsFormState();
}

class _PremiumSettingsFormState extends ConsumerState<PremiumSettingsForm> {
  final _controllers = <String, TextEditingController>{};
  final _switches = <String, bool>{};
  late Future<List<Map<String, dynamic>>> _accounts;
  late String _gstScheme;
  late String _baseMode;
  late int _fiscalMonth;
  String? _bankAccountId;
  String? _cashAccountId;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    for (final key in [..._textFields, ..._moneyFields, ..._integerFields]) {
      _controllers[key] = TextEditingController(text: widget.initial[key]?.toString() ?? '');
    }
    for (final key in _boolFields) {
      _switches[key] = widget.initial[key] == true;
    }
    _gstScheme = widget.initial['gstScheme']?.toString() ?? 'regular';
    _baseMode = widget.initial['baseAccountingMode']?.toString() ?? 'derive_only';
    _fiscalMonth = (widget.initial['fiscalYearStartMonth'] as num?)?.toInt() ?? 4;
    _bankAccountId = widget.initial['defaultBankAccountId'] as String?;
    _cashAccountId = widget.initial['defaultCashAccountId'] as String?;
    _accounts = ref.read(accountingServiceProvider).listCoA();
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final t = T.of(ref);
    final patch = <String, dynamic>{
      'fiscalYearStartMonth': _fiscalMonth,
      'gstScheme': _gstScheme,
      'baseAccountingMode': _baseMode,
      'defaultBankAccountId': _bankAccountId ?? '',
      'defaultCashAccountId': _cashAccountId ?? '',
      ..._switches,
    };
    for (final key in _textFields) {
      patch[key] = _controllers[key]!.text.trim();
    }
    for (final key in _moneyFields) {
      final raw = _controllers[key]!.text.trim();
      if (!RegExp(r'^\d+(\.\d{1,2})?$').hasMatch(raw)) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t.x('accounting.invalid_setting'))));
        return;
      }
      patch[key] = double.parse(raw);
    }
    for (final key in _integerFields) {
      final value = int.tryParse(_controllers[key]!.text.trim());
      if (value == null || value < 0) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t.x('accounting.invalid_setting'))));
        return;
      }
      patch[key] = value;
    }
    setState(() => _busy = true);
    try {
      await ref.read(accountingServiceProvider).updatePremiumSettings(patch);
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${t.x('common.error')}: $error')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _accountPicker(T t, String key, List<Map<String, dynamic>> accounts, String? value, ValueChanged<String?> onChanged) {
    return DropdownButtonFormField<String?>(
      initialValue: value,
      isExpanded: true,
      decoration: InputDecoration(labelText: t.x('accounting.setting_$key')),
      items: [
        DropdownMenuItem<String?>(value: null, child: Text(t.x('accounting.no_parent'))),
        ...accounts.map((account) => DropdownMenuItem<String?>(
          value: account['id'] as String,
          child: Text('[${account['code']}] ${account['name']}', overflow: TextOverflow.ellipsis),
        ),),
      ],
      onChanged: _busy ? null : onChanged,
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    return Scaffold(
      appBar: AppBar(title: Text(t.x('accounting.edit_settings'))),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _accounts,
        builder: (context, snapshot) {
          if (snapshot.hasError) return Center(child: Text('${t.x('common.error')}: ${snapshot.error}'));
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          final accounts = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              DropdownButtonFormField<int>(
                initialValue: _fiscalMonth,
                decoration: InputDecoration(labelText: t.x('accounting.setting_fiscalYearStartMonth')),
                items: [for (var month = 1; month <= 12; month++)
                  DropdownMenuItem(value: month, child: Text('$month')),],
                onChanged: _busy ? null : (value) => setState(() => _fiscalMonth = value ?? _fiscalMonth),
              ),
              for (final key in _textFields)
                TextField(
                  controller: _controllers[key],
                  enabled: !_busy,
                  maxLines: key == 'postingOverrides' ? 5 : 1,
                  decoration: InputDecoration(labelText: t.x('accounting.setting_$key')),
                ),
              DropdownButtonFormField<String>(
                initialValue: _gstScheme,
                decoration: InputDecoration(labelText: t.x('accounting.setting_gstScheme')),
                items: ['regular', 'composition', 'exempt']
                    .map((value) => DropdownMenuItem(value: value, child: Text(t.x('accounting.option_$value'))))
                    .toList(),
                onChanged: _busy ? null : (value) => setState(() => _gstScheme = value ?? _gstScheme),
              ),
              DropdownButtonFormField<String>(
                initialValue: _baseMode,
                decoration: InputDecoration(labelText: t.x('accounting.setting_baseAccountingMode')),
                items: ['derive_only', 'mirror', 'replace']
                    .map((value) => DropdownMenuItem(value: value, child: Text(t.x('accounting.option_$value'))))
                    .toList(),
                onChanged: _busy ? null : (value) => setState(() => _baseMode = value ?? _baseMode),
              ),
              for (final key in [..._moneyFields, ..._integerFields])
                TextField(
                  controller: _controllers[key],
                  enabled: !_busy,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(labelText: t.x('accounting.setting_$key')),
                ),
              for (final key in _boolFields)
                SwitchListTile(
                  title: Text(t.x('accounting.setting_$key')),
                  value: _switches[key] ?? false,
                  onChanged: _busy ? null : (value) => setState(() => _switches[key] = value),
                ),
              _accountPicker(t, 'defaultBankAccountId', accounts.where((a) => (a['isActive'] == true && a['subType'] == 'bank') || a['id'] == _bankAccountId).toList(), _bankAccountId,
                  (value) => setState(() => _bankAccountId = value),),
              _accountPicker(t, 'defaultCashAccountId', accounts.where((a) => (a['isActive'] == true && a['subType'] == 'cash') || a['id'] == _cashAccountId).toList(), _cashAccountId,
                  (value) => setState(() => _cashAccountId = value),),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _busy ? null : _save,
                child: Text(t.x('common.save')),
              ),
            ],
          );
        },
      ),
    );
  }
}
