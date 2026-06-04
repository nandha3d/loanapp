import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/services/admin_service.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class BranchManagementScreen extends ConsumerStatefulWidget {
  const BranchManagementScreen({super.key});

  @override
  ConsumerState<BranchManagementScreen> createState() => _BranchManagementScreenState();
}

class _BranchManagementScreenState extends ConsumerState<BranchManagementScreen> {
  List<Map<String, dynamic>> _branches = [];
  bool _isLoading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _fetchBranches();
  }

  Future<void> _fetchBranches() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });
    try {
      final list = await ref.read(adminServiceProvider).listBranches();
      setState(() {
        _branches = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Branch Management'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchBranches,
          ),
        ],
      ),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _error.isNotEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('Error: $_error', style: const TextStyle(color: AppColors.danger)),
                          const SizedBox(height: 16),
                          AppButton(label: 'Retry', onPressed: _fetchBranches),
                        ],
                      ),
                    ),
                  )
                : _branches.isEmpty
                    ? const Center(child: Text('No branches found.'))
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _branches.length,
                        itemBuilder: (context, index) {
                          final b = _branches[index];
                          final status = b['status'] as String? ?? 'active';
                          final isActive = status == 'active';
                          final code = b['code'] as String? ?? '';
                          return InkWell(
                            onTap: () => _showBranchActions(context, b),
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: AppColors.surface,
                                borderRadius: BorderRadius.circular(AppTokens.radius),
                                boxShadow: AppTokens.shadow,
                                border: Border.all(color: AppColors.border, width: 1),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 44,
                                    height: 44,
                                    decoration: BoxDecoration(
                                      color: isActive ? AppColors.primaryLight : AppColors.border,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Icon(
                                      Icons.storefront_outlined,
                                      color: isActive ? AppColors.primaryDark : AppColors.textLight,
                                    ),
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(b['name'] as String? ?? 'Salem Branch', style: AppTypography.nameLg.copyWith(fontSize: 16)),
                                        const SizedBox(height: 4),
                                        Text('Code: $code', style: AppTypography.caption),
                                        if (b['phone'] != null) Text('Phone: ${b['phone']}', style: AppTypography.caption),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: isActive ? AppColors.successBg : AppColors.border,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      status.toUpperCase(),
                                      style: AppTypography.tiny.copyWith(
                                        color: isActive ? AppColors.success : AppColors.textSecondary,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showBranchForm(context),
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  void _showBranchActions(BuildContext context, Map<String, dynamic> branch) {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        final isActive = branch['status'] == 'active';
        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Manage ${branch['name']}',
                style: AppTypography.sectionTitle,
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: Icon(isActive ? Icons.pause_outlined : Icons.play_arrow_outlined, color: isActive ? AppColors.danger : AppColors.success),
                title: Text(isActive ? 'Suspend Branch' : 'Activate Branch'),
                onTap: () async {
                  final messenger = ScaffoldMessenger.of(this.context);
                  Navigator.pop(context);
                  setState(() => _isLoading = true);
                  try {
                    await ref.read(adminServiceProvider).updateBranch(
                          branch['id'] as String,
                          name: branch['name'] as String,
                          code: branch['code'] as String,
                          phone: branch['phone'] as String?,
                          status: isActive ? 'inactive' : 'active',
                        );
                    await _fetchBranches();
                  } catch (e) {
                    setState(() => _isLoading = false);
                    if (!mounted) return;
                    messenger.showSnackBar(
                      SnackBar(content: Text('Failed: $e')),
                    );
                  }
                },
              ),
              ListTile(
                leading: const Icon(Icons.edit_outlined, color: AppColors.primary),
                title: const Text('Edit Branch Info'),
                onTap: () {
                  Navigator.pop(context);
                  _showBranchForm(context, branch);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showBranchForm(BuildContext context, [Map<String, dynamic>? existingBranch]) {
    final isEdit = existingBranch != null;
    final nameController = TextEditingController(text: existingBranch?['name'] as String?);
    final codeController = TextEditingController(text: existingBranch?['code'] as String?);
    final phoneController = TextEditingController(text: existingBranch?['phone'] as String?);

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(isEdit ? 'Edit Branch' : 'Add New Branch', style: AppTypography.sectionTitle),
              const SizedBox(height: 16),
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: 'Branch Name *', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: codeController,
                decoration: const InputDecoration(labelText: 'Branch Code *', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Phone Number', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 16),
              AppButton(
                label: isEdit ? 'Save Changes' : 'Create Branch',
                onPressed: () async {
                  final name = nameController.text.trim();
                  final code = codeController.text.trim();
                  final phone = phoneController.text.trim();

                  if (name.isEmpty || code.isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Please fill name and code')),
                    );
                    return;
                  }

                  final messenger = ScaffoldMessenger.of(this.context);
                  Navigator.pop(context);
                  setState(() => _isLoading = true);

                  try {
                    if (isEdit) {
                      await ref.read(adminServiceProvider).updateBranch(
                            existingBranch['id'] as String,
                            name: name,
                            code: code,
                            phone: phone.isNotEmpty ? phone : null,
                            status: existingBranch['status'] as String?,
                          );
                    } else {
                      await ref.read(adminServiceProvider).createBranch(
                            name: name,
                            code: code,
                            phone: phone.isNotEmpty ? phone : null,
                          );
                    }
                    await _fetchBranches();
                    if (!mounted) return;
                    messenger.showSnackBar(
                      SnackBar(content: Text(isEdit ? 'Branch updated successfully' : 'Branch added successfully')),
                    );
                  } catch (e) {
                    setState(() => _isLoading = false);
                    if (!mounted) return;
                    messenger.showSnackBar(
                      SnackBar(content: Text('Failed: $e')),
                    );
                  }
                },
              ),
            ],
          ),
        );
      },
    );
  }
}
