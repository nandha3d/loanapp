import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/approval.dart';
import 'package:loantrack/data/services/approval_service.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

final _approvalsProvider = FutureProvider.autoDispose<List<Approval>>((ref) {
  return ref.watch(approvalServiceProvider).list(status: 'pending');
});

class ApprovalsScreen extends ConsumerWidget {
  const ApprovalsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_approvalsProvider);
    final t = T.of(ref);

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: Text(t.x('title.approvals')),
          centerTitle: true,
          bottom: TabBar(
            indicatorColor: AppColors.primary,
            indicatorWeight: 3,
            labelColor: AppColors.primary,
            unselectedLabelColor: AppColors.textSecondary,
            labelStyle: AppTypography.label,
            tabs: [
              Tab(text: t.x('tab.customers')),
              Tab(text: t.x('tab.loans')),
              Tab(text: t.x('tab.general')),
            ],
          ),
        ),
        body: async.when(
          loading: () => const _LoadingState(),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.cloud_off, size: 48, color: AppColors.textLight),
                  const SizedBox(height: 12),
                  Text(t.x('err.failed_to_load'), style: AppTypography.sectionTitle),
                  const SizedBox(height: 6),
                  Text(e.toString(), style: AppTypography.body, textAlign: TextAlign.center),
                ],
              ),
            ),
          ),
          data: (list) {
            final customers = list.where((a) => a.entityType == 'customer').toList();
            final loans = list.where((a) => a.entityType == 'loan').toList();
            final other = list
                .where((a) => a.entityType != 'customer' && a.entityType != 'loan')
                .toList();
            void refresh() => ref.invalidate(_approvalsProvider);
            return TabBarView(
              children: [
                _ApprovalList(approvals: customers, emptyTitle: t.x('appr.no_customer_pending'), subtitle: t.x('appr.all_caught_up'), onRefresh: refresh),
                _ApprovalList(approvals: loans, emptyTitle: t.x('appr.no_loan_pending'), subtitle: t.x('appr.all_caught_up'), onRefresh: refresh),
                _ApprovalList(approvals: other, emptyTitle: t.x('appr.no_general_pending'), subtitle: t.x('appr.all_caught_up'), onRefresh: refresh),
              ],
            );
          },
        ),
        bottomNavigationBar: const AppBottomNav(currentRoute: '/approvals'),
      ),
    );
  }
}

class _ApprovalList extends StatelessWidget {
  const _ApprovalList({
    required this.approvals,
    required this.emptyTitle,
    required this.subtitle,
    required this.onRefresh,
  });
  final List<Approval> approvals;
  final String emptyTitle;
  final String subtitle;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    if (approvals.isEmpty) {
      return EmptyState(
        icon: Icons.task_alt_outlined,
        title: emptyTitle,
        subtitle: subtitle,
      );
    }
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async => onRefresh(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: approvals.length,
        itemBuilder: (_, i) => _ApprovalCard(approval: approvals[i], onAction: onRefresh),
      ),
    );
  }
}

class _ApprovalCard extends ConsumerWidget {
  const _ApprovalCard({required this.approval, required this.onAction});
  final Approval approval;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fmt = DateFormat('dd MMM yyyy, hh:mm a');
    final t = T.of(ref);

    String entityLabel;
    if (approval.entityType == 'customer') {
      entityLabel = t.x('ent.customer');
    } else if (approval.entityType == 'loan') {
      entityLabel = t.x('ent.loan');
    } else if (approval.entityType == 'branch_request') {
      entityLabel = t.x('ent.branch');
    } else {
      entityLabel = t.x('ent.general');
    }

    String actionLabel;
    if (approval.action == 'create') {
      actionLabel = t.x('act.new');
    } else if (approval.action == 'update') {
      actionLabel = t.x('act.edit');
    } else if (approval.action == 'delete') {
      actionLabel = t.x('act.delete');
    } else {
      actionLabel = approval.action;
    }

    IconData entityIcon;
    Color entityColor;
    Color entityBg;
    if (approval.entityType == 'customer') {
      entityIcon = Icons.person_outline;
      entityColor = AppColors.info;
      entityBg = AppColors.infoBg;
    } else if (approval.entityType == 'loan') {
      entityIcon = Icons.account_balance_wallet_outlined;
      entityColor = AppColors.primary;
      entityBg = AppColors.primaryLight;
    } else {
      entityIcon = Icons.description_outlined;
      entityColor = AppColors.purple;
      entityBg = AppColors.purpleBg;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: entityBg,
                    borderRadius: BorderRadius.circular(AppTokens.radiusKpiIcon),
                  ),
                  child: Icon(entityIcon, color: entityColor, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          _Tag(label: entityLabel, color: entityColor, bg: entityBg),
                          const SizedBox(width: 6),
                          _Tag(label: actionLabel, color: AppColors.textSecondary, bg: AppColors.background),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text('${t.x('appr.by')} ${approval.requestedByName}', style: AppTypography.bodyLarge),
                      const SizedBox(height: 2),
                      Text(fmt.format(approval.createdAt), style: AppTypography.caption),
                      if (approval.reviewNote != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          approval.reviewNote!,
                          style: AppTypography.body.copyWith(color: AppColors.textSecondary),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.border),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.close, size: 16),
                    label: Text(t.x('btn.reject')),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.danger,
                      side: const BorderSide(color: AppColors.danger),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                      ),
                    ),
                    onPressed: () => _handleAction(context, ref, false),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.check, size: 16, color: Colors.white),
                    label: Text(t.x('btn.approve'), style: const TextStyle(color: Colors.white)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.success,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                      ),
                    ),
                    onPressed: () => _handleAction(context, ref, true),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _handleAction(BuildContext context, WidgetRef ref, bool approve) async {
    final t = T.of(ref);
    final noteCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTokens.radius)),
        title: Text(approve ? t.x('appr.approve_request') : t.x('appr.reject_request')),
        content: TextField(
          controller: noteCtrl,
          decoration: InputDecoration(
            labelText: t.x('appr.note_optional'),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppTokens.radiusSm)),
          ),
          maxLines: 2,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(t.x('common.cancel'))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: approve ? AppColors.success : AppColors.danger,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTokens.radiusSm)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(approve ? t.x('btn.approve') : t.x('btn.reject'), style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (ok == true && context.mounted) {
      final note = noteCtrl.text.trim().isEmpty ? null : noteCtrl.text.trim();
      final svc = ref.read(approvalServiceProvider);
      if (approve) {
        await svc.approve(approval.id, note: note);
      } else {
        await svc.reject(approval.id, note: note);
      }
      onAction();
    }
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label, required this.color, required this.bg});
  final String label;
  final Color color, bg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(4)),
      child: Text(label, style: AppTypography.tiny.copyWith(color: color)),
    );
  }
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(16),
        children: List.generate(
          4,
          (_) => const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: Skeleton(height: 150, borderRadius: AppTokens.radius),
          ),
        ),
      );
}
