import 'dart:io';

import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/network/api_exception.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/local/chit_payment_queue.dart';
import 'package:loantrack/data/models/chit.dart';
import 'package:loantrack/data/services/chit_service.dart';
import 'package:loantrack/data/services/upload_service.dart';
import 'package:loantrack/features/chits/chit_live_auction_screen.dart';
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
  final _picker = ImagePicker();
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

  void _showRecordPaymentSheet(ChitSubscription sub, NumberFormat fmt) {
    double amount = sub.outstanding;
    String paymentMode = 'cash';
    String referenceNo = '';
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
                const SizedBox(height: 8),
                _ContributionBreakdown(sub: sub, fmt: fmt),
                const SizedBox(height: 12),
                TextFormField(
                  decoration: const InputDecoration(labelText: 'Amount Paid'),
                  keyboardType: TextInputType.number,
                  initialValue: amount.toStringAsFixed(0),
                  onChanged: (v) =>
                      setLocal(() => amount = double.tryParse(v) ?? 0),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: paymentMode,
                  decoration: const InputDecoration(labelText: 'Payment mode'),
                  items: const [
                    DropdownMenuItem(value: 'cash', child: Text('Cash')),
                    DropdownMenuItem(value: 'upi', child: Text('UPI')),
                    DropdownMenuItem(value: 'bank', child: Text('Bank')),
                    DropdownMenuItem(value: 'cheque', child: Text('Cheque')),
                  ],
                  onChanged: (v) {
                    if (v != null) setLocal(() => paymentMode = v);
                  },
                ),
                if (paymentMode != 'cash') ...[
                  const SizedBox(height: 12),
                  TextFormField(
                    decoration:
                        const InputDecoration(labelText: 'Reference no'),
                    onChanged: (v) => referenceNo = v,
                  ),
                ],
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
                              final idempotencyKey = chitPaymentIdempotencyKey(
                                groupId: widget.id,
                                memberId: sub.memberId,
                                periodNumber: sub.periodNumber,
                                amount: amount,
                              );
                              final queued = queuedChitPayment(
                                idempotencyKey: idempotencyKey,
                                groupId: widget.id,
                                memberId: sub.memberId,
                                periodNumber: sub.periodNumber,
                                amount: amount,
                                paymentMode: paymentMode,
                                referenceNo: referenceNo,
                              );
                              try {
                                if (!ref.read(chitPaymentSyncProvider).online) {
                                  await ref
                                      .read(chitPaymentQueueProvider)
                                      .add(queued);
                                  await ref
                                      .read(chitPaymentSyncProvider.notifier)
                                      .refresh();
                                } else {
                                  await ref
                                      .read(chitServiceProvider)
                                      .collectContribution(
                                        widget.id,
                                        memberId: sub.memberId,
                                        periodNumber: sub.periodNumber,
                                        amount: amount,
                                        paymentMode: paymentMode,
                                        idempotencyKey: idempotencyKey,
                                        referenceNo: referenceNo,
                                      );
                                }
                                _refresh();
                              } catch (e) {
                                final isServerReject = e is ApiException &&
                                    e.statusCode != null &&
                                    e.statusCode! >= 400 &&
                                    e.statusCode! < 500;
                                if (!isServerReject) {
                                  await ref
                                      .read(chitPaymentQueueProvider)
                                      .add(queued);
                                  await ref
                                      .read(chitPaymentSyncProvider.notifier)
                                      .refresh();
                                  _refresh();
                                } else {
                                  setState(() => _error = e.message);
                                }
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

  Future<void> _activateGroup() async {
    setState(() => _busy = true);
    try {
      await ref.read(chitServiceProvider).activate(widget.id);
      _refresh();
    } catch (e) {
      setState(() => _error = e.toString());
    }
    setState(() => _busy = false);
  }

  Future<void> _runAction(Future<void> Function() fn) async {
    setState(() => _busy = true);
    try {
      await fn();
      _refresh();
    } catch (e) {
      setState(() => _error = e.toString());
    }
    setState(() => _busy = false);
  }

  void _showAddBidSheet(ChitAuction auction, List<ChitMember> members) {
    final eligible = members
        .where((m) => !m.hasWon && m.subscriberStatus == 'active')
        .toList();
    String? memberId;
    double prize = 0;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setLocal) {
        return Padding(
          padding: EdgeInsets.fromLTRB(
              20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Add Bid — Period ${auction.periodNumber}',
                  style: AppTypography.sectionTitle),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(labelText: 'Ticket'),
                items: eligible
                    .map((m) => DropdownMenuItem(
                        value: m.id,
                        child: Text(
                            '${m.ticketNo ?? m.memberNumber}. ${m.customerName}')))
                    .toList(),
                onChanged: (v) => setLocal(() => memberId = v),
              ),
              const SizedBox(height: 12),
              TextFormField(
                decoration:
                    const InputDecoration(labelText: 'Prize amount accepted'),
                keyboardType: TextInputType.number,
                onChanged: (v) =>
                    setLocal(() => prize = double.tryParse(v) ?? 0),
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
                    onPressed: memberId == null || prize <= 0
                        ? null
                        : () {
                            Navigator.pop(ctx);
                            _runAction(() => ref
                                .read(chitServiceProvider)
                                .addBid(widget.id, auction.id,
                                    memberId: memberId!, bidAmount: prize));
                          },
                    child: const Text('Add Bid'),
                  ),
                ],
              ),
            ],
          ),
        );
      }),
    );
  }

  void _showSecuritySheet(ChitAuction auction) {
    String securityType = 'guarantor';
    double? value;
    String guarantorName = '';
    String guarantorPhone = '';
    var documentsFuture =
        ref.read(chitServiceProvider).securityDocuments(widget.id, auction.id);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setLocal) {
        Future<void> uploadDocument(String documentType) async {
          final picked = await _picker.pickImage(
            source: ImageSource.gallery,
            maxWidth: 1400,
            maxHeight: 1400,
            imageQuality: 80,
          );
          if (picked == null) return;
          final file = File(picked.path);
          final upload = await ref
              .read(uploadServiceProvider)
              .uploadFile(file, contentType: 'image/jpeg');
          await ref.read(chitServiceProvider).uploadSecurityDocument(
                widget.id,
                auction.id,
                documentType: documentType,
                fileName: upload.filename,
                fileUrl: upload.url,
                mimeType: 'image/jpeg',
                sizeBytes: file.lengthSync(),
              );
          setLocal(() {
            documentsFuture = ref
                .read(chitServiceProvider)
                .securityDocuments(widget.id, auction.id);
          });
        }

        Future<void> reviewDocument(
            ChitSecurityDocument document, String action) async {
          await ref.read(chitServiceProvider).reviewSecurityDocument(
                widget.id,
                auction.id,
                documentId: document.id,
                action: action,
              );
          setLocal(() {
            documentsFuture = ref
                .read(chitServiceProvider)
                .securityDocuments(widget.id, auction.id);
          });
        }

        return Padding(
          padding: EdgeInsets.fromLTRB(
              20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Security — Period ${auction.periodNumber}',
                    style: AppTypography.sectionTitle),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: securityType,
                  decoration: const InputDecoration(labelText: 'Security type'),
                  items: const [
                    DropdownMenuItem(
                        value: 'guarantor', child: Text('Guarantor')),
                    DropdownMenuItem(
                        value: 'property', child: Text('Property')),
                    DropdownMenuItem(value: 'gold', child: Text('Gold')),
                    DropdownMenuItem(value: 'fd', child: Text('Fixed deposit')),
                    DropdownMenuItem(value: 'salary', child: Text('Salary')),
                    DropdownMenuItem(value: 'cheque', child: Text('Cheque')),
                    DropdownMenuItem(value: 'other', child: Text('Other')),
                  ],
                  onChanged: (v) =>
                      setLocal(() => securityType = v ?? 'guarantor'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  decoration:
                      const InputDecoration(labelText: 'Security value'),
                  keyboardType: TextInputType.number,
                  onChanged: (v) => value = double.tryParse(v),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  decoration:
                      const InputDecoration(labelText: 'Guarantor name'),
                  onChanged: (v) => guarantorName = v,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  decoration:
                      const InputDecoration(labelText: 'Guarantor phone'),
                  keyboardType: TextInputType.phone,
                  onChanged: (v) => guarantorPhone = v,
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton.icon(
                      onPressed: () =>
                          _runAction(() => uploadDocument('guarantor_photo')),
                      icon: const Icon(Icons.person_pin_circle_outlined),
                      label: const Text('Photo'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () =>
                          _runAction(() => uploadDocument('guarantor_kyc')),
                      icon: const Icon(Icons.badge_outlined),
                      label: const Text('KYC'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () =>
                          _runAction(() => uploadDocument('security_cheque')),
                      icon: const Icon(Icons.receipt_long_outlined),
                      label: const Text('Cheque'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                FutureBuilder<List<ChitSecurityDocument>>(
                  future: documentsFuture,
                  builder: (context, snap) {
                    final docs = snap.data ?? const <ChitSecurityDocument>[];
                    if (snap.connectionState == ConnectionState.waiting &&
                        docs.isEmpty) {
                      return const LinearProgressIndicator(minHeight: 2);
                    }
                    if (docs.isEmpty) return const SizedBox.shrink();
                    return Column(
                      children: docs
                          .map(
                            (doc) => ListTile(
                              dense: true,
                              contentPadding: EdgeInsets.zero,
                              leading: const Icon(Icons.description_outlined),
                              title: Text(doc.label),
                              subtitle: Text('${doc.fileName} · ${doc.status}'),
                              trailing: PopupMenuButton<String>(
                                onSelected: (action) => _runAction(
                                    () => reviewDocument(doc, action)),
                                itemBuilder: (_) => const [
                                  PopupMenuItem(
                                      value: 'verify', child: Text('Verify')),
                                  PopupMenuItem(
                                      value: 'approve', child: Text('Approve')),
                                  PopupMenuItem(
                                      value: 'reject', child: Text('Reject')),
                                ],
                              ),
                            ),
                          )
                          .toList(growable: false),
                    );
                  },
                ),
                const SizedBox(height: 16),
                Wrap(
                  alignment: WrapAlignment.end,
                  spacing: 8,
                  children: [
                    TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Cancel')),
                    OutlinedButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                        _runAction(() => ref
                            .read(chitServiceProvider)
                            .submitSecurity(widget.id, auction.id,
                                securityType: securityType,
                                securityValue: value,
                                guarantorName: guarantorName,
                                guarantorPhone: guarantorPhone));
                      },
                      child: const Text('Submit'),
                    ),
                    OutlinedButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                        _runAction(() => ref
                            .read(chitServiceProvider)
                            .reviewSecurity(widget.id, auction.id,
                                action: 'verify'));
                      },
                      child: const Text('Verify'),
                    ),
                    ElevatedButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                        _runAction(() => ref
                            .read(chitServiceProvider)
                            .reviewSecurity(widget.id, auction.id,
                                action: 'approve'));
                      },
                      child: const Text('Approve'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      }),
    );
  }

  void _showAuctionManageSheet(ChitAuction auction, Map<String, dynamic> group,
      List<ChitMember> members) {
    final auctionType = (group['auctionType'] as String?) ?? 'open_manual';
    final isDrawType =
        auctionType == 'lottery' || auctionType == 'fixed_rotation';
    final locked = ['confirmed', 'paid', 'cancelled'].contains(auction.status);
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text('Period ${auction.periodNumber} · ${auction.status}',
                  style: AppTypography.sectionTitle),
            ),
            if (auctionType == 'open_live' && !locked)
              ListTile(
                leading: Icon(Icons.podcasts, color: AppColors.primary),
                title: const Text('Live bidding room'),
                onTap: () {
                  Navigator.pop(ctx);
                  Navigator.push(
                    context,
                    MaterialPageRoute<void>(
                      builder: (_) => ChitLiveAuctionScreen(
                        groupId: widget.id,
                        auctionId: auction.id,
                        periodNumber: auction.periodNumber,
                        members: members,
                        isAdmin: true,
                      ),
                    ),
                  ).then((_) => _refresh());
                },
              ),
            if (!isDrawType && !locked)
              ListTile(
                leading: Icon(Icons.gavel, color: AppColors.primary),
                title: const Text('Add bid'),
                onTap: () {
                  Navigator.pop(ctx);
                  _showAddBidSheet(auction, members);
                },
              ),
            if (isDrawType && !locked)
              ListTile(
                leading: Icon(Icons.casino, color: AppColors.primary),
                title: Text(auctionType == 'lottery'
                    ? 'Draw winner (audited lottery)'
                    : 'Resolve next in rotation'),
                onTap: () {
                  Navigator.pop(ctx);
                  _runAction(() async {
                    await ref
                        .read(chitServiceProvider)
                        .drawWinner(widget.id, auction.id);
                  });
                },
              ),
            if (!isDrawType && !locked)
              ListTile(
                leading:
                    const Icon(Icons.check_circle, color: AppColors.success),
                title: const Text('Confirm highest bid'),
                subtitle: const Text('No money moves until security approval'),
                onTap: () {
                  Navigator.pop(ctx);
                  _runAction(() => ref
                      .read(chitServiceProvider)
                      .confirmAuction(widget.id, auction.id));
                },
              ),
            if (auction.status == 'confirmed')
              ListTile(
                leading: const Icon(Icons.shield, color: AppColors.warning),
                title: const Text('Security (submit / verify / approve)'),
                onTap: () {
                  Navigator.pop(ctx);
                  _showSecuritySheet(auction);
                },
              ),
            if (auction.status == 'confirmed')
              ListTile(
                leading: const Icon(Icons.payments, color: AppColors.success),
                title: const Text('Release prize payout'),
                subtitle: const Text('Requires approved security'),
                onTap: () {
                  Navigator.pop(ctx);
                  _runAction(() => ref
                      .read(chitServiceProvider)
                      .releasePayout(widget.id, auction.id));
                },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
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
                } else if (v == 'activate') {
                  _activateGroup();
                } else if (v == 'cancel') {
                  _cancelGroup();
                }
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'edit', child: Text('Edit')),
                if ((detail.valueOrNull?['status'] as String?) == 'draft')
                  const PopupMenuItem(
                      value: 'activate', child: Text('Activate Group')),
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
                                  onManage: () {
                                    final m = members.valueOrNull ?? [];
                                    _showAuctionManageSheet(a, group, m);
                                  },
                                  onLive: () {
                                    final m = members.valueOrNull ?? [];
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute<void>(
                                        builder: (_) => ChitLiveAuctionScreen(
                                          groupId: widget.id,
                                          auctionId: a.id,
                                          periodNumber: a.periodNumber,
                                          members: m,
                                          isAdmin: true,
                                        ),
                                      ),
                                    ).then((_) => _refresh());
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
                                  onPay: () => _showRecordPaymentSheet(s, fmt),
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
  const _AuctionTile({
    required this.auction,
    required this.fmt,
    required this.onManage,
    required this.onLive,
  });
  final ChitAuction auction;
  final NumberFormat fmt;
  final VoidCallback onManage;
  final VoidCallback onLive;

  @override
  Widget build(BuildContext context) {
    final isPending = auction.status == 'pending';
    final dateStr = auction.auctionDate != null
        ? DateFormat('dd MMM yyyy').format(auction.auctionDate!)
        : '—';
    return ListTile(
      dense: true,
      onTap: onManage,
      title: Text('Period ${auction.periodNumber}',
          style: AppTypography.body.copyWith(fontWeight: FontWeight.w600)),
      subtitle: Text('${auction.winnerName ?? "—"} · $dateStr',
          style: AppTypography.caption),
      trailing: isPending
          ? Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                FilledButton.icon(
                  onPressed: onLive,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.onPrimary,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    visualDensity: VisualDensity.compact,
                  ),
                  icon: const Icon(Icons.gavel_rounded, size: 16),
                  label: const Text('Live'),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: onManage,
                  icon: const Icon(Icons.more_horiz),
                  color: AppColors.primary,
                  tooltip: 'Manage auction',
                ),
              ],
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
            style: AppTypography.caption.copyWith(
                color: AppColors.primary, fontWeight: FontWeight.w700)),
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

class _ContributionBreakdown extends StatelessWidget {
  const _ContributionBreakdown({required this.sub, required this.fmt});

  final ChitSubscription sub;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    final base = sub.baseDueAmount ?? sub.dueAmount + sub.dividendAmount;
    final netDue = sub.dueAmount + sub.penaltyAmount;
    final rows = <String>[
      'Base ${fmt.format(base)}',
      sub.dividendAmount > 0
          ? 'Dividend -${fmt.format(sub.dividendAmount)}'
          : 'Dividend -',
      sub.penaltyAmount > 0
          ? 'Penalty ${fmt.format(sub.penaltyAmount)}'
          : 'Penalty -',
      'Net due ${fmt.format(netDue)}',
      'Paid ${fmt.format(sub.paidAmount)}',
      'Outstanding ${fmt.format(sub.outstanding)}',
    ];
    return Wrap(
      spacing: 8,
      runSpacing: 4,
      children: rows
          .map(
            (text) => Text(
              text,
              style: AppTypography.caption.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          )
          .toList(growable: false),
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
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 4),
        child: _ContributionBreakdown(sub: sub, fmt: fmt),
      ),
      trailing: sub.status == 'paid'
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
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
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
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
