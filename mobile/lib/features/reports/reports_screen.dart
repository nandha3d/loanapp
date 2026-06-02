import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/reports.dart';
import 'package:loantrack/data/services/reports_service.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

// ── Providers ────────────────────────────────────────────────────────────────

final _overdueProvider =
    FutureProvider.autoDispose<List<OverdueItem>>((ref) async {
  final items = await ref.watch(reportsServiceProvider).fetchOverdueReport();
  // Sort descending by outstanding amount.
  final sorted = [...items]
    ..sort((a, b) => b.outstanding.compareTo(a.outstanding));
  return sorted;
});

// Date-range state for the agent tab.
class _DateRange {
  const _DateRange({required this.from, required this.to});
  final DateTime from;
  final DateTime to;
}

final _dateRangeProvider =
    StateProvider.autoDispose<_DateRange>((ref) {
  final now = DateTime.now();
  return _DateRange(
    from: now.subtract(const Duration(days: 30)),
    to: now,
  );
});

final _agentPerfProvider =
    FutureProvider.autoDispose<List<AgentPerf>>((ref) {
  final range = ref.watch(_dateRangeProvider);
  return ref
      .watch(reportsServiceProvider)
      .fetchAgentPerformance(range.from, range.to);
});

// ── Screen ────────────────────────────────────────────────────────────────────

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('rep.title')),
        centerTitle: true,
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          labelStyle: AppTypography.label,
          unselectedLabelStyle: AppTypography.label,
          tabs: [
            Tab(text: t.x('rep.overdueTab')),
            Tab(text: t.x('rep.agentPerfTab')),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: const [
          _OverdueTab(),
          _AgentPerfTab(),
        ],
      ),
    );
  }
}

// ── Overdue tab ───────────────────────────────────────────────────────────────

class _OverdueTab extends ConsumerWidget {
  const _OverdueTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final async = ref.watch(_overdueProvider);

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async => ref.invalidate(_overdueProvider),
      child: async.when(
        loading: () => _ListSkeleton(),
        error: (e, _) => _ErrorView(message: e.toString()),
        data: (items) {
          if (items.isEmpty) {
            return ListView(
              children: [
                const SizedBox(height: 80),
                EmptyState(
                  icon: Icons.check_circle_outline,
                  title: t.x('rep.noData'),
                ),
              ],
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) => _OverdueCard(item: items[i]),
          );
        },
      ),
    );
  }
}

class _OverdueCard extends ConsumerWidget {
  const _OverdueCard({required this.item});
  final OverdueItem item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Red dot indicator
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: AppColors.danger,
                shape: BoxShape.circle,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.customerName, style: AppTypography.bodyLarge),
                const SizedBox(height: 2),
                Text(
                  item.customerCode,
                  style: AppTypography.caption,
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                fmt.format(item.outstanding),
                style: AppTypography.label.copyWith(color: AppColors.danger),
              ),
              const SizedBox(height: 3),
              Text(
                '${item.missedInstalments} ${t.x('rep.missed')}',
                style: AppTypography.caption,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Agent performance tab ─────────────────────────────────────────────────────

class _AgentPerfTab extends ConsumerStatefulWidget {
  const _AgentPerfTab();

  @override
  ConsumerState<_AgentPerfTab> createState() => _AgentPerfTabState();
}

class _AgentPerfTabState extends ConsumerState<_AgentPerfTab> {
  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final range = ref.watch(_dateRangeProvider);
    final async = ref.watch(_agentPerfProvider);
    final dateFmt = DateFormat('dd MMM yyyy');

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async => ref.invalidate(_agentPerfProvider),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Date range picker card
          _DateRangeCard(
            from: range.from,
            to: range.to,
            dateFmt: dateFmt,
            onApply: (from, to) {
              ref.read(_dateRangeProvider.notifier).state =
                  _DateRange(from: from, to: to);
            },
          ),
          const SizedBox(height: 16),
          // Results
          async.when(
            loading: () => _ListSkeleton(),
            error: (e, _) => _ErrorView(message: e.toString()),
            data: (agents) {
              if (agents.isEmpty) {
                return SizedBox(
                  height: 200,
                  child: EmptyState(
                    icon: Icons.group_outlined,
                    title: t.x('rep.noData'),
                  ),
                );
              }
              return _AgentTable(agents: agents);
            },
          ),
        ],
      ),
    );
  }
}

class _DateRangeCard extends ConsumerWidget {
  const _DateRangeCard({
    required this.from,
    required this.to,
    required this.dateFmt,
    required this.onApply,
  });

  final DateTime from;
  final DateTime to;
  final DateFormat dateFmt;
  final void Function(DateTime from, DateTime to) onApply;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Row(
        children: [
          Expanded(
            child: _DateChip(
              label: t.x('rep.from'),
              value: dateFmt.format(from),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: from,
                  firstDate: DateTime(2020),
                  lastDate: to,
                );
                if (picked != null) onApply(picked, to);
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text('–', style: AppTypography.body),
          ),
          Expanded(
            child: _DateChip(
              label: t.x('rep.to'),
              value: dateFmt.format(to),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: to,
                  firstDate: from,
                  lastDate: DateTime.now(),
                );
                if (picked != null) onApply(from, picked);
              },
            ),
          ),
          const SizedBox(width: 10),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              textStyle: AppTypography.label,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            onPressed: () => onApply(from, to),
            child: Text(t.x('rep.apply')),
          ),
        ],
      ),
    );
  }
}

class _DateChip extends StatelessWidget {
  const _DateChip({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: AppTypography.extraTiny),
            const SizedBox(height: 2),
            Text(value, style: AppTypography.label),
          ],
        ),
      ),
    );
  }
}

class _AgentTable extends ConsumerWidget {
  const _AgentTable({required this.agents});
  final List<AgentPerf> agents;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header row
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: const BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.vertical(
                top: Radius.circular(AppTokens.radius),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: Text(
                    t.x('rep.agent'),
                    style: AppTypography.label,
                  ),
                ),
                Expanded(
                  flex: 2,
                  child: Text(
                    t.x('rep.expected'),
                    style: AppTypography.label,
                    textAlign: TextAlign.right,
                  ),
                ),
                Expanded(
                  flex: 2,
                  child: Text(
                    t.x('rep.collected'),
                    style: AppTypography.label,
                    textAlign: TextAlign.right,
                  ),
                ),
                Expanded(
                  flex: 2,
                  child: Text(
                    t.x('rep.hitRate'),
                    style: AppTypography.label,
                    textAlign: TextAlign.right,
                  ),
                ),
              ],
            ),
          ),
          // Data rows
          ...agents.asMap().entries.map(
                (e) => _AgentRow(
                  agent: e.value,
                  fmt: fmt,
                  isLast: e.key == agents.length - 1,
                ),
              ),
        ],
      ),
    );
  }
}

class _AgentRow extends StatelessWidget {
  const _AgentRow({
    required this.agent,
    required this.fmt,
    required this.isLast,
  });

  final AgentPerf agent;
  final NumberFormat fmt;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final hitPct = agent.hitRate.clamp(0, 100);
    final hitColor = hitPct >= 80
        ? AppColors.success
        : hitPct >= 50
            ? AppColors.warning
            : AppColors.danger;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : const Border(
                bottom: BorderSide(color: AppColors.border, width: 0.5),
              ),
      ),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(
              agent.name.isEmpty ? agent.agentId : agent.name,
              style: AppTypography.bodyLarge,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              fmt.format(agent.expected),
              style: AppTypography.body
                  .copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.right,
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              fmt.format(agent.collected),
              style: AppTypography.label.copyWith(color: AppColors.success),
              textAlign: TextAlign.right,
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              '$hitPct%',
              style: AppTypography.label.copyWith(color: hitColor),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

class _ListSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      physics: const NeverScrollableScrollPhysics(),
      itemCount: 6,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, __) => const Skeleton(
        height: 64,
        borderRadius: AppTokens.radius,
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.dangerBg,
          borderRadius: BorderRadius.circular(AppTokens.radius),
        ),
        child: Text(
          message,
          style: AppTypography.body.copyWith(color: AppColors.danger),
        ),
      ),
    );
  }
}
