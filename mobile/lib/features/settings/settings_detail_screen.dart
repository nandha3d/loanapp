import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/route_model.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/data/services/settings_service.dart';
import 'package:zolofund/features/settings/two_factor_screen.dart';
import 'package:zolofund/shared/widgets/app_button.dart';

class SettingsDetailScreen extends ConsumerStatefulWidget {
  const SettingsDetailScreen({
    super.key,
    required this.title,
    required this.type,
  });

  final String title;
  final String type; // packages, bulk, bureau, npa, security

  @override
  ConsumerState<SettingsDetailScreen> createState() =>
      _SettingsDetailScreenState();
}

class _PackageEditor extends ConsumerStatefulWidget {
  const _PackageEditor({this.package});
  final LoanPackage? package;

  @override
  ConsumerState<_PackageEditor> createState() => _PackageEditorState();
}

class _PackageEditorState extends ConsumerState<_PackageEditor> {
  late final Map<String, TextEditingController> _fields;
  late String _deductionType;
  late String _frequency;
  late String _status;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final p = widget.package;
    _fields = {
      'name': TextEditingController(text: p?.name ?? ''),
      'principal': TextEditingController(text: p?.principal.toString() ?? ''),
      'deduction': TextEditingController(text: p?.deduction.toString() ?? ''),
      'tenure': TextEditingController(text: p?.tenure.toString() ?? ''),
      'perInstalment': TextEditingController(text: p?.perInstalment.toString() ?? ''),
      'penaltyRate': TextEditingController(text: p?.penaltyRate.toString() ?? ''),
    };
    _deductionType = p?.deductionType ?? 'fixed';
    _frequency = p?.frequency ?? 'daily';
    _status = p?.status ?? 'active';
  }

  @override
  void dispose() {
    for (final controller in _fields.values) { controller.dispose(); }
    super.dispose();
  }

  Future<void> _save() async {
    final t = T.of(ref);
    final principal = double.tryParse(_fields['principal']!.text);
    final deduction = double.tryParse(_fields['deduction']!.text);
    final tenure = int.tryParse(_fields['tenure']!.text);
    final perInstalment = double.tryParse(_fields['perInstalment']!.text);
    final penaltyRate = double.tryParse(_fields['penaltyRate']!.text);
    if (_fields['name']!.text.trim().isEmpty || principal == null || deduction == null ||
        tenure == null || perInstalment == null || penaltyRate == null) {
      setState(() => _error = t.x('pkg.valid_terms'));
      return;
    }
    final data = <String, dynamic>{
      'name': _fields['name']!.text.trim(),
      'principal': principal,
      'deduction': deduction,
      'deductionType': _deductionType,
      'frequency': _frequency,
      'tenure': tenure,
      'perInstalment': perInstalment,
      'penaltyRate': penaltyRate,
      if (widget.package != null) 'status': _status,
    };
    setState(() { _saving = true; _error = null; });
    try {
      final service = ref.read(settingsServiceProvider);
      if (widget.package == null) await service.createPackage(data);
      else await service.updatePackage(widget.package!.id, data);
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    Widget field(String key, String label) => Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: TextField(
        controller: _fields[key],
        keyboardType: key == 'name' ? TextInputType.text : const TextInputType.numberWithOptions(decimal: true),
        decoration: InputDecoration(labelText: label),
      ),
    );
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.viewInsetsOf(context).bottom + 16),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.package == null ? t.x('pkg.create') : t.x('pkg.edit'), style: AppTypography.sectionTitle),
              field('name', t.x('pkg.name')),
              field('principal', t.x('pkg.principal')),
              if (widget.package == null)
                DropdownButtonFormField<String>(
                  initialValue: _deductionType,
                  decoration: InputDecoration(labelText: t.x('pkg.deduction_type')),
                  items: [
                    DropdownMenuItem(value: 'fixed', child: Text(t.x('pkg.fixed'))),
                    DropdownMenuItem(value: 'percentage', child: Text(t.x('pkg.percentage'))),
                  ],
                  onChanged: (value) => setState(() => _deductionType = value ?? _deductionType),
                ),
              field('deduction', widget.package != null
                  ? t.x('pkg.stored_deduction')
                  : _deductionType == 'percentage' ? t.x('pkg.deduction_percent') : t.x('pkg.deduction_amount')),
              DropdownButtonFormField<String>(
                initialValue: _frequency,
                decoration: InputDecoration(labelText: t.x('pkg.frequency')),
                items: ['daily', 'weekly', 'biweekly', 'monthly']
                    .map((value) => DropdownMenuItem(value: value, child: Text(t.x('pkg.$value')))).toList(),
                onChanged: (value) => setState(() => _frequency = value ?? _frequency),
              ),
              field('tenure', t.x('pkg.tenure')),
              field('perInstalment', t.x('pkg.instalment')),
              field('penaltyRate', t.x('pkg.penalty')),
              if (widget.package != null)
                DropdownButtonFormField<String>(
                  initialValue: _status,
                  decoration: InputDecoration(labelText: t.x('pkg.status')),
                  items: [
                    DropdownMenuItem(value: 'active', child: Text(t.x('pkg.active'))),
                    DropdownMenuItem(value: 'inactive', child: Text(t.x('pkg.inactive'))),
                  ],
                  onChanged: (value) => setState(() => _status = value ?? _status),
                ),
              if (_error != null) Text(_error!, style: const TextStyle(color: AppColors.danger)),
              if (_saving) const LinearProgressIndicator(),
              const SizedBox(height: 12),
              FilledButton(onPressed: _saving ? null : _save, child: Text(t.x('common.save'))),
            ],
          ),
        ),
      ),
    );
  }
}

class _SettingsDetailScreenState extends ConsumerState<SettingsDetailScreen> {
  bool _loading = true;
  String _error = '';
  final _textController1 = TextEditingController();
  final _textController2 = TextEditingController();
  final _textController3 = TextEditingController();
  final _textController4 = TextEditingController();
  final _textController5 = TextEditingController();
  final _textController6 = TextEditingController();
  bool _boolVal1 = false;
  bool _showSecret = false;
  List<LoanPackage> _packages = [];

  bool get _canManagePackages {
    final role = ref.read(authControllerProvider).user?.role;
    return role == UserRole.admin || role == UserRole.superadmin || role == UserRole.developer;
  }

  @override
  void initState() {
    super.initState();
    _fetchSettings();
  }

  @override
  void dispose() {
    _textController1.dispose();
    _textController2.dispose();
    _textController3.dispose();
    _textController4.dispose();
    _textController5.dispose();
    _textController6.dispose();
    super.dispose();
  }

  Future<void> _fetchSettings() async {
    setState(() => _loading = true);
    try {
      if (widget.type == 'packages') {
        final packages = await ref.read(settingsServiceProvider)
            .packages(includeInactive: _canManagePackages);
        if (!mounted) return;
        setState(() {
          _packages = packages;
          _loading = false;
        });
        return;
      }

      final rows = await ref.read(settingsServiceProvider).all();
      final map = {
        for (final r in rows)
          if (r['key'] is String)
            r['key'] as String: (r['value'] ?? '').toString(),
      };

      if (widget.type == 'bulk') {
        _boolVal1 = map['bulk_collection_allowed'] == 'true';
        _textController1.text = map['bulk_limit_per_agent'] ?? '50';
      } else if (widget.type == 'bureau') {
        _textController1.text = map['bureau_member_id'] ?? '';
        _textController2.text = map['bureau_api_key'] ?? '';
        _boolVal1 = map['bureau_pulls_enabled'] == 'true';
      } else if (widget.type == 'npa') {
        _textController1.text = map['npa_threshold_days'] ?? '90';
        _textController2.text = map['npa_penalty_rate'] ?? '2.0';
      } else if (widget.type == 'security') {
        _boolVal1 = map['biometric_lock_required'] == 'true';
        _textController1.text = map['session_timeout_minutes'] ?? '15';
      } else if (widget.type == 'branding') {
        _textController1.text = map['app_tagline'] ?? '';
        _textController2.text = map['logo_url'] ?? '';
        _textController3.text = map['primary_color'] ?? '#F5A623';
        _textController4.text = map['primary_dark'] ?? '#E8930C';
        _textController5.text = map['customer_code_prefix'] ?? 'CUS';
        _textController6.text = map['loan_code_prefix'] ?? 'LN';
      }

      setState(() {
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _saveSettings() async {
    setState(() => _loading = true);
    try {
      final patch = <String, dynamic>{};
      if (widget.type == 'bulk') {
        patch['bulk_collection_allowed'] = _boolVal1.toString();
        patch['bulk_limit_per_agent'] = _textController1.text.trim();
      } else if (widget.type == 'bureau') {
        patch['bureau_member_id'] = _textController1.text.trim();
        patch['bureau_api_key'] = _textController2.text.trim();
        patch['bureau_pulls_enabled'] = _boolVal1.toString();
      } else if (widget.type == 'npa') {
        patch['npa_threshold_days'] = _textController1.text.trim();
        patch['npa_penalty_rate'] = _textController2.text.trim();
      } else if (widget.type == 'security') {
        patch['biometric_lock_required'] = _boolVal1.toString();
        patch['session_timeout_minutes'] = _textController1.text.trim();
      } else if (widget.type == 'branding') {
        patch['app_tagline'] = _textController1.text.trim();
        patch['logo_url'] = _textController2.text.trim();
        patch['primary_color'] = _textController3.text.trim();
        patch['primary_dark'] = _textController4.text.trim();
        patch['customer_code_prefix'] = _textController5.text.trim();
        patch['loan_code_prefix'] = _textController6.text.trim();
      }

      await ref.read(settingsServiceProvider).save(patch);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Settings saved successfully')),
      );
      await _fetchSettings();
    } catch (e) {
      setState(() => _loading = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Save failed: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(widget.title),
        centerTitle: true,
        actions: widget.type == 'packages' && _canManagePackages
            ? [IconButton(
                tooltip: T.of(ref).x('pkg.create'),
                icon: const Icon(Icons.add),
                onPressed: () => _showPackageEditor(),
              )]
            : null,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/settings'),
        ),
      ),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error.isNotEmpty
                ? Center(
                    child: Text(
                      'Error: $_error',
                      style: const TextStyle(color: AppColors.danger),
                    ),
                  )
                : Padding(
                    padding: const EdgeInsets.all(16),
                    child: _buildFormContent(),
                  ),
      ),
    );
  }

  Widget _buildFormContent() {
    if (widget.type == 'packages') {
      return _buildPackagesList();
    }

    return ListView(
      children: [
        if (widget.type == 'bulk') ...[
          SwitchListTile(
            title: const Text('Allow Bulk Collection Runs'),
            subtitle: const Text(
              'Enables mCollect batch sheet generation for offline agents',
            ),
            value: _boolVal1,
            onChanged: (v) => setState(() => _boolVal1 = v),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _textController1,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Max Collections per run per agent',
              border: OutlineInputBorder(),
            ),
          ),
        ],
        if (widget.type == 'bureau') ...[
          SwitchListTile(
            title: const Text('Enable CRIF Bureau Pulls'),
            subtitle: const Text(
              'Allow agents to request credit checks on new registrations',
            ),
            value: _boolVal1,
            onChanged: (v) => setState(() => _boolVal1 = v),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _textController1,
            decoration: const InputDecoration(
              labelText: 'CRIF Bureau Member ID *',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _textController2,
            obscureText: !_showSecret,
            decoration: InputDecoration(
              labelText: 'Bureau API Key / Secret *',
              border: const OutlineInputBorder(),
              suffixIcon: IconButton(
                tooltip: _showSecret ? 'Hide secret' : 'Show secret',
                icon: Icon(_showSecret ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                onPressed: () => setState(() => _showSecret = !_showSecret),
              ),
            ),
          ),
        ],
        if (widget.type == 'npa') ...[
          TextField(
            controller: _textController1,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'NPA Threshold (Days Overdue) *',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _textController2,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              labelText: 'Default NPA Penalty Rate (% per day) *',
              border: OutlineInputBorder(),
            ),
          ),
        ],
        if (widget.type == 'security') ...[
          ListTile(
            leading: const Icon(Icons.security_outlined),
            title: Text(T.of(ref).x('2fa.title')),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(context, MaterialPageRoute<void>(
              builder: (_) => const TwoFactorScreen(),
            )),
          ),
          SwitchListTile(
            title: const Text('Require Biometric Unlock'),
            subtitle: const Text(
              'Prompts FaceID/Fingerprint on resuming app session',
            ),
            value: _boolVal1,
            onChanged: (v) => setState(() => _boolVal1 = v),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _textController1,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Inactivity Timeout (Minutes) *',
              border: OutlineInputBorder(),
            ),
          ),
        ],
        if (widget.type == 'branding') ...[
          TextField(
            controller: _textController1,
            decoration: const InputDecoration(
              labelText: 'App Tagline',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _textController2,
            decoration: const InputDecoration(
              labelText: 'Logo URL',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _textController3,
                  decoration: const InputDecoration(
                    labelText: 'Primary Color',
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _textController4,
                  decoration: const InputDecoration(
                    labelText: 'Primary Dark',
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _textController5,
                  decoration: const InputDecoration(
                    labelText: 'Customer Prefix',
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _textController6,
                  decoration: const InputDecoration(
                    labelText: 'Loan Prefix',
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
            ],
          ),
        ],
        const SizedBox(height: 24),
        AppButton(
          label: 'Save Configuration',
          onPressed: _saveSettings,
        ),
      ],
    );
  }

  Widget _buildPackagesList() {
    if (_packages.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            T.of(ref).x('pkg.empty'),
            style: AppTypography.body.copyWith(color: AppColors.textLight),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    return ListView.builder(
      itemCount: _packages.length,
      itemBuilder: (context, index) {
        final p = _packages[index];
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppTokens.radius),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                p.name,
                style: AppTypography.nameLg.copyWith(
                  fontSize: 16,
                  color: AppColors.primary,
                ),
              ),
              Text('${T.of(ref).x('pkg.status')}: ${T.of(ref).x('pkg.${p.status}')}'),
              Text('${T.of(ref).x('pkg.deduction_type')}: ${T.of(ref).x('pkg.${p.deductionType}')}'),
              if (_canManagePackages)
                Row(children: [
                  TextButton(
                    onPressed: () => _showPackageEditor(p),
                    child: Text(T.of(ref).x('pkg.edit')),
                  ),
                  TextButton(
                    onPressed: () => _deletePackage(p),
                    child: Text(T.of(ref).x('pkg.delete')),
                  ),
                ]),
              const Divider(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Tenure: ${p.tenure} ${_frequencyUnit(p.frequency)}',
                    style: AppTypography.caption,
                  ),
                  Text(
                    'Penalty: ${p.penaltyRate.toStringAsFixed(2)}%',
                    style: AppTypography.caption,
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Principal: ${_money(p.principal)} | Instalment: ${_money(p.perInstalment)}',
                style: AppTypography.caption,
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _showPackageEditor([LoanPackage? package]) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PackageEditor(package: package),
    );
    if (saved == true) await _fetchSettings();
  }

  Future<void> _deletePackage(LoanPackage package) async {
    final t = T.of(ref);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(t.x('pkg.delete')),
        content: Text(t.x('pkg.delete_confirm')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false), child: Text(t.x('common.cancel'))),
          TextButton(onPressed: () => Navigator.pop(dialog, true), child: Text(t.x('pkg.delete'))),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(settingsServiceProvider).deletePackage(package.id);
      await _fetchSettings();
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  String _frequencyUnit(String frequency) {
    switch (frequency.toLowerCase()) {
      case 'daily':
        return 'days';
      case 'weekly':
        return 'weeks';
      case 'monthly':
        return 'months';
      default:
        return frequency;
    }
  }

  String _money(double value) {
    final whole = value == value.roundToDouble();
    return 'Rs ${whole ? value.toStringAsFixed(0) : value.toStringAsFixed(2)}';
  }
}
