import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class BranchManagementScreen extends ConsumerStatefulWidget {
  const BranchManagementScreen({super.key});

  @override
  ConsumerState<BranchManagementScreen> createState() => _BranchManagementScreenState();
}

class _BranchManagementScreenState extends ConsumerState<BranchManagementScreen> {
  final List<Map<String, dynamic>> _dummyBranches = [
    {'id': '1', 'name': 'Erode Head Office', 'manager': 'Anitha J', 'customers': 114, 'loans': 98, 'status': 'active'},
    {'id': '2', 'name': ' Salem Branch', 'manager': 'Vijay Chandar', 'customers': 45, 'loans': 38, 'status': 'active'},
    {'id': '3', 'name': 'Coimbatore Hub', 'manager': 'Not Assigned', 'customers': 0, 'loans': 0, 'status': 'inactive'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Branch Management'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: _dummyBranches.length,
          itemBuilder: (context, index) {
            final b = _dummyBranches[index];
            final isActive = (b['status'] as String) == 'active';
            return Container(
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
                        Text(b['name'] as String, style: AppTypography.nameLg.copyWith(fontSize: 16)),
                        const SizedBox(height: 4),
                        Text('Manager: ${b['manager']}', style: AppTypography.caption),
                        const SizedBox(height: 2),
                        Text(
                          'Active Customers: ${b['customers']} · Active Loans: ${b['loans']}',
                          style: AppTypography.caption.copyWith(fontSize: 11),
                        ),
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
                      (b['status'] as String).toUpperCase(),
                      style: AppTypography.tiny.copyWith(
                        color: isActive ? AppColors.success : AppColors.textSecondary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddBranchSheet(context),
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  void _showAddBranchSheet(BuildContext context) {
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
              Text('Add New Branch', style: AppTypography.sectionTitle),
              const SizedBox(height: 16),
              const TextField(
                decoration: InputDecoration(labelText: 'Branch Name *', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              const TextField(
                decoration: InputDecoration(labelText: 'Branch Manager Username', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 16),
              AppButton(
                label: 'Create Branch',
                onPressed: () {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Branch added successfully')),
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
