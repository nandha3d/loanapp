import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/chit.dart';
import 'package:loantrack/data/services/chit_service.dart';
import 'package:loantrack/shared/widgets/app_badge.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';

final _membersProvider =
    FutureProvider.autoDispose.family<List<ChitMember>, String>(
  (ref, id) => ref.watch(chitServiceProvider).members(id),
);
final _auctionsProvider =
    FutureProvider.autoDispose.family<List<ChitAuction>, String>(
  (ref, id) => ref.watch(chitServiceProvider).auctions(id),
);

class ChitDetailScreen extends ConsumerStatefulWidget {
  const ChitDetailScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<ChitDetailScreen> createState() => _ChitDetailScreenState();
}

class _ChitDetailScreenState extends ConsumerState<ChitDetailScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 3, vsync: this);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Chit Group'),
        centerTitle: true,
        bottom: TabBar(
          controller: _tabs,
          labelColor: AppColors.primaryDark,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary,
          tabs: const [
            Tab(text: 'Members'),
            Tab(text: 'Auctions'),
            Tab(text: 'Subscriptions'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _MembersTab(id: widget.id),
          _AuctionsTab(id: widget.id),
          const _SubscriptionsStub(),
        ],
      ),
    );
  }
}

class _MembersTab extends ConsumerWidget {
  const _MembersTab({required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_membersProvider(id));
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('$e')),
      data: (list) => list.isEmpty
          ? const EmptyState(icon: Icons.people_outline, title: 'No members')
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final m = list[i];
                return Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppTokens.radius),
                    boxShadow: AppTokens.shadow,
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: AppColors.primary,
                        radius: 18,
                        child: Text(
                          '${m.memberNumber}',
                          style: AppTypography.bodySmall
                              .copyWith(color: Colors.white),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(m.customerName,
                                style: AppTypography.bodyLarge),
                            Text(m.customerCode,
                                style: AppTypography.extraTiny),
                          ],
                        ),
                      ),
                      if (m.hasWon)
                        const AppBadge(label: 'won', kind: BadgeKind.active),
                    ],
                  ),
                );
              },
            ),
    );
  }
}

class _AuctionsTab extends ConsumerWidget {
  const _AuctionsTab({required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_auctionsProvider(id));
    final money =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final df = DateFormat('MMM d, y');
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('$e')),
      data: (list) => list.isEmpty
          ? const EmptyState(icon: Icons.gavel_outlined, title: 'No auctions')
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final a = list[i];
                return Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppTokens.radius),
                    boxShadow: AppTokens.shadow,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text('Cycle #${a.periodNumber}',
                              style: AppTypography.bodyLarge),
                          const Spacer(),
                          AppBadge(
                            label: a.status,
                            kind: a.status == 'completed'
                                ? BadgeKind.active
                                : BadgeKind.pending,
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      if (a.winnerName != null)
                        Text('Winner: ${a.winnerName}',
                            style: AppTypography.bodySmall),
                      if (a.prizeAmount != null)
                        Text('Prize: ${money.format(a.prizeAmount)}',
                            style: AppTypography.bodySmall),
                      if (a.dividend != null)
                        Text('Dividend: ${money.format(a.dividend)}',
                            style: AppTypography.caption),
                      if (a.auctionDate != null)
                        Text(df.format(a.auctionDate!),
                            style: AppTypography.extraTiny),
                    ],
                  ),
                );
              },
            ),
    );
  }
}

class _SubscriptionsStub extends StatelessWidget {
  const _SubscriptionsStub();
  @override
  Widget build(BuildContext context) {
    return const EmptyState(
      icon: Icons.subscriptions_outlined,
      title: 'Monthly Subscriptions',
      subtitle: 'Subscription tracking lives on the chit detail server route — open the web app for full history.',
    );
  }
}
