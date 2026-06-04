import 'dart:convert';
import 'package:video_player/video_player.dart';
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

  void _showVideoKycReviewSheet(BuildContext context) {
    final t = T.of(ref);
    final item = widget.item;
    final latestSession = item.kycSessions.isNotEmpty ? item.kycSessions.first : null;
    
    String? videoUrl;
    if (latestSession != null && latestSession.responseData != null) {
      try {
        final decoded = jsonDecode(latestSession.responseData!) as Map<String, dynamic>;
        videoUrl = decoded['video_url'] as String?;
      } catch (_) {}
    }

    final notesController = TextEditingController();
    bool sheetBusy = false;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom,
                left: 16,
                right: 16,
                top: 16,
              ),
              child: SafeArea(
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Container(
                          width: 36,
                          height: 4,
                          margin: const EdgeInsets.only(bottom: 16),
                          decoration: BoxDecoration(
                            color: AppColors.border,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      const Text('Review Video KYC', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Customer: ${item.name}', style: const TextStyle(fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Text('Code: ${item.customerCode}'),
                            const SizedBox(height: 4),
                            Text('Phone: ${item.phone}'),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (videoUrl != null) ...[
                        const Text('Recorded KYC Video', style: TextStyle(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 8),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: KycVideoPlayer(url: videoUrl),
                        ),
                      ] else ...[
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppColors.background,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Center(
                            child: Text('No recorded video found in session.', style: TextStyle(color: AppColors.textLight)),
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: notesController,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          labelText: 'Review Notes / Remarks',
                          hintText: 'Enter details on physical face match, audio match...',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 20),
                      if (sheetBusy)
                        const Center(child: CircularProgressIndicator())
                      else
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () async {
                                  if (notesController.text.trim().isEmpty) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Please provide rejection notes')),
                                    );
                                    return;
                                  }
                                  final navigator = Navigator.of(ctx);
                                  final messenger = ScaffoldMessenger.of(context);
                                  setSheetState(() => sheetBusy = true);
                                  try {
                                    await ref.read(kycServiceProvider).review(
                                      item.id,
                                      'rejected',
                                      reason: notesController.text.trim(),
                                    );
                                    navigator.pop();
                                    ref.invalidate(kycQueueProvider);
                                    messenger.showSnackBar(
                                      SnackBar(content: Text(t.x('kyc.rejected_msg')), backgroundColor: AppColors.danger),
                                    );
                                  } catch (e) {
                                    setSheetState(() => sheetBusy = false);
                                    messenger.showSnackBar(
                                      SnackBar(content: Text(e.toString())),
                                    );
                                  }
                                },
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: AppColors.danger,
                                  side: const BorderSide(color: AppColors.danger),
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                ),
                                child: Text(t.x('kyc.reject_btn')),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: FilledButton(
                                onPressed: () async {
                                  final navigator = Navigator.of(ctx);
                                  final messenger = ScaffoldMessenger.of(context);
                                  setSheetState(() => sheetBusy = true);
                                  try {
                                    await ref.read(kycServiceProvider).review(
                                      item.id,
                                      'verified',
                                      reason: notesController.text.trim().isEmpty ? null : notesController.text.trim(),
                                    );
                                    navigator.pop();
                                    ref.invalidate(kycQueueProvider);
                                    messenger.showSnackBar(
                                      SnackBar(content: Text(t.x('kyc.verified_msg')), backgroundColor: AppColors.success),
                                    );
                                  } catch (e) {
                                    setSheetState(() => sheetBusy = false);
                                    messenger.showSnackBar(
                                      SnackBar(content: Text(e.toString())),
                                    );
                                  }
                                },
                                style: FilledButton.styleFrom(
                                  backgroundColor: AppColors.success,
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                ),
                                child: Text(t.x('kyc.verify_btn')),
                              ),
                            ),
                          ],
                        ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final item = widget.item;
    final isVideoKyc = item.kycMethod == 'video_kyc' ||
        (item.kycSessions.isNotEmpty && item.kycSessions.first.method == 'video_kyc');

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
          else if (isVideoKyc)
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                icon: const Icon(Icons.rate_review_outlined),
                label: const Text('Review Video KYC'),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
                onPressed: () => _showVideoKycReviewSheet(context),
              ),
            )
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

class KycVideoPlayer extends StatefulWidget {
  const KycVideoPlayer({super.key, required this.url});
  final String url;

  @override
  State<KycVideoPlayer> createState() => _KycVideoPlayerState();
}

class _KycVideoPlayerState extends State<KycVideoPlayer> {
  late VideoPlayerController _controller;
  bool _initialized = false;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _controller = VideoPlayerController.networkUrl(Uri.parse(widget.url))
      ..initialize().then((_) {
        setState(() {
          _initialized = true;
        });
      }).catchError((_) {
        setState(() {
          _error = true;
        });
      });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error) {
      return const SizedBox(
        height: 180,
        child: Center(
          child: Text('Error loading video', style: TextStyle(color: AppColors.danger)),
        ),
      );
    }
    if (!_initialized) {
      return const SizedBox(
        height: 180,
        child: Center(child: CircularProgressIndicator()),
      );
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AspectRatio(
          aspectRatio: _controller.value.aspectRatio,
          child: VideoPlayer(_controller),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            IconButton(
              icon: Icon(
                _controller.value.isPlaying ? Icons.pause : Icons.play_arrow,
              ),
              onPressed: () {
                setState(() {
                  _controller.value.isPlaying ? _controller.pause() : _controller.play();
                });
              },
            ),
            IconButton(
              icon: const Icon(Icons.replay),
              onPressed: () {
                _controller.seekTo(Duration.zero);
                _controller.play();
                setState(() {});
              },
            ),
          ],
        ),
      ],
    );
  }
}
