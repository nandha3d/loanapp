import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/services/chit_service.dart';
import 'package:loantrack/data/services/customer_service.dart';

/// Reusable chit group form used by both create and edit screens.
class ChitGroupFormScreen extends ConsumerStatefulWidget {
  const ChitGroupFormScreen({super.key, this.editData});

  /// When non-null, we are editing an existing group.
  final Map<String, dynamic>? editData;

  @override
  ConsumerState<ChitGroupFormScreen> createState() =>
      _ChitGroupFormScreenState();
}

class _ChitGroupFormScreenState extends ConsumerState<ChitGroupFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameCtrl;
  late final TextEditingController _chitValueCtrl;
  late final TextEditingController _monthlyCtrl;
  late final TextEditingController _totalMembersCtrl;
  late final TextEditingController _commissionCtrl;
  DateTime? _startDate;
  List<_SelectedMember> _members = [];
  bool _loading = false;
  String? _error;

  bool get _isEdit => widget.editData != null;

  @override
  void initState() {
    super.initState();
    final d = widget.editData;
    _nameCtrl = TextEditingController(text: d?['name'] as String? ?? '');
    _chitValueCtrl = TextEditingController(
        text: d?['chitValue'] != null
            ? (d!['chitValue'] as num).toStringAsFixed(0)
            : '');
    _monthlyCtrl = TextEditingController(
        text: d?['monthlyContrib'] != null
            ? (d!['monthlyContrib'] as num).toStringAsFixed(0)
            : '');
    _totalMembersCtrl = TextEditingController(
        text: d?['totalMembers']?.toString() ?? '5');
    _commissionCtrl = TextEditingController(
        text: d?['commissionPct']?.toString() ?? '5');
    if (d?['startDate'] != null) {
      _startDate = DateTime.tryParse(d!['startDate'] as String);
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _chitValueCtrl.dispose();
    _monthlyCtrl.dispose();
    _totalMembersCtrl.dispose();
    _commissionCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickStartDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _startDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (picked != null) setState(() => _startDate = picked);
  }

  void _addMember() async {
    // Show a simple search dialog to pick a customer
    final result = await showDialog<_SelectedMember>(
      context: context,
      builder: (_) => const _CustomerPickerDialog(),
    );
    if (result != null) {
      final maxMembers = int.tryParse(_totalMembersCtrl.text) ?? 100;
      if (_members.length >= maxMembers) return;
      if (_members.any((m) => m.id == result.id)) return;
      setState(() => _members = [..._members, result]);
    }
  }

  void _removeMember(int idx) {
    setState(() {
      final list = List<_SelectedMember>.from(_members);
      list.removeAt(idx);
      _members = list;
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final svc = ref.read(chitServiceProvider);
      if (_isEdit) {
        await svc.update(
          widget.editData!['id'] as String,
          name: _nameCtrl.text.trim(),
          chitValue: double.tryParse(_chitValueCtrl.text),
          monthlyContrib: double.tryParse(_monthlyCtrl.text),
          totalMembers: int.tryParse(_totalMembersCtrl.text),
          commissionPct: double.tryParse(_commissionCtrl.text),
          startDate: _startDate?.toIso8601String().split('T').first,
        );
      } else {
        await svc.create(
          name: _nameCtrl.text.trim(),
          chitValue: double.tryParse(_chitValueCtrl.text) ?? 0,
          monthlyContrib: double.tryParse(_monthlyCtrl.text) ?? 0,
          totalMembers: int.tryParse(_totalMembersCtrl.text) ?? 5,
          commissionPct: double.tryParse(_commissionCtrl.text) ?? 5,
          startDate:
              (_startDate ?? DateTime.now()).toIso8601String().split('T').first,
          memberIds: _members.map((m) => m.id).toList(),
        );
      }
      if (mounted) context.pop();
    } catch (e) {
      setState(() => _error = e.toString());
    }
    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final maxMembers = int.tryParse(_totalMembersCtrl.text) ?? 100;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_isEdit ? 'Edit Chit Group' : t.x('ch.create_group')),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_error != null)
                Container(
                  padding: const EdgeInsets.all(10),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: AppColors.dangerBg,
                    borderRadius: BorderRadius.circular(AppTokens.radius),
                  ),
                  child: Text(_error!,
                      style: AppTypography.caption
                          .copyWith(color: AppColors.danger)),
                ),
              // Group Name
              TextFormField(
                controller: _nameCtrl,
                decoration: const InputDecoration(
                  labelText: 'Group Name *',
                  hintText: 'e.g. January 2026 Group',
                ),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 16),
              // Chit Value + Monthly
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _chitValueCtrl,
                      decoration: const InputDecoration(
                          labelText: 'Chit Value *'),
                      keyboardType: TextInputType.number,
                      validator: (v) =>
                          (double.tryParse(v ?? '') ?? 0) <= 0
                              ? 'Required'
                              : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _monthlyCtrl,
                      decoration: const InputDecoration(
                          labelText: 'Monthly Contribution *'),
                      keyboardType: TextInputType.number,
                      validator: (v) =>
                          (double.tryParse(v ?? '') ?? 0) <= 0
                              ? 'Required'
                              : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              // Total Members + Commission
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _totalMembersCtrl,
                      decoration:
                          const InputDecoration(labelText: 'Total Members *'),
                      keyboardType: TextInputType.number,
                      onChanged: (_) => setState(() {}),
                      validator: (v) =>
                          (int.tryParse(v ?? '') ?? 0) < 2
                              ? 'Min 2'
                              : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _commissionCtrl,
                      decoration:
                          const InputDecoration(labelText: 'Commission % *'),
                      keyboardType: TextInputType.number,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              // Start Date
              GestureDetector(
                onTap: _pickStartDate,
                child: InputDecorator(
                  decoration:
                      const InputDecoration(labelText: 'Start Date *'),
                  child: Text(
                    _startDate != null
                        ? '${_startDate!.year}-${_startDate!.month.toString().padLeft(2, '0')}-${_startDate!.day.toString().padLeft(2, '0')}'
                        : 'Tap to select',
                    style: AppTypography.body.copyWith(
                      color: _startDate != null
                          ? AppColors.textPrimary
                          : AppColors.textSecondary,
                    ),
                  ),
                ),
              ),
              if (!_isEdit) ...[
                const SizedBox(height: 24),
                // Members section
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                        'Members (${_members.length}/$maxMembers)',
                        style: AppTypography.sectionTitle),
                    TextButton.icon(
                      onPressed:
                          _members.length >= maxMembers ? null : _addMember,
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('Add'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (_members.isEmpty)
                  Text('Click Add to select members',
                      style: AppTypography.caption),
                ..._members.asMap().entries.map((e) {
                  final idx = e.key;
                  final m = e.value;
                  return ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(
                      radius: 14,
                      backgroundColor: AppColors.primaryLight,
                      child: Text('${idx + 1}',
                          style: AppTypography.caption
                              .copyWith(color: AppColors.primary)),
                    ),
                    title: Text(m.name, style: AppTypography.body),
                    subtitle:
                        Text(m.code, style: AppTypography.caption),
                    trailing: IconButton(
                      icon: const Icon(Icons.close,
                          size: 16, color: AppColors.danger),
                      onPressed: () => _removeMember(idx),
                    ),
                  );
                }),
              ],
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _loading ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppTokens.radius),
                    ),
                  ),
                  child: Text(_loading
                      ? 'Saving…'
                      : _isEdit
                          ? 'Update Group'
                          : t.x('ch.create_group')),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SelectedMember {
  const _SelectedMember({required this.id, required this.name, required this.code});
  final String id, name, code;
}

/// Simple customer search dialog for member selection.
class _CustomerPickerDialog extends ConsumerStatefulWidget {
  const _CustomerPickerDialog();

  @override
  ConsumerState<_CustomerPickerDialog> createState() =>
      _CustomerPickerDialogState();
}

class _CustomerPickerDialogState extends ConsumerState<_CustomerPickerDialog> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Select Customer'),
      content: SizedBox(
        width: double.maxFinite,
        height: 400,
        child: Column(
          children: [
            TextField(
              decoration: const InputDecoration(
                hintText: 'Search customers…',
                prefixIcon: Icon(Icons.search, size: 20),
                isDense: true,
              ),
              onChanged: (v) => setState(() => _query = v.toLowerCase()),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: FutureBuilder<List<dynamic>>(
                future: _fetchCustomers(),
                builder: (ctx, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final all = snap.data ?? [];
                  final filtered = _query.isEmpty
                      ? all
                      : all.where((dynamic c) {
                          final name =
                              ((c as Map)['name'] as String? ?? '').toLowerCase();
                          final code =
                              (c['customerCode'] as String? ?? '').toLowerCase();
                          return name.contains(_query) ||
                              code.contains(_query);
                        }).toList();
                  return ListView.builder(
                    itemCount: filtered.length,
                    itemBuilder: (_, i) {
                      final c = filtered[i] as Map<String, dynamic>;
                      return ListTile(
                        dense: true,
                        title: Text(c['name'] as String? ?? ''),
                        subtitle:
                            Text(c['customerCode'] as String? ?? ''),
                        onTap: () => Navigator.pop(
                          context,
                          _SelectedMember(
                            id: c['id'] as String,
                            name: c['name'] as String? ?? '',
                            code: c['customerCode'] as String? ?? '',
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<List<dynamic>> _fetchCustomers() async {
    try {
      final svc = ref.read(customerServiceProvider);
      final result = await svc.list();
      return result.map((c) => {
            'id': c.id,
            'name': c.name,
            'customerCode': c.customerCode,
          }).toList();
    } catch (_) {
      return [];
    }
  }
}
