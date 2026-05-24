import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/chit.dart';
import 'package:loantrack/data/services/chit_service.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

final _chitGroupsProvider = FutureProvider.autoDispose<List<ChitGroup>>((ref) {
  return ref.watch(chitServiceProvider).list();
});

final _chitFilterProvider = StateProvider.autoDispose<String>((ref) => 'all');

class ChitsScreen extends ConsumerWidget {
  const ChitsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groups = ref.watch(_chitGroupsProvider);
    final filter = ref.watch(_chitFilterProvider);
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Chit Funds'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(_chitGroupsProvider),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: groups.when(
        loading: () => const _LoadingSkeleton(),
        error: (e, _) => _ErrorView(message: e.toString()),
        data: (all) {
          final filtered = filter == 'all'
              ? all
              : all.where((g) => g.status == filter).toList(growable: false);

          final activeCount = all.where((g) => g.status == 'active').length;
          final totalValue = all.fold<double>(0, (s, g) => s + g.chitValue);

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async => ref.invalidate(_chitGroupsProvider),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _KpiRow(
                  total: all.length,
                  active: activeCount,
                  totalValue: totalValue,
                  fmt: fmt,
                ),
                const SizedBox(height: 16),
                _FilterBar(selected: filter),
                const SizedBox(height: 12),
                if (filtered.isEmpty)
                  SizedBox(
                    height: 200,
                    child: EmptyState(
                      icon: Icons.savings_outlined,
                      title: filter == 'all'
                          ? 'No chit groups'
                          : 'No $filter groups',
                    ),
                  )
                else
                  ...filtered.map((g) => _GroupCard(group: g, fmt: fmt)),
              ],
            ),
          );
        },
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/chits'),
    );
  }
}

class _KpiRow extends StatelessWidget {
  const _KpiRow({
    required this.total,
    required this.active,
    required this.totalValue,
    required this.fmt,
  });
  final int total, active;
  final double totalValue;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _KpiChip(value: '$total', label: 'Total Groups', color: AppColors.info)),
        const SizedBox(width: 10),
        Expanded(child: _KpiChip(value: '$active', label: 'Active', color: AppColors.success)),
        const SizedBox(width: 10),
        Expanded(
          child: _KpiChip(
            value: fmt.format(totalValue),
            label: 'Total Value',
            color: AppColors.primary,
          ),
        ),
      ],
    );
  }
}

class _KpiChip extends StatelessWidget {
  const _KpiChip({required this.value, required this.label, required this.color});
  final String value, label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: AppTypography.sectionTitle.copyWith(color: color)),
          const SizedBox(height: 2),
          Text(label, style: AppTypography.caption),
        ],
      ),
    );
  }
}

class _FilterBar extends ConsumerWidget {
  const _FilterBar({required this.selected});
  final String selected;

  static const _filters = <_FilterOption>[
    _FilterOption('all', 'All'),
    _FilterOption('active', 'Active'),
    _FilterOption('completed', 'Completed'),
    _FilterOption('cancelled', 'Cancelled'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: _filters.map((f) {
          final isActive = selected == f.key;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => ref.read(_chitFilterProvider.notifier).state = f.key,
              child: AnimatedContainer(
                duration: AppTokens.transition,
                curve: AppTokens.transitionCurve,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(
                  color: isActive ? AppColors.primary : AppColors.surface,
                  borderRadius: BorderRadius.circular(AppTokens.radiusBadge),
                  border: Border.all(
                    color: isActive ? AppColors.primary : AppColors.border,
                  ),
                ),
                child: Text(
                  f.label,
                  style: AppTypography.label.copyWith(
                    color: isActive ? Colors.white : AppColors.textSecondary,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _FilterOption {
  const _FilterOption(this.key, this.label);
  final String key, label;
}

class _GroupCard extends StatelessWidget {
  const _GroupCard({required this.group, required this.fmt});
  final ChitGroup group;
  final NumberFormat fmt;

  Color get _statusColor {
    if (group.status == 'active') return AppColors.success;
    if (group.status == 'completed') return AppColors.info;
    if (group.status == 'cancelled') return AppColors.danger;
    return AppColors.textSecondary;
  }

  Color get _statusBg {
    if (group.status == 'active') return AppColors.successBg;
    if (group.status == 'completed') return AppColors.infoBg;
    if (group.status == 'cancelled') return AppColors.dangerBg;
    return AppColors.background;
  }

  String get _statusLabel {
    if (group.status == 'active') return 'Active';
    if (group.status == 'completed') return 'Completed';
    if (group.status == 'cancelled') return 'Cancelled';
    return group.status;
  }

  @override
  Widget build(BuildContext context) {
    final dateFmt = DateFormat('MMM yyyy');

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => _showDetail(context),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(boxShadow: AppTokens.shadow),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: AppColors.purpleBg,
                        borderRadius: BorderRadius.circular(AppTokens.radiusKpiIcon),
                      ),
                      child: const Icon(Icons.savings_outlined,
                          color: AppColors.purple, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(group.name, style: AppTypography.bodyLarge),
                          const SizedBox(height: 2),
                          Text(
                            'Started ${dateFmt.format(group.startDate)}',
                            style: AppTypography.caption,
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: _statusBg,
                        borderRadius: BorderRadius.circular(AppTokens.radiusBadge),
                      ),
                      child: Text(
                        _statusLabel,
                        style: AppTypography.tiny.copyWith(color: _statusColor),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                const Divider(color: AppColors.border, height: 1),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _Stat(
                        label: 'Chit Value',
                        value: fmt.format(group.chitValue),
                      ),
                    ),
                    Expanded(
                      child: _Stat(
                        label: 'Monthly',
                        value: fmt.format(group.monthlyContrib),
                      ),
                    ),
                    Expanded(
                      child: _Stat(
                        label: 'Members',
                        value: '${group.memberCount}/${group.totalMembers}',
                      ),
                    ),
                    Expanded(
                      child: _Stat(
                        label: 'Duration',
                        value: '${group.durationMonths}mo',
                      ),
                    ),
                  ],
                ),
                if (group.auctionCount > 0) ...[
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      const Icon(Icons.gavel_rounded,
                          size: 13, color: AppColors.textLight),
                      const SizedBox(width: 4),
                      Text(
                        '${group.auctionCount} auction${group.auctionCount == 1 ? '' : 's'} held',
                        style: AppTypography.caption,
                      ),
                      const Spacer(),
                      Icon(Icons.chevron_right_rounded,
                          size: 16, color: AppColors.textLight),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showDetail(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _GroupDetailSheet(group: group),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label, value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTypography.caption),
        const SizedBox(height: 2),
        Text(value, style: AppTypography.bodyLarge),
      ],
    );
  }
}

class _GroupDetailSheet extends ConsumerStatefulWidget {
  const _GroupDetailSheet({required this.group});
  final ChitGroup group;

  @override
  ConsumerState<_GroupDetailSheet> createState() => _GroupDetailSheetState();
}

class _GroupDetailSheetState extends ConsumerState<_GroupDetailSheet> {
  late Future<List<ChitMember>> _membersFuture;
  late Future<List<ChitAuction>> _auctionsFuture;

  @override
  void initState() {
    super.initState();
    final svc = ref.read(chitServiceProvider);
    _membersFuture = svc.members(widget.group.id);
    _auctionsFuture = svc.auctions(widget.group.id);
  }

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final h = MediaQuery.of(context).size.height * 0.85;
    final group = widget.group;

    return Container(
      height: h,
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 10),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(group.name, style: AppTypography.sectionTitle),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, size: 20),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(color: AppColors.border, height: 1),
          Expanded(
            child: DefaultTabController(
              length: 2,
              child: Column(
                children: [
                  const TabBar(
                    tabs: [
                      Tab(text: 'Members'),
                      Tab(text: 'Auctions'),
                    ],
                  ),
                  Expanded(
                    child: TabBarView(
                      children: [
                        FutureBuilder<List<ChitMember>>(
                          future: _membersFuture,
                          builder: (ctx, snap) {
                            if (snap.connectionState == ConnectionState.waiting) {
                              return const Padding(
                                padding: EdgeInsets.all(16),
                                child: Skeleton(height: 200),
                              );
                            }
                            if (snap.hasError) {
                              return Center(
                                child: Text(snap.error.toString(),
                                    style: AppTypography.body),
                              );
                            }
                            final members = snap.data ?? [];
                            if (members.isEmpty) {
                              return const EmptyState(
                                icon: Icons.people_outline,
                                title: 'No members yet',
                              );
                            }
                            return ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: members.length,
                              separatorBuilder: (_, __) =>
                                  const Divider(color: AppColors.border, height: 16),
                              itemBuilder: (_, i) {
                                final m = members[i];
                                return Row(
                                  children: [
                                    CircleAvatar(
                                      radius: 16,
                                      backgroundColor: AppColors.purpleBg,
                                      child: Text(
                                        '${m.memberNumber}',
                                        style: AppTypography.tiny
                                            .copyWith(color: AppColors.purple),
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
                                              style: AppTypography.caption),
                                        ],
                                      ),
                                    ),
                                    if (m.hasWon)
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: AppColors.successBg,
                                          borderRadius: BorderRadius.circular(
                                              AppTokens.radiusBadge),
                                        ),
                                        child: Text(
                                          'Won',
                                          style: AppTypography.tiny
                                              .copyWith(color: AppColors.success),
                                        ),
                                      ),
                                  ],
                                );
                              },
                            );
                          },
                        ),
                        FutureBuilder<List<ChitAuction>>(
                          future: _auctionsFuture,
                          builder: (ctx, snap) {
                            if (snap.connectionState == ConnectionState.waiting) {
                              return const Padding(
                                padding: EdgeInsets.all(16),
                                child: Skeleton(height: 200),
                              );
                            }
                            if (snap.hasError) {
                              return Center(
                                child: Text(snap.error.toString(),
                                    style: AppTypography.body),
                              );
                            }
                            final auctions = snap.data ?? [];
                            if (auctions.isEmpty) {
                              return const EmptyState(
                                icon: Icons.gavel_rounded,
                                title: 'No auctions yet',
                              );
                            }
                            return ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: auctions.length,
                              separatorBuilder: (_, __) =>
                                  const Divider(color: AppColors.border, height: 16),
                              itemBuilder: (_, i) {
                                final a = auctions[i];
                                final dateFmt = DateFormat('d MMM yyyy');
                                final isPending = a.status == 'pending';
                                return Row(
                                  children: [
                                    Container(
                                      width: 36,
                                      height: 36,
                                      decoration: BoxDecoration(
                                        color: isPending
                                            ? AppColors.warningBg
                                            : AppColors.successBg,
                                        borderRadius: BorderRadius.circular(
                                            AppTokens.radiusSm),
                                      ),
                                      child: Icon(
                                        isPending
                                            ? Icons.schedule_rounded
                                            : Icons.gavel_rounded,
                                        size: 18,
                                        color: isPending
                                            ? AppColors.warning
                                            : AppColors.success,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'Period ${a.periodNumber}',
                                            style: AppTypography.bodyLarge,
                                          ),
                                          if (a.winnerName != null)
                                            Text(
                                              a.winnerName!,
                                              style: AppTypography.caption,
                                            ),
                                          if (a.auctionDate != null)
                                            Text(
                                              dateFmt.format(a.auctionDate!),
                                              style: AppTypography.caption,
                                            ),
                                        ],
                                      ),
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        if (a.prizeAmount != null)
                                          Text(
                                            fmt.format(a.prizeAmount!),
                                            style: AppTypography.bodyLarge
                                                .copyWith(color: AppColors.success),
                                          ),
                                        if (a.dividend != null)
                                          Text(
                                            '÷ ${fmt.format(a.dividend!)}',
                                            style: AppTypography.caption,
                                          ),
                                      ],
                                    ),
                                  ],
                                );
                              },
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LoadingSkeleton extends StatelessWidget {
  const _LoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Skeleton(height: 60, borderRadius: AppTokens.radius),
        const SizedBox(height: 16),
        const Skeleton(height: 40, borderRadius: AppTokens.radiusBadge),
        const SizedBox(height: 12),
        ...List.generate(
          4,
          (_) => const Padding(
            padding: EdgeInsets.only(bottom: 10),
            child: Skeleton(height: 130, borderRadius: AppTokens.radius),
          ),
        ),
      ],
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, size: 48, color: AppColors.textLight),
            const SizedBox(height: 12),
            Text('Could not load chit groups', style: AppTypography.sectionTitle),
            const SizedBox(height: 6),
            Text(message,
                textAlign: TextAlign.center,
                style: AppTypography.body.copyWith(color: AppColors.textSecondary)),
          ],
        ),
      ),
    );
  }
}
