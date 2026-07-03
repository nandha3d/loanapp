import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/chit.dart';
import 'package:loantrack/data/services/chit_service.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

final _detailProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) {
  return ref.watch(chitServiceProvider).getById(id);
});

final _membersProvider =
    FutureProvider.autoDispose.family<List<ChitMember>, String>((ref, id) {
  return ref.watch(chitServiceProvider).members(id);
});

final _auctionsProvider =
    FutureProvider.autoDispose.family<List<ChitAuction>, String>((ref, id) {
  return ref.watch(chitServiceProvider).auctions(id);
});

final _subscriptionsProvider = FutureProvider.autoDispose
    .family<List<ChitSubscription>, String>((ref, id) {
  return ref.watch(chitServiceProvider).subscriptions(id);
});

class ChitDetailScreen extends ConsumerStatefulWidget {
  const ChitDetailScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<ChitDetailScreen> createState() => _ChitDetailScreenState();
}

class _ChitDetailScreenState extends ConsumerState<ChitDetailScreen> {
  bool _busy = false;
  String? _error;

  void _refresh() {
    ref.invalidate(_detailProvider(widget.id));
    ref.invalidate(_membersProvider(widget.id));
    ref.invalidate(_auctionsProvider(widget.id));
    ref.invalidate(_subscriptionsProvider(widget.id));
  }

  Future<void> _cancelGroup() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cancel Chit Group?'),
        content: const Text(
            'All pending auctions will be cancelled. This action cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('No')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              style: TextButton.styleFrom(foregroundColor: AppColors.danger),
              child: const Text('Cancel Group')),
        ],
      ),
    );
    if (confirm != true) return;
    setState(() => _busy = true);
    try {
      await ref.read(chitServiceProvider).cancel(widget.id);
      _refresh();
    } catch (e) {
      setState(() => _error = e.toString());
    }
    setState(() => _busy = false);
  }

  void _showRecordWinnerSheet(
      ChitAuction auction, List<ChitMember> members, NumberFormat fmt) {
    String? winnerId;
    double prizeAmount = 0;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(builder: (ctx, setLocal) {
          final eligible = members.where((m) => !m.hasWon).toList();
          return Padding(
            padding: EdgeInsets.fromLTRB(
                20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Record Winner — Period ${auction.periodNumber}',
                    style: AppTypography.sectionTitle),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  decoration: const InputDecoration(labelText: 'Winner'),
                  items: eligible
                      .map((m) => DropdownMenuItem(
                          value: m.id,
                          child:
                              Text('${m.memberNumber}. ${m.customerName}')))
                      .toList(),
                  onChanged: (v) => setLocal(() => winnerId = v),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  decoration: const InputDecoration(labelText: 'Prize Amount'),
                  keyboardType: TextInputType.number,
                  onChanged: (v) =>
                      setLocal(() => prizeAmount = double.tryParse(v) ?? 0),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Cancel')),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: winnerId == null
                          ? null
                          : () async {
                              Navigator.pop(ctx);
                              setState(() => _busy = true);
                              try {
                                await ref
                                    .read(chitServiceProvider)
                                    .recordAuction(
                                      widget.id,
                                      periodNumber: auction.periodNumber,
                                      winnerMemberId: winnerId,
                                      prizeAmount: prizeAmount > 0
                                          ? prizeAmount
                                          : null,
                                    );
                                _refresh();
                              } catch (e) {
                                setState(() => _error = e.toString());
                              }
                              setState(() => _busy = false);
                            },
                      child: const Text('Record Winner'),
                    ),
                  ],
                ),
              ],
            ),
          );
        });
      },
    );
  }

  void _showRecordPaymentSheet(ChitSubscription sub, NumberFormat fmt) {
    double amount = sub.outstanding;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(builder: (ctx, setLocal) {
          return Padding(
            padding: EdgeInsets.fromLTRB(
                20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                    'Record Payment — ${sub.memberName} · Period ${sub.periodNumber}',
                    style: AppTypography.sectionTitle),
                const SizedBox(height: 8),
                Text('Due: ${fmt.format(sub.dueAmount)}',
                    style: AppTypography.caption),
                const SizedBox(height: 12),
                TextFormField(
                  decoration:
                      const InputDecoration(labelText: 'Amount Paid'),
                  keyboardType: TextInputType.number,
                  initialValue: amount.toStringAsFixed(0),
                  onChanged: (v) =>
                      setLocal(() => amount = double.tryParse(v) ?? 0),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Cancel')),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: amount <= 0
                          ? null
                          : () async {
                              Navigator.pop(ctx);
                              setState(() => _busy = true);
                              try {
                                await ref
                                    .read(chitServiceProvider)
                                     .collectContribution(
                                       widget.id,
                                       memberId: sub.memberId,
                                       periodNumber: sub.periodNumber,
                                       amount: amount,
                                       paymentMode: 'cash',
                                     );
                                _refresh();
                              } catch (e) {
                                setState(() => _error = e.toString());
                              }
                              setState(() => _busy = false);
                            },
                      child: const Text('Record Payment'),
                    ),
                  ],
                ),
              ],
            ),
          );
        });
      },
    );
  }

  Future<void> _markMissed(String subscriptionId) async {
    setState(() => _busy = true);
    try {
      await ref.read(chitServiceProvider).markMissed(subscriptionId);
      _refresh();
    } catch (e) {
      setState(() => _error = e.toString());
    }
    setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(_detailProvider(widget.id));
    final members = ref.watch(_membersProvider(widget.id));
    final auctions = ref.watch(_auctionsProvider(widget.id));
    final subscriptions = ref.watch(_subscriptionsProvider(widget.id));
    final fmt = ref.watch(currencyFmtProvider);
    final t = T.of(ref);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('title.chit_detail')),
        centerTitle: true,
        actions: [
          if (detail.valueOrNull != null)
            PopupMenuButton<String>(
              onSelected: (v) {
                if (v == 'edit') {
                  context.push('/chits/${widget.id}/edit',
                      extra: detail.valueOrNull);
                } else if (v == 'cancel') {
                  _cancelGroup();
                }
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'edit', child: Text('Edit')),
                const PopupMenuItem(
                    value: 'cancel',
                    child: Text('Cancel Group',
                        style: TextStyle(color: AppColors.danger))),
              ],
            ),
        ],
      ),
      body: _busy
          ? const Center(child: CircularProgressIndicator())
          : detail.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text(e.toString())),
              data: (group) {
                final status = (group['status'] as String?) ?? 'active';
                return RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: () async => _refresh(),
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_error != null)
                        Container(
                          padding: const EdgeInsets.all(10),
                          margin: const EdgeInsets.only(bottom: 12),
                          decoration: BoxDecoration(
                            color: AppColors.dangerBg,
                            borderRadius:
                                BorderRadius.circular(AppTokens.radius),
                          ),
                          child: Text(_error!,
                              style: AppTypography.caption
                                  .copyWith(color: AppColors.danger)),
                        ),
                      // KPI Row
                      _KpiRow(group: group, fmt: fmt),
                      const SizedBox(height: 16),
                      // Auctions
                      _SectionCard(
                        title: '🔨 Auction History',
                        child: auctions.when(
                          loading: () => const Skeleton(
                              height: 100, borderRadius: AppTokens.radius),
                          error: (e, _) => Text(e.toString()),
                          data: (list) {
                            if (list.isEmpty) {
                              return Padding(
                                padding: const EdgeInsets.all(16),
                                child: Text('No auctions yet',
                                    style: AppTypography.caption),
                              );
                            }
                            return Column(
                              children: list.map((a) {
                                return _AuctionTile(
                                  auction: a,
                                  fmt: fmt,
                                  onRecord: () {
                                    final m = members.valueOrNull ?? [];
                                    _showRecordWinnerSheet(a, m, fmt);
                                  },
                                );
                              }).toList(),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 16),
                      // Members
                      _SectionCard(
                        title: '👥 Members',
                        child: members.when(
                          loading: () => const Skeleton(
                              height: 80, borderRadius: AppTokens.radius),
                          error: (e, _) => Text(e.toString()),
                          data: (list) {
                            if (list.isEmpty) {
                              return Padding(
                                padding: const EdgeInsets.all(16),
                                child: Text('No members',
                                    style: AppTypography.caption),
                              );
                            }
                            return Column(
                              children: list
                                  .map((m) => _MemberTile(member: m))
                                  .toList(),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 16),
                      // Subscription Payments
                      _SectionCard(
                        title: '💳 Member Payments',
                        child: subscriptions.when(
                          loading: () => const Skeleton(
                              height: 120, borderRadius: AppTokens.radius),
                          error: (e, _) => Text(e.toString()),
                          data: (list) {
                            if (list.isEmpty) {
                              return Padding(
                                padding: const EdgeInsets.all(16),
                                child: Text('No payments yet',
                                    style: AppTypography.caption),
                              );
                            }
                            return Column(
                              children: list.map((s) {
                                return _SubscriptionTile(
                                  sub: s,
                                  fmt: fmt,
                                  onPay: () =>
                                      _showRecordPaymentSheet(s, fmt),
                                  onMiss: () => _markMissed(s.id),
                                );
                              }).toList(),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 32),
                    ],
                  ),
                );
              },
            ),
    );
  }
}

// ─── Sub-widgets ─────────────────────────────────────

class _KpiRow extends StatelessWidget {
  const _KpiRow({required this.group, required this.fmt});
  final Map<String, dynamic> group;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    final members = (group['members'] as List?)?.length ??
        (group['_count']?['members'] as num?)?.toInt() ??
        0;
    final totalMembers = (group['totalMembers'] as num?)?.toInt() ?? 0;
    final auctionsDone = (group['auctions'] as List?)
            ?.where((dynamic a) => a['status'] == 'completed')
            .length ??
        0;
    final duration = (group['durationMonths'] as num?)?.toInt() ?? 0;

    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        _KpiChip(
          label: 'Chit Value',
          value: fmt.format(n(group['chitValue'])),
          color: AppColors.success,
        ),
        _KpiChip(
          label: 'Monthly',
          value: fmt.format(n(group['monthlyContrib'])),
          color: AppColors.info,
        ),
        _KpiChip(
          label: 'Members',
          value: '$members/$totalMembers',
          color: AppColors.warning,
        ),
        _KpiChip(
          label: 'Auctions',
          value: '$auctionsDone/$duration',
          color: AppColors.purple,
        ),
      ],
    );
  }
}

class _KpiChip extends StatelessWidget {
  const _KpiChip(
      {required this.label, required this.value, required this.color});
  final String label, value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: (MediaQuery.of(context).size.width - 42) / 2,
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
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

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: Text(title, style: AppTypography.sectionTitle),
          ),
          child,
        ],
      ),
    );
  }
}

class _AuctionTile extends StatelessWidget {
  const _AuctionTile(
      {required this.auction, required this.fmt, required this.onRecord});
  final ChitAuction auction;
  final NumberFormat fmt;
  final VoidCallback onRecord;

  @override
  Widget build(BuildContext context) {
    final isPending = auction.status == 'pending';
    final dateStr = auction.auctionDate != null
        ? DateFormat('dd MMM yyyy').format(auction.auctionDate!)
        : '—';
    return ListTile(
      dense: true,
      title: Text('Period ${auction.periodNumber}',
          style: AppTypography.body.copyWith(fontWeight: FontWeight.w600)),
      subtitle: Text(
          '${auction.winnerName ?? "—"} · $dateStr',
          style: AppTypography.caption),
      trailing: isPending
          ? TextButton(
              onPressed: onRecord,
              style: TextButton.styleFrom(
                foregroundColor: AppColors.primary,
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              ),
              child: const Text('Record'),
            )
          : Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: auction.status == 'completed'
                    ? AppColors.successBg
                    : AppColors.warningBg,
                borderRadius: BorderRadius.circular(AppTokens.radiusBadge),
              ),
              child: Text(
                auction.status,
                style: AppTypography.caption.copyWith(
                  color: auction.status == 'completed'
                      ? AppColors.success
                      : AppColors.warning,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
    );
  }
}

class _MemberTile extends StatelessWidget {
  const _MemberTile({required this.member});
  final ChitMember member;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      leading: CircleAvatar(
        radius: 16,
        backgroundColor: AppColors.primaryLight,
        child: Text('${member.memberNumber}',
            style: AppTypography.caption
                .copyWith(color: AppColors.primary, fontWeight: FontWeight.w700)),
      ),
      title: Text(member.customerName, style: AppTypography.body),
      subtitle: Text(member.customerCode, style: AppTypography.caption),
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: member.hasWon ? AppColors.successBg : AppColors.background,
          borderRadius: BorderRadius.circular(AppTokens.radiusBadge),
        ),
        child: Text(
          member.hasWon ? 'Won' : 'Pending',
          style: AppTypography.caption.copyWith(
            color: member.hasWon ? AppColors.success : AppColors.textSecondary,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class _SubscriptionTile extends StatelessWidget {
  const _SubscriptionTile({
    required this.sub,
    required this.fmt,
    required this.onPay,
    required this.onMiss,
  });
  final ChitSubscription sub;
  final NumberFormat fmt;
  final VoidCallback onPay;
  final VoidCallback onMiss;

  Color get _statusColor {
    switch (sub.status) {
      case 'paid':
        return AppColors.success;
      case 'missed':
        return AppColors.danger;
      case 'partial':
        return AppColors.warning;
      default:
        return AppColors.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      title: Text('${sub.memberName} · Period ${sub.periodNumber}',
          style: AppTypography.body.copyWith(fontWeight: FontWeight.w500)),
      subtitle: Text(
          'Due: ${fmt.format(sub.dueAmount)} · Paid: ${fmt.format(sub.paidAmount)}',
          style: AppTypography.caption),
      trailing: sub.status == 'paid'
          ? Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.successBg,
                borderRadius: BorderRadius.circular(AppTokens.radiusBadge),
              ),
              child: Text('Paid',
                  style: AppTypography.caption.copyWith(
                      color: AppColors.success, fontWeight: FontWeight.w700)),
            )
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextButton(
                  onPressed: onPay,
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 4),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text('Pay'),
                ),
                if (sub.status != 'missed')
                  TextButton(
                    onPressed: onMiss,
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.danger,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text('Miss'),
                  ),
              ],
            ),
    );
  }
}
