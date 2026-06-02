import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/services/kyc_service.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

class KycReviewScreen extends ConsumerWidget {
  const KycReviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(kycQueueProvider);
    final t = T.of(ref);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('kyc.title')),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop() ? context.pop() : context.go('/dashboard'),
        ),
      ),
      body: async.when(
        loading: () => ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: 5,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, __) => const Skeleton(height: 84, borderRadius: 12),
        ),
        error: (e, _) => EmptyState(
          icon: Icons.cloud_off,
          title: t.x('err.failed_to_load'),
          subtitle: e.toString(),
        ),
        data: (items) => items.isEmpty
            ? EmptyState(
                icon: Icons.verified_user_outlined,
                title: t.x('kyc.empty_title'),
                subtitle: t.x('kyc.empty_sub'),
              )
            : RefreshIndicator(
                color: AppColors.primary,
                onRefresh: () async => ref.invalidate(kycQueueProvider),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _KycCard(item: items[i]),
                ),
              ),
      ),
    );
  }
}

class _KycCard extends ConsumerStatefulWidget {
  const _KycCard({required this.item});
  final KycQueueItem item;

  @override
  ConsumerState<_KycCard> createState() => _KycCardState();
}

class _KycCardState extends ConsumerState<_KycCard> {
  bool _busy = false;

  Future<void> _review(String decision) async {
    final t = T.of(ref);
    String? reason;
    if (decision == 'rejected') {
      reason = await _askReason();
      if (reason == null) return; // cancelled
    }
    setState(() => _busy = true);
    try {
      await ref.read(kycServiceProvider).review(widget.item.id, decision, reason: reason);
      if (!mounted) return;
      ref.invalidate(kycQueueProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(decision == 'verified' ? t.x('kyc.verified_msg') : t.x('kyc.rejected_msg')),
          backgroundColor: decision == 'verified' ? AppColors.success : AppColors.danger,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  Future<String?> _askReason() async {
    final t = T.of(ref);
    final ctrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(t.x('kyc.reject_title')),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          maxLines: 3,
          decoration: InputDecoration(hintText: t.x('kyc.reason_hint')),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(t.x('common.cancel'))),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () {
              if (ctrl.text.trim().isEmpty) return;
              Navigator.pop(ctx, ctrl.text.trim());
            },
            child: Text(t.x('kyc.reject_btn')),
          ),
        ],
      ),
    );
    ctrl.dispose();
    return reason;
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final item = widget.item;
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => context.push('/customers/${item.id}'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.name, style: AppTypography.bodyLarge.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(
                        '${item.customerCode} · ${item.kycStatus}'
                        '${item.kycMethod != null ? ' · ${item.kycMethod}' : ''}',
                        style: AppTypography.caption,
                      ),
                    ],
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.warningBg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text('${item.docCount} ${t.x('kyc.docs')}',
                    style: AppTypography.tiny.copyWith(color: AppColors.warning),),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (_busy)
            const Center(child: Padding(padding: EdgeInsets.all(6), child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))))
          else
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _review('rejected'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.danger,
                      side: const BorderSide(color: AppColors.danger),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    child: Text(t.x('kyc.reject_btn')),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed: () => _review('verified'),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.success,
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    child: Text(t.x('kyc.verify_btn')),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
