import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class TeamManagementScreen extends ConsumerStatefulWidget {
  const TeamManagementScreen({super.key, this.isSuperadmin = false});
  final bool isSuperadmin;

  @override
  ConsumerState<TeamManagementScreen> createState() => _TeamManagementScreenState();
}

class _TeamManagementScreenState extends ConsumerState<TeamManagementScreen> {
  final List<Map<String, dynamic>> _dummyUsers = [
    {'id': '1', 'name': 'Ravi Kumar', 'role': 'agent', 'phone': '+91 98765 43210', 'status': 'active', 'branch': 'Erode Main'},
    {'id': '2', 'name': 'Karthik S', 'role': 'agent', 'phone': '+91 99887 76655', 'status': 'active', 'branch': 'Erode Main'},
    {'id': '3', 'name': 'Anitha J', 'role': 'admin', 'phone': '+91 91234 56789', 'status': 'active', 'branch': 'Salem Branch'},
    {'id': '4', 'name': 'Vijay Chandar', 'role': 'agent', 'phone': '+91 98989 89898', 'status': 'suspended', 'branch': 'Salem Branch'},
  ];

  String _searchQuery = '';
  String _roleFilter = 'all';

  @override
  Widget build(BuildContext context) {
    final filtered = _dummyUsers.where((u) {
      final name = (u['name'] as String).toLowerCase();
      final phone = u['phone'] as String;
      final branch = (u['branch'] as String).toLowerCase();
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
      ),
      body: SafeArea(
        child: Column(
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
                                  u['role'] == 'admin' ? Icons.admin_panel_settings : Icons.person,
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
                                        Text(u['name'] as String, style: AppTypography.nameLg.copyWith(fontSize: 15)),
                                        const SizedBox(width: 6),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: isSuspended ? AppColors.dangerBg : AppColors.successBg,
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                          child: Text(
                                            (u['status'] as String).toUpperCase(),
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
                                    Text('${u['role'].toUpperCase()} · ${u['phone']}', style: AppTypography.caption),
                                    Text('Branch: ${u['branch']}', style: AppTypography.caption),
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
        onPressed: () => _showCreateUserForm(context),
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
                onTap: () {
                  setState(() {
                    user['status'] = isSuspended ? 'active' : 'suspended';
                  });
                  Navigator.pop(context);
                },
              ),
              ListTile(
                leading: const Icon(Icons.edit_outlined, color: AppColors.primary),
                title: const Text('Edit User Information'),
                onTap: () {
                  Navigator.pop(context);
                  // Edit form
                },
              ),
              ListTile(
                leading: const Icon(Icons.lock_reset_outlined, color: AppColors.warning),
                title: const Text('Reset Password'),
                onTap: () {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Password reset instructions sent')),
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showCreateUserForm(BuildContext context) {
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
              Text('Add Team Member', style: AppTypography.sectionTitle),
              const SizedBox(height: 16),
              const TextField(
                decoration: InputDecoration(labelText: 'Full Name *', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              const TextField(
                decoration: InputDecoration(labelText: 'Phone Number *', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              const TextField(
                decoration: InputDecoration(labelText: 'Username *', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              const TextField(
                obscureText: true,
                decoration: InputDecoration(labelText: 'Password *', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 16),
              AppButton(
                label: 'Create Member',
                onPressed: () {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('New team member created successfully')),
                  );
                },
              ),
            ],
          ),
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
