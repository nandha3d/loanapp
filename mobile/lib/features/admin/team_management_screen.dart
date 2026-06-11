import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/services/admin_service.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class TeamManagementScreen extends ConsumerStatefulWidget {
  const TeamManagementScreen({super.key, this.isSuperadmin = false});
  final bool isSuperadmin;

  @override
  ConsumerState<TeamManagementScreen> createState() => _TeamManagementScreenState();
}

class _TeamManagementScreenState extends ConsumerState<TeamManagementScreen> {
  List<Map<String, dynamic>> _users = [];
  List<Map<String, dynamic>> _branches = [];
  bool _isLoading = true;
  String _error = '';

  String _searchQuery = '';
  String _roleFilter = 'all';

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });
    try {
      final adminService = ref.read(adminServiceProvider);
      final users = await adminService.listUsers();
      final branches = await adminService.listBranches();
      setState(() {
        _users = users;
        _branches = branches;
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
    final filtered = _users.where((u) {
      final name = (u['name'] as String? ?? '').toLowerCase();
      final phone = (u['phone'] as String? ?? '');
      final branch = (u['branch'] as String? ?? '').toLowerCase();
      final query = _searchQuery.toLowerCase();
      
      final matchesSearch = name.contains(query) ||
          phone.contains(_searchQuery) ||
          branch.contains(query);
      final matchesRole = _roleFilter == 'all' || u['role'] == _roleFilter;
      return matchesSearch && matchesRole;
    }).toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(widget.isSuperadmin ? 'User Management' : 'Team / Agents'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchData,
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
                          Text('Error loading team: $_error', style: const TextStyle(color: AppColors.danger)),
                          const SizedBox(height: 16),
                          AppButton(label: 'Retry', onPressed: _fetchData),
                        ],
                      ),
                    ),
                  )
                : Column(
                    children: [
                      // Search and Filters
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          children: [
                            TextField(
                              onChanged: (val) => setState(() => _searchQuery = val),
                              decoration: InputDecoration(
                                hintText: 'Search by name, phone, branch...',
                                prefixIcon: const Icon(Icons.search),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(color: AppColors.border),
                                ),
                                filled: true,
                                fillColor: AppColors.surface,
                              ),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                _FilterChip(
                                  label: 'All Roles',
                                  selected: _roleFilter == 'all',
                                  onSelected: () => setState(() => _roleFilter = 'all'),
                                ),
                                const SizedBox(width: 8),
                                _FilterChip(
                                  label: 'Agents',
                                  selected: _roleFilter == 'agent',
                                  onSelected: () => setState(() => _roleFilter = 'agent'),
                                ),
                                const SizedBox(width: 8),
                                _FilterChip(
                                  label: 'Admins',
                                  selected: _roleFilter == 'admin',
                                  onSelected: () => setState(() => _roleFilter = 'admin'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),

                      // User List
                      Expanded(
                        child: filtered.isEmpty
                            ? const Center(child: Text('No team members found.'))
                            : ListView.builder(
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                itemCount: filtered.length,
                                itemBuilder: (context, index) {
                                  final u = filtered[index];
                                  final isSuspended = u['status'] == 'suspended';
                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 12),
                                    padding: const EdgeInsets.all(14),
                                    decoration: BoxDecoration(
                                      color: AppColors.surface,
                                      borderRadius: BorderRadius.circular(AppTokens.radius),
                                      boxShadow: AppTokens.shadow,
                                      border: Border.all(color: AppColors.border, width: 1),
                                    ),
                                    child: Row(
                                      children: [
                                        CircleAvatar(
                                          backgroundColor: isSuspended ? AppColors.dangerBg : AppColors.primaryLight,
                                          child: Icon(
                                            u['role'] == 'admin' || u['role'] == 'superadmin' ? Icons.admin_panel_settings : Icons.person,
                                            color: isSuspended ? AppColors.danger : AppColors.primaryDark,
                                          ),
                                        ),
                                        const SizedBox(width: 14),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Expanded(
                                                    child: Text(u['name'] as String? ?? 'N/A', style: AppTypography.nameLg.copyWith(fontSize: 15)),
                                                  ),
                                                  const SizedBox(width: 6),
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                    decoration: BoxDecoration(
                                                      color: isSuspended ? AppColors.dangerBg : AppColors.successBg,
                                                      borderRadius: BorderRadius.circular(10),
                                                    ),
                                                    child: Text(
                                                      (u['status'] as String? ?? 'active').toUpperCase(),
                                                      style: AppTypography.tiny.copyWith(
                                                        color: isSuspended ? AppColors.danger : AppColors.success,
                                                        fontSize: 9,
                                                        fontWeight: FontWeight.bold,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 4),
                                              Text('${(u['role'] as String? ?? '').toUpperCase()} · ${u['phone'] ?? u['email'] ?? ''}', style: AppTypography.caption),
                                              if (u['branch'] != null) Text('Branch: ${u['branch']}', style: AppTypography.caption),
                                            ],
                                          ),
                                        ),
                                        IconButton(
                                          icon: const Icon(Icons.more_vert_rounded),
                                          onPressed: () => _showUserActions(context, u),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                      ),
                    ],
                  ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showUserForm(context),
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  void _showUserActions(BuildContext context, Map<String, dynamic> user) {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        final isSuspended = user['status'] == 'suspended';
        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Manage ${user['name']}',
                style: AppTypography.sectionTitle,
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: Icon(isSuspended ? Icons.play_arrow_outlined : Icons.pause_outlined, color: isSuspended ? AppColors.success : AppColors.danger),
                title: Text(isSuspended ? 'Activate User' : 'Suspend User'),
                onTap: () async {
                  final messenger = ScaffoldMessenger.of(this.context);
                  Navigator.pop(context);
                  setState(() => _isLoading = true);
                  try {
                    await ref.read(adminServiceProvider).toggleUserStatus(
                          user['id'] as String,
                          isSuspended ? 'active' : 'suspended',
                        );
                    await _fetchData();
                  } catch (e) {
                    setState(() => _isLoading = false);
                    if (!mounted) return;
                    messenger.showSnackBar(
                      SnackBar(content: Text('Failed to update status: $e')),
                    );
                  }
                },
              ),
              ListTile(
                leading: Icon(Icons.edit_outlined, color: AppColors.primary),
                title: const Text('Edit User Information'),
                onTap: () {
                  Navigator.pop(context);
                  _showUserForm(context, user);
                },
              ),
              ListTile(
                leading: const Icon(Icons.lock_reset_outlined, color: AppColors.warning),
                title: const Text('Reset Password'),
                onTap: () {
                  Navigator.pop(context);
                  _showResetPasswordDialog(context, user);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showResetPasswordDialog(BuildContext context, Map<String, dynamic> user) {
    final passwordController = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text('Reset Password for ${user['name']}'),
          content: TextField(
            controller: passwordController,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'New Password *',
              border: OutlineInputBorder(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () async {
                final pw = passwordController.text.trim();
                if (pw.isEmpty) return;
                final messenger = ScaffoldMessenger.of(this.context);
                Navigator.pop(context);
                setState(() => _isLoading = true);
                try {
                  await ref.read(adminServiceProvider).updateUser(
                        user['id'] as String,
                        name: user['name'] as String,
                        username: user['username'] as String,
                        phone: user['phone'] as String? ?? '',
                        password: pw,
                        role: user['role'] as String,
                        branchId: user['branchId'] as String?,
                        status: user['status'] as String?,
                      );
                  await _fetchData();
                  if (!mounted) return;
                  messenger.showSnackBar(
                    const SnackBar(content: Text('Password updated successfully')),
                  );
                } catch (e) {
                  setState(() => _isLoading = false);
                  if (!mounted) return;
                  messenger.showSnackBar(
                    SnackBar(content: Text('Failed to update password: $e')),
                  );
                }
              },
              child: const Text('Reset'),
            ),
          ],
        );
      },
    );
  }

  void _showUserForm(BuildContext context, [Map<String, dynamic>? existingUser]) {
    final isEdit = existingUser != null;
    final nameController = TextEditingController(text: existingUser?['name'] as String?);
    final phoneController = TextEditingController(text: existingUser?['phone'] as String?);
    final usernameController = TextEditingController(text: existingUser?['username'] as String?);
    final passwordController = TextEditingController();
    
    String selectedRole = existingUser?['role'] as String? ?? 'agent';
    String? selectedBranchId = existingUser?['branchId'] as String?;

    // Validate that selectedBranchId exists in list, otherwise default to first or null
    if (selectedBranchId != null && !_branches.any((b) => b['id'] == selectedBranchId)) {
      selectedBranchId = null;
    }

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(isEdit ? 'Edit Team Member' : 'Add Team Member', style: AppTypography.sectionTitle),
                  const SizedBox(height: 16),
                  TextField(
                    controller: nameController,
                    decoration: const InputDecoration(labelText: 'Full Name *', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: phoneController,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(labelText: 'Phone Number *', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: usernameController,
                    decoration: const InputDecoration(labelText: 'Username *', border: OutlineInputBorder()),
                  ),
                  if (!isEdit) ...[
                    const SizedBox(height: 12),
                    TextField(
                      controller: passwordController,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: 'Password *', border: OutlineInputBorder()),
                    ),
                  ],
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: selectedRole,
                    decoration: const InputDecoration(labelText: 'Role', border: OutlineInputBorder()),
                    items: [
                      const DropdownMenuItem(value: 'agent', child: Text('Agent')),
                      const DropdownMenuItem(value: 'admin', child: Text('Admin')),
                      if (widget.isSuperadmin)
                        const DropdownMenuItem(value: 'superadmin', child: Text('Superadmin')),
                    ],
                    onChanged: (val) {
                      if (val != null) {
                        setModalState(() => selectedRole = val);
                      }
                    },
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String?>(
                    initialValue: selectedBranchId,
                    decoration: const InputDecoration(labelText: 'Branch', border: OutlineInputBorder()),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('None (Cross-branch)')),
                      ..._branches.map((b) => DropdownMenuItem(
                            value: b['id'] as String,
                            child: Text(b['name'] as String),
                          ),),
                    ],
                    onChanged: (val) {
                      setModalState(() => selectedBranchId = val);
                    },
                  ),
                  const SizedBox(height: 16),
                  AppButton(
                    label: isEdit ? 'Save Changes' : 'Create Member',
                    onPressed: () async {
                      final name = nameController.text.trim();
                      final phone = phoneController.text.trim();
                      final username = usernameController.text.trim();
                      final password = passwordController.text.trim();

                      if (name.isEmpty || phone.isEmpty || username.isEmpty || (!isEdit && password.isEmpty)) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Please fill all mandatory fields')),
                        );
                        return;
                      }

                      final messenger = ScaffoldMessenger.of(this.context);
                      Navigator.pop(context);
                      setState(() => _isLoading = true);

                      try {
                        if (isEdit) {
                          await ref.read(adminServiceProvider).updateUser(
                                existingUser['id'] as String,
                                name: name,
                                username: username,
                                phone: phone,
                                role: selectedRole,
                                branchId: selectedBranchId,
                              );
                        } else {
                          await ref.read(adminServiceProvider).createUser(
                                name: name,
                                username: username,
                                phone: phone,
                                password: password,
                                role: selectedRole,
                                branchId: selectedBranchId,
                              );
                        }
                        await _fetchData();
                        if (!mounted) return;
                        messenger.showSnackBar(
                          SnackBar(content: Text(isEdit ? 'Team member updated successfully' : 'New team member created successfully')),
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
      },
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.selected, required this.onSelected});
  final String label;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onSelected,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? AppColors.primary : AppColors.border),
        ),
        child: Text(
          label,
          style: AppTypography.caption.copyWith(
            color: selected ? Colors.white : AppColors.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}
