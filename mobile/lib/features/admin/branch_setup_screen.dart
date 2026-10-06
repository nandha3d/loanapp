import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/services/admin_service.dart';
import 'package:zolofund/shared/widgets/app_button.dart';

/// Branch creation for the business owner (superadmin). The plan decides how
/// many branches can exist and which modules a branch may enable; both come
/// from `GET /api/v1/admin/branches/capacity` and are only rendered here
/// (STABLE-8). Replaces the old "Branch Requests" page.
class BranchSetupScreen extends ConsumerStatefulWidget {
  const BranchSetupScreen({super.key});

  @override
  ConsumerState<BranchSetupScreen> createState() => _BranchSetupScreenState();
}

class _BranchSetupScreenState extends ConsumerState<BranchSetupScreen> {
  bool _loading = true;
  String _error = '';
  List<Map<String, dynamic>> _branches = [];
  Map<String, dynamic> _capacity = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final service = ref.read(adminServiceProvider);
      final results = await Future.wait<Object>([
        service.listBranches(),
        service.branchCapacity(),
      ]);
      if (!mounted) return;
      setState(() {
        _branches = results[0] as List<Map<String, dynamic>>;
        _capacity = results[1] as Map<String, dynamic>;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  bool get _canCreate => _capacity['canCreate'] == true;

  List<Map<String, dynamic>> get _planModules =>
      (_capacity['planModules'] as List<dynamic>? ?? const <dynamic>[])
          .map((dynamic e) => Map<String, dynamic>.from(e as Map))
          .toList();

  Future<void> _openForm([Map<String, dynamic>? branch]) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => BranchFormScreen(
          branch: branch,
          planModules: _planModules,
        ),
      ),
    );
    if (saved == true) await _load();
  }

  Future<void> _toggleStatus(Map<String, dynamic> branch) async {
    final isActive = branch['status'] == 'active';
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(adminServiceProvider).updateBranch(
            branch['id'] as String,
            name: branch['name'] as String,
            code: (branch['code'] as String?) ?? '',
            phone: branch['phone'] as String?,
            address: branch['address'] as String?,
            status: isActive ? 'inactive' : 'active',
          );
      await _load();
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  void _showActions(Map<String, dynamic> branch) {
    final t = T.of(ref);
    final isActive = branch['status'] == 'active';
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(branch['name'] as String? ?? '',
                  style: AppTypography.sectionTitle),
              const SizedBox(height: 8),
              ListTile(
                leading: Icon(Icons.edit_outlined, color: AppColors.primary),
                title: Text(t.x('br.edit_title')),
                onTap: () {
                  Navigator.pop(ctx);
                  _openForm(branch);
                },
              ),
              ListTile(
                leading: Icon(
                  isActive ? Icons.pause_circle_outline : Icons.play_circle_outline,
                  color: isActive ? AppColors.danger : AppColors.success,
                ),
                title: Text(t.x(isActive ? 'br.suspend' : 'br.activate')),
                onTap: () {
                  Navigator.pop(ctx);
                  _toggleStatus(branch);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('br.title')),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
      floatingActionButton: !_loading && _error.isEmpty && _canCreate
          ? FloatingActionButton.extended(
              onPressed: () => _openForm(),
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.onPrimary,
              icon: const Icon(Icons.add_business_outlined),
              label: Text(t.x('br.add')),
            )
          : null,
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error.isNotEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _error,
                            textAlign: TextAlign.center,
                            style: TextStyle(color: AppColors.danger),
                          ),
                          const SizedBox(height: 16),
                          AppButton(label: 'Retry', onPressed: _load),
                        ],
                      ),
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                      children: [
                        _CapacityCard(capacity: _capacity, t: t),
                        const SizedBox(height: 16),
                        if (_branches.isEmpty)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 32),
                            child: Center(
                              child: Text(t.x('br.empty'),
                                  style: AppTypography.caption),
                            ),
                          )
                        else
                          for (final b in _branches) ...[
                            _BranchCard(
                              branch: b,
                              planModules: _planModules,
                              t: t,
                              onTap: () => _showActions(b),
                            ),
                            const SizedBox(height: 12),
                          ],
                      ],
                    ),
                  ),
      ),
    );
  }
}

class _CapacityCard extends StatelessWidget {
  const _CapacityCard({required this.capacity, required this.t});

  final Map<String, dynamic> capacity;
  final T t;

  @override
  Widget build(BuildContext context) {
    final used = (capacity['activeBranches'] as num?)?.toInt() ?? 0;
    final max = (capacity['maxBranches'] as num?)?.toInt() ?? 0;
    final unlimited = capacity['unlimited'] == true;
    final canCreate = capacity['canCreate'] == true;
    final remaining = (capacity['remaining'] as num?)?.toInt();
    final plan = capacity['planLabel'] as String?;
    final progress = (!unlimited && max > 0) ? (used / max).clamp(0.0, 1.0) : 0.0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        border: Border.all(
          color: canCreate ? AppColors.border : AppColors.warning,
        ),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.storefront_outlined, color: AppColors.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  unlimited
                      ? t.x('br.used_unlimited').replaceAll('{used}', '$used')
                      : t
                          .x('br.plan_usage')
                          .replaceAll('{used}', '$used')
                          .replaceAll('{max}', '$max'),
                  style: AppTypography.bodyLarge,
                ),
              ),
              if (plan != null)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(AppTokens.radiusBadge),
                  ),
                  child: Text(
                    plan,
                    style: AppTypography.tiny.copyWith(
                      color: AppColors.primaryDark,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          if (!unlimited) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 8,
                backgroundColor: AppColors.border,
                color: canCreate ? AppColors.primary : AppColors.warning,
              ),
            ),
          ],
          if (canCreate && remaining != null) ...[
            const SizedBox(height: 8),
            Text(
              t.x('br.remaining').replaceAll('{n}', '$remaining'),
              style: AppTypography.caption,
            ),
          ],
          if (!canCreate) ...[
            const SizedBox(height: 12),
            Text(
              t.x('br.limit_reached'),
              style: AppTypography.caption.copyWith(
                color: AppColors.textPrimary,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 12),
            AppButton(
              label: t.x('sub.upgrade_cta'),
              leading: const Icon(Icons.workspace_premium_outlined),
              onPressed: () => context.push('/microlending/subscription'),
              expand: true,
            ),
          ],
        ],
      ),
    );
  }
}

class _BranchCard extends StatelessWidget {
  const _BranchCard({
    required this.branch,
    required this.planModules,
    required this.t,
    required this.onTap,
  });

  final Map<String, dynamic> branch;
  final List<Map<String, dynamic>> planModules;
  final T t;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isActive = branch['status'] == 'active';
    final code = (branch['code'] as String?) ?? '';
    final phone = (branch['phone'] as String?) ?? '';
    final address = (branch['address'] as String?) ?? '';
    final modules = _moduleKeys(branch['enabledModules']);
    String label(String key) => (planModules
            .firstWhere((m) => m['key'] == key,
                orElse: () => <String, dynamic>{'label': key})['label']
        as String);

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppTokens.radius),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTokens.radius),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTokens.radius),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      branch['name'] as String? ?? '',
                      style: AppTypography.nameLg,
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: isActive ? AppColors.successBg : AppColors.border,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      t.x(isActive ? 'br.active' : 'br.suspended'),
                      style: AppTypography.tiny.copyWith(
                        color: isActive
                            ? AppColors.successText
                            : AppColors.textSecondary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
              if (code.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text('${t.x('br.code')}: $code', style: AppTypography.caption),
              ],
              if (phone.isNotEmpty)
                _line(Icons.phone_outlined, phone),
              if (address.isNotEmpty)
                _line(Icons.location_on_outlined, address),
              if (modules.isNotEmpty) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final m in modules)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.infoBg,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          label(m),
                          style: AppTypography.tiny
                              .copyWith(color: AppColors.infoText),
                        ),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _line(IconData icon, String text) => Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 14, color: AppColors.textSecondary),
            const SizedBox(width: 6),
            Expanded(child: Text(text, style: AppTypography.caption)),
          ],
        ),
      );
}

/// `Branch.enabledModules` arrives as a JSON string (or a list).
List<String> _moduleKeys(Object? raw) {
  Object? value = raw;
  if (value is String) {
    try {
      value = jsonDecode(value);
    } catch (_) {
      value = value.toString().split(',');
    }
  }
  if (value is! List) return const [];
  return value.map((dynamic e) => '$e'.trim()).where((e) => e.isNotEmpty).toList();
}

/// Full-page create / edit form. Pops `true` when something was saved.
class BranchFormScreen extends ConsumerStatefulWidget {
  const BranchFormScreen({super.key, this.branch, required this.planModules});

  final Map<String, dynamic>? branch;
  final List<Map<String, dynamic>> planModules;

  @override
  ConsumerState<BranchFormScreen> createState() => _BranchFormScreenState();
}

class _BranchFormScreenState extends ConsumerState<BranchFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _code;
  late final TextEditingController _phone;
  late final TextEditingController _address;
  late final Set<String> _modules;
  bool _saving = false;
  bool _moduleError = false;

  bool get _isEdit => widget.branch != null;

  @override
  void initState() {
    super.initState();
    final b = widget.branch;
    _name = TextEditingController(text: b?['name'] as String?);
    _code = TextEditingController(text: b?['code'] as String?);
    _phone = TextEditingController(text: b?['phone'] as String?);
    _address = TextEditingController(text: b?['address'] as String?);
    final planKeys = widget.planModules.map((m) => m['key'] as String).toSet();
    // New branch: everything on the plan is on. Edit: what the branch has now.
    _modules = b == null
        ? {...planKeys}
        : _moduleKeys(b['enabledModules']).where(planKeys.contains).toSet();
  }

  @override
  void dispose() {
    _name.dispose();
    _code.dispose();
    _phone.dispose();
    _address.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final t = T.of(ref);
    final formOk = _formKey.currentState!.validate();
    final modulesOk = _modules.isNotEmpty;
    setState(() => _moduleError = !modulesOk);
    if (!formOk || !modulesOk) return;

    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final service = ref.read(adminServiceProvider);
    final name = _name.text.trim();
    final code = _code.text.trim();
    final phone = _phone.text.trim();
    final address = _address.text.trim();
    // Keep the plan's order so the stored list is stable.
    final modules = [
      for (final m in widget.planModules)
        if (_modules.contains(m['key'])) m['key'] as String,
    ];
    try {
      if (_isEdit) {
        await service.updateBranch(
          widget.branch!['id'] as String,
          name: name,
          code: code,
          phone: phone,
          address: address,
          enabledModules: modules,
          status: widget.branch!['status'] as String?,
        );
      } else {
        await service.createBranch(
          name: name,
          code: code,
          phone: phone.isEmpty ? null : phone,
          address: address.isEmpty ? null : address,
          enabledModules: modules,
        );
      }
      messenger.showSnackBar(
        SnackBar(content: Text(t.x(_isEdit ? 'br.updated' : 'br.created'))),
      );
      navigator.pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      messenger.showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x(_isEdit ? 'br.edit_title' : 'br.new_title')),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            children: [
              TextFormField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(labelText: '${t.x('br.name')} *'),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? t.x('br.err_name') : null,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _code,
                textCapitalization: TextCapitalization.characters,
                textInputAction: TextInputAction.next,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9_-]')),
                ],
                decoration: InputDecoration(
                  labelText: '${t.x('br.code')} *',
                  helperText: t.x('br.code_hint'),
                ),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? t.x('br.err_code') : null,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.next,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9+ ]')),
                ],
                decoration: InputDecoration(labelText: t.x('br.phone')),
                validator: (v) {
                  final digits = (v ?? '').replaceAll(RegExp(r'\D'), '');
                  if (digits.isEmpty) return null;
                  return (digits.length < 7 || digits.length > 15)
                      ? t.x('br.err_phone')
                      : null;
                },
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _address,
                minLines: 2,
                maxLines: 4,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(labelText: t.x('br.address')),
              ),
              const SizedBox(height: 20),
              Text(t.x('br.modules'), style: AppTypography.sectionTitle),
              const SizedBox(height: 4),
              Text(t.x('br.modules_hint'), style: AppTypography.caption),
              const SizedBox(height: 8),
              if (widget.planModules.isEmpty)
                Text(t.x('br.no_modules'), style: AppTypography.caption)
              else
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                    border: Border.all(
                      color: _moduleError ? AppColors.danger : AppColors.border,
                    ),
                  ),
                  child: Column(
                    children: [
                      for (final m in widget.planModules)
                        CheckboxListTile(
                          value: _modules.contains(m['key']),
                          activeColor: AppColors.primary,
                          title: Text(m['label'] as String),
                          onChanged: _saving
                              ? null
                              : (v) => setState(() {
                                    if (v == true) {
                                      _modules.add(m['key'] as String);
                                    } else {
                                      _modules.remove(m['key']);
                                    }
                                    _moduleError = false;
                                  }),
                        ),
                    ],
                  ),
                ),
              if (_moduleError)
                Padding(
                  padding: const EdgeInsets.only(top: 6, left: 4),
                  child: Text(
                    t.x('br.err_module'),
                    style: AppTypography.caption.copyWith(color: AppColors.danger),
                  ),
                ),
              const SizedBox(height: 24),
              AppButton(
                label: t.x(_isEdit ? 'br.save_btn' : 'br.create_btn'),
                loading: _saving,
                onPressed: _saving ? null : _submit,
                expand: true,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
