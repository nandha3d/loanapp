import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/approval.dart';
import 'package:loantrack/data/services/approval_service.dart';
import 'package:loantrack/shared/widgets/app_button.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';

final _approvalsProvider = FutureProvider.autoDispose<List<Approval>>((ref) async {
  return ref.watch(approvalServiceProvider).list(status: 'pending');
});

class ApprovalsScreen extends ConsumerStatefulWidget {
  const ApprovalsScreen({super.key});

  @override
  ConsumerState<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends ConsumerState<ApprovalsScreen> {
  String _tab = 'loan';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_approvalsProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Approvals'),
        centerTitle: true,
        actions: [
          async.maybeWhen(
            data: (list) => _CountBadge(count: list.length),
            orElse: () => const SizedBox.shrink(),
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e', style: AppTypography.body)),
        data: (list) {
          final loans = list.where((a) => a.entityType == 'loan').toList();
          final customers = list.where((a) => a.entityType == 'customer').toList();
          final branch = list.where((a) =>
              a.entityType == 'branch_request' || a.entityType == 'other').toList();
          final filtered = switch (_tab) {
            'loan' => loans,
            'customer' => customers,
            _ => branch,
          };
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: _TabBar(
                  current: _tab,
                  loanCount: loans.length,
                  customerCount: customers.length,
                  branchCount: branch.length,
                  onChange: (t) => setState(() => _tab = t),
                ),
              ),
              Expanded(
                child: filtered.isEmpty
                    ? const EmptyState(
                        icon: Icons.fact_check_outlined,
                        title: 'Nothing pending',
                        subtitle: 'You\'re all caught up.',
                      )
                    : RefreshIndicator(
                        color: AppColors.primary,
                        onRefresh: () async =>
                            ref.invalidate(_approvalsProvider),
                        child: ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (_, i) => _ApprovalCard(
                            approval: filtered[i],
                            onAction: (approved, note) => _act(
                              filtered[i],
                              approved: approved,
                              note: note,
                            ),
                          ),
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _act(Approval a, {required bool approved, String? note}) async {
    final svc = ref.read(approvalServiceProvider);
    try {
      if (approved) {
        await svc.approve(a.id, note: note);
      } else {
        await svc.reject(a.id, note: note);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(approved ? 'Approved' : 'Rejected')),
      );
      ref.invalidate(_approvalsProvider);
    } on Object catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$e')));
    }
  }
}

class _CountBadge extends StatelessWidget {
  const _CountBadge({required this.count});
  final int count;
  @override
  Widget build(BuildContext context) {
    if (count <= 0) return const SizedBox.shrink();
    return Container(
      width: 22,
      height: 22,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        color: AppColors.danger,
        shape: BoxShape.circle,
      ),
      child: Text(
        '$count',
        style: AppTypography.tiny.copyWith(color: Colors.white),
      ),
    );
  }
}

class _TabBar extends StatelessWidget {
  const _TabBar({
    required this.current,
    required this.loanCount,
    required this.customerCount,
    required this.branchCount,
    required this.onChange,
  });

  final String current;
  final int loanCount;
  final int customerCount;
  final int branchCount;
  final ValueChanged<String> onChange;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.background,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppTokens.radius - 2),
      ),
      child: Row(
        children: [
          _tab('Loans ($loanCount)', 'loan'),
          _tab('Customers ($customerCount)', 'customer'),
          _tab('Branch ($branchCount)', 'branch'),
        ],
      ),
    );
  }

  Widget _tab(String label, String key) {
    final active = key == current;
    return Expanded(
      child: InkWell(
        onTap: () => onChange(key),
        borderRadius: BorderRadius.circular(AppTokens.radiusTab),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 7),
          decoration: BoxDecoration(
            color: active ? AppColors.surface : Colors.transparent,
            borderRadius: BorderRadius.circular(AppTokens.radiusTab),
            border: active ? Border.all(color: AppColors.border) : null,
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: AppTypography.label.copyWith(
              color: active ? AppColors.primaryDark : AppColors.textSecondary,
              fontSize: 14 * 0.85,
            ),
          ),
        ),
      ),
    );
  }
}

class _ApprovalCard extends StatelessWidget {
  const _ApprovalCard({required this.approval, required this.onAction});
  final Approval approval;
  final void Function(bool approved, String? note) onAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  approval.entityType.toUpperCase(),
                  style: AppTypography.extraTiny.copyWith(
                    color: AppColors.primaryDark,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const Spacer(),
              Text(
                DateFormat('MMM d').format(approval.createdAt),
                style: AppTypography.extraTiny,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            approval.action.toUpperCase(),
            style: AppTypography.bodyLarge.copyWith(fontSize: 14 * 0.9),
          ),
          const SizedBox(height: 2),
          Text(
            'ID: ${approval.id}',
            style: AppTypography.extraTiny.copyWith(
              fontFamily: 'monospace',
              color: AppColors.textLight,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Requested by ${approval.requestedByName}',
            style: AppTypography.bodySmall.copyWith(
              color: AppColors.textLight,
              fontStyle: FontStyle.italic,
            ),
          ),
          const SizedBox(height: 14),
          const Divider(height: 1, color: AppColors.border),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: 'Reject',
                  variant: AppButtonVariant.secondary,
                  expand: true,
                  onPressed: () => _confirm(context, approved: false),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: AppButton(
                  label: 'Approve',
                  expand: true,
                  onPressed: () => _confirm(context, approved: true),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _confirm(BuildContext context, {required bool approved}) async {
    final ctrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(approved ? 'Approve?' : 'Reject?'),
        content: TextField(
          controller: ctrl,
          maxLines: 3,
          decoration: const InputDecoration(
            hintText: 'Add a note (optional)',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor:
                  approved ? AppColors.primary : AppColors.danger,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(context, true),
            child: Text(approved ? 'Approve' : 'Reject'),
          ),
        ],
      ),
    );
    if (ok == true) {
      onAction(approved, ctrl.text.trim().isEmpty ? null : ctrl.text.trim());
    }
  }
}
