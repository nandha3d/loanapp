import 'dart:typed_data';

import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:printing/printing.dart';
import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:url_launcher/url_launcher.dart';

import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/network/authed_image.dart';
import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/customer.dart';
import 'package:loantrack/data/models/user.dart';
import 'package:loantrack/data/repositories/customer_repository.dart';
import 'package:loantrack/shared/widgets/app_badge.dart';
import 'package:loantrack/shared/widgets/app_button.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

class CustomerDetailScreen extends ConsumerWidget {
  const CustomerDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(customerDetailProvider(id));
    return Scaffold(
      backgroundColor: AppColors.background,
      body: async.when(
        loading: () => const _LoadingDetail(),
        error: (err, _) => _ErrorDetail(message: err.toString()),
        data: (customer) => _DetailBody(
          customer: customer,
          onRefresh: () => ref.invalidate(customerDetailProvider(id)),
        ),
      ),
    );
  }
}

class _DetailBody extends ConsumerStatefulWidget {
  const _DetailBody({required this.customer, required this.onRefresh});
  final Customer customer;
  final VoidCallback onRefresh;

  @override
  ConsumerState<_DetailBody> createState() => _DetailBodyState();
}

class _DetailBodyState extends ConsumerState<_DetailBody> {
  bool _suspending = false;
  bool _printingReceipt = false;

  Future<void> _toggleSuspend() async {
    setState(() => _suspending = true);
    try {
      final next =
          widget.customer.status == 'suspended' ? 'active' : 'suspended';
      await ref
          .read(customerRepositoryProvider)
          .update(widget.customer.id, {'status': next});
      ref.invalidate(customerListProvider);
      widget.onRefresh();
    } catch (e) {
      if (!mounted) return;
      final t = T.of(ref);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${t.x('msg.update_failed')}: $e')),
      );
    } finally {
      if (mounted) setState(() => _suspending = false);
    }
  }

  Future<void> _openCollectionReceipt() async {
    setState(() => _printingReceipt = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final bytes = await ref
          .read(customerRepositoryProvider)
          .collectionReceiptPdf(widget.customer.id);
      if (bytes.isEmpty) throw Exception('Empty receipt');
      await Printing.layoutPdf(
        onLayout: (_) async => Uint8List.fromList(bytes),
        name: 'passbook-${widget.customer.customerCode}.pdf',
      );
    } catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(
          content: Text('Could not open passbook: $e'),
          backgroundColor: AppColors.danger,
        ),
      );
    } finally {
      if (mounted) setState(() => _printingReceipt = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.customer;
    final t = T.of(ref);

    return Column(
      children: [
        _Header(customer: c, t: t),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _QuickContact(customer: c, t: t),
              const SizedBox(height: 14),
              _RiskCard(customer: c, t: t),
              const SizedBox(height: 14),
              _KpiStrip(customer: c, t: t),
              const SizedBox(height: 14),
              _LoansSection(customer: c, t: t),
              const SizedBox(height: 14),
              _IdentitySection(customer: c, t: t),
              const SizedBox(height: 14),
              if (c.companyName != null && c.companyName!.isNotEmpty) ...[
                _CompanySection(customer: c),
                const SizedBox(height: 14),
              ],
              if (c.securityCheques.isNotEmpty) ...[
                _SecurityChequesSection(cheques: c.securityCheques),
                const SizedBox(height: 14),
              ],
              if (c.guarantors.isNotEmpty) ...[
                _GuarantorsSection(guarantors: c.guarantors),
                const SizedBox(height: 14),
              ],
              if (c.kycDocuments.isNotEmpty) ...[
                _KycDocsSection(docs: c.kycDocuments),
                const SizedBox(height: 14),
              ],
              const SizedBox(height: 80),
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              border: Border(top: BorderSide(color: AppColors.border)),
              boxShadow: AppTokens.shadowLg,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _printingReceipt ? null : _openCollectionReceipt,
                    icon: _printingReceipt
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.picture_as_pdf_outlined),
                    label: const Text('Collection passbook'),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: AppButton(
                        label: c.status == 'suspended'
                            ? t.x('cust.unsuspend')
                            : t.x('cust.suspend'),
                        variant: c.status == 'suspended'
                            ? AppButtonVariant.secondary
                            : AppButtonVariant.danger,
                        expand: true,
                        loading: _suspending,
                        onPressed: _toggleSuspend,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: AppButton(
                        label: t.x('cust.edit_profile'),
                        expand: true,
                        onPressed: () async {
                          await context.push<Object?>(
                            '/customers/${c.id}/edit',
                            extra: c,
                          );
                          // Refresh the detail (and its score) after returning.
                          ref.invalidate(customerDetailProvider(c.id));
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ───────────────────────────── Header ───────────────────────────────

class _Header extends ConsumerWidget {
  const _Header({required this.customer, required this.t});
  final Customer customer;
  final T t;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF111827), Color(0xFF2D1F0E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 22),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                  Text(
                    t.x('cust.title_360'),
                    style: AppTypography.bodyLarge.copyWith(
                      color: Colors.white70,
                      letterSpacing: 0.5,
                    ),
                  ),
                  Builder(
                    builder: (context) {
                      final role = ref.read(authControllerProvider).user?.role;
                      final canDelete = role == UserRole.admin ||
                          role == UserRole.superadmin ||
                          role == UserRole.developer;
                      return PopupMenuButton<String>(
                        icon: const Icon(Icons.more_vert, color: Colors.white),
                        onSelected: (value) {
                          if (value == 'edit') {
                            context.push(
                              '/customers/${customer.id}/edit',
                              extra: customer,
                            );
                          } else if (value == 'delete') {
                            _confirmDelete(context, ref, customer);
                          }
                        },
                        itemBuilder: (context) => [
                          const PopupMenuItem(
                            value: 'edit',
                            child: ListTile(
                              leading: Icon(Icons.edit_outlined),
                              title: Text('Edit Profile'),
                              contentPadding: EdgeInsets.zero,
                            ),
                          ),
                          if (canDelete)
                            const PopupMenuItem(
                              value: 'delete',
                              child: ListTile(
                                leading:
                                    Icon(Icons.delete_outline, color: AppColors.danger),
                                title: Text('Delete Customer',
                                    style: TextStyle(color: AppColors.danger),),
                                contentPadding: EdgeInsets.zero,
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                ],
              ),
              const SizedBox(height: 6),
              _PhotoOrInitials(customer: customer, size: 86),
              const SizedBox(height: 12),
              Text(
                customer.name,
                style: AppTypography.heroLabel.copyWith(
                  color: Colors.white,
                  fontSize: 20,
                ),
              ),
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    customer.customerCode,
                    style: AppTypography.body.copyWith(
                      color: Colors.white60,
                      fontFamily: 'monospace',
                    ),
                  ),
                  const SizedBox(width: 10),
                  AppBadge(
                    label: customer.status,
                    kind: _badgeForStatus(customer.status),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    Customer customer,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Customer'),
        content: Text(
          'Delete ${customer.name}? This cannot be undone from the app. '
          'Customers with an open loan cannot be deleted.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(customerRepositoryProvider).delete(customer.id);
      ref.invalidate(customerListProvider);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Customer deleted')),
      );
      context.go('/customers');
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  BadgeKind _badgeForStatus(String s) {
    switch (s) {
      case 'active':
        return BadgeKind.active;
      case 'suspended':
      case 'blacklisted':
        return BadgeKind.overdue;
      case 'pending_review':
      case 'pending':
        return BadgeKind.pending;
      default:
        return BadgeKind.info;
    }
  }
}

class _PhotoOrInitials extends ConsumerWidget {
  const _PhotoOrInitials({required this.customer, this.size = 80});
  final Customer customer;
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Server returns a relative /api/files/... path — authedImage absolutizes
    // it and attaches the Bearer token the /api/files route requires.
    final url = customer.photoUrl ?? '';
    if (url.isNotEmpty) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white24, width: 2),
          image: DecorationImage(
            image: authedImage(ref, url),
            fit: BoxFit.cover,
          ),
        ),
      );
    }
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.primary,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white24, width: 2),
      ),
      alignment: Alignment.center,
      child: Text(
        customer.initials,
        style: AppTypography.heroNumber.copyWith(
          color: Colors.white,
          fontSize: size * 0.38,
        ),
      ),
    );
  }
}

// ───────────────────────────── Quick contact ────────────────────────

class _QuickContact extends ConsumerWidget {
  const _QuickContact({required this.customer, required this.t});
  final Customer customer;
  final T t;

  Future<void> _launch(Uri uri) async {
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Row(
        children: [
          Expanded(
            child: _ContactBtn(
              icon: Icons.call_rounded,
              label: t.x('cust.call'),
              color: AppColors.success,
              onTap: () => _launch(Uri(scheme: 'tel', path: customer.phone)),
            ),
          ),
          Expanded(
            child: _ContactBtn(
              icon: Icons.chat_bubble_outline_rounded,
              label: t.x('cust.message'),
              color: AppColors.info,
              onTap: () => _launch(Uri(scheme: 'sms', path: customer.phone)),
            ),
          ),
          Expanded(
            child: _ContactBtn(
              icon: Icons.send_rounded,
              label: t.x('cust.whatsapp'),
              color: const Color(0xFF25D366),
              onTap: () => _launch(
                Uri.parse('https://wa.me/${_digits(customer.phone)}'),
              ),
            ),
          ),
          if (customer.address != null && customer.address!.isNotEmpty)
            Expanded(
              child: _ContactBtn(
                icon: Icons.directions_rounded,
                label: t.x('cust.directions'),
                color: AppColors.warning,
                onTap: () => _launch(
                  Uri.parse(
                    'https://www.google.com/maps/search/?api=1&query=${Uri.encodeQueryComponent(customer.address!)}',
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  String _digits(String s) => s.replaceAll(RegExp(r'\D'), '');
}

class _ContactBtn extends StatelessWidget {
  const _ContactBtn({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        child: Column(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color.withAlpha(36),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: AppTypography.caption.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

// ───────────────────────────── Risk card ────────────────────────────

class _RiskCard extends StatelessWidget {
  const _RiskCard({required this.customer, required this.t});
  final Customer customer;
  final T t;

  ({String label, Color color, Color bg}) _band(CreditScore? cs) {
    if (cs == null || !cs.rated) {
      return (
        label: t.x('cust.risk_unrated'),
        color: AppColors.textLight,
        bg: AppColors.background
      );
    }
    final s = cs.score;
    if (s < 500) {
      return (label: cs.grade, color: AppColors.danger, bg: AppColors.dangerBg);
    }
    if (s < 650) {
      return (
        label: cs.grade,
        color: AppColors.warning,
        bg: AppColors.warningBg
      );
    }
    if (s < 750) {
      return (
        label: cs.grade,
        color: const Color(0xFFEAB308),
        bg: AppColors.warningBg
      );
    }
    return (label: cs.grade, color: AppColors.success, bg: AppColors.successBg);
  }

  @override
  Widget build(BuildContext context) {
    final cs = customer.creditScore;
    final band = _band(cs);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(t.x('cust.risk_score'), style: AppTypography.sectionTitle),
              const Icon(Icons.info_outline,
                  color: AppColors.textLight, size: 18),
            ],
          ),
          const SizedBox(height: 32),
          _ScoreMeter(
            score: cs?.score ?? 0,
            grade: band.label,
            color: band.color,
            isRated: cs?.rated ?? false,
          ),
          const SizedBox(height: 24),
          Text(
            _explainer(cs),
            style: AppTypography.caption,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  String _explainer(CreditScore? cs) {
    if (cs == null || !cs.rated) return t.x('cust.risk_explainer_none');
    if (cs.score >= 680) return t.x('cust.risk_explainer_low');
    if (cs.score >= 560) return t.x('cust.risk_explainer_medium');
    return t.x('cust.risk_explainer_high');
  }
}

class _ScoreMeter extends StatelessWidget {
  const _ScoreMeter({
    required this.score,
    required this.grade,
    required this.color,
    required this.isRated,
  });

  final int score;
  final String grade;
  final Color color;
  final bool isRated;

  @override
  Widget build(BuildContext context) {
    if (!isRated) {
      return Column(
        children: [
          const Icon(Icons.speed_rounded, size: 48, color: AppColors.textLight),
          const SizedBox(height: 12),
          Text(
            grade.toUpperCase(),
            style: AppTypography.caption.copyWith(
                color: AppColors.textLight, fontWeight: FontWeight.w800),
          ),
        ],
      );
    }

    return Column(
      children: [
        SizedBox(
          width: 180,
          height: 90,
          child: CustomPaint(
            painter: _ScoreMeterPainter(score: score),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          grade.toUpperCase(),
          style: AppTypography.caption
              .copyWith(color: color, fontWeight: FontWeight.w800),
        ),
      ],
    );
  }
}

class _ScoreMeterPainter extends CustomPainter {
  _ScoreMeterPainter({required this.score});
  final int score;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(0, 0, size.width, size.height * 2);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..strokeCap = StrokeCap.butt;

    // Draw arcs
    paint.color = AppColors.danger;
    canvas.drawArc(rect, math.pi, math.pi * 0.36, false, paint);

    paint.color = AppColors.warning;
    canvas.drawArc(
        rect, math.pi + (math.pi * 0.36), math.pi * 0.27, false, paint);

    paint.color = AppColors.success;
    canvas.drawArc(
        rect, math.pi + (math.pi * 0.63), math.pi * 0.37, false, paint);

    // Calc pct for indicator
    final double pct = ((score - 300) / (850 - 300)).clamp(0.0, 1.0);
    final angle = math.pi + (math.pi * pct);
    final radius = size.width / 2;
    final center = Offset(size.width / 2, size.height);

    final indicatorX = center.dx + radius * math.cos(angle);
    final indicatorY = center.dy + radius * math.sin(angle);

    // Draw the white circle with colored border
    final indicatorPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;
    canvas.drawCircle(Offset(indicatorX, indicatorY), 10, indicatorPaint);

    final Color currentColor = pct < 0.36
        ? AppColors.danger
        : (pct < 0.63 ? AppColors.warning : AppColors.success);
    final borderPaint = Paint()
      ..color = currentColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4;
    canvas.drawCircle(Offset(indicatorX, indicatorY), 10, borderPaint);

    // Texts
    final textPainter300 = TextPainter(
      text: const TextSpan(
          text: '300',
          style: TextStyle(
              color: AppColors.textLight,
              fontSize: 11,
              fontWeight: FontWeight.bold)),
      textDirection: ui.TextDirection.ltr,
    )..layout();
    textPainter300.paint(canvas, Offset(0, size.height + 8));

    final textPainter850 = TextPainter(
      text: const TextSpan(
          text: '850',
          style: TextStyle(
              color: AppColors.textLight,
              fontSize: 11,
              fontWeight: FontWeight.bold)),
      textDirection: ui.TextDirection.ltr,
    )..layout();
    textPainter850.paint(
        canvas, Offset(size.width - textPainter850.width, size.height + 8));

    // Main Score
    final scorePainter = TextPainter(
      text: TextSpan(
          text: '$score',
          style: const TextStyle(
              color: Color(0xFF111827),
              fontSize: 36,
              fontWeight: FontWeight.w900)),
      textDirection: ui.TextDirection.ltr,
    )..layout();
    scorePainter.paint(
        canvas,
        Offset(center.dx - scorePainter.width / 2,
            size.height - scorePainter.height + 6));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

// ───────────────────────────── KPI strip ────────────────────────────

class _KpiStrip extends ConsumerWidget {
  const _KpiStrip({required this.customer, required this.t});
  final Customer customer;
  final T t;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fmt = ref.watch(currencyFmtProvider);
    final all = customer.loans;
    final active = all.where((l) => l.status == 'active').toList();
    final totalBorrowed = all.fold<double>(0, (s, l) => s + l.principal);
    final outstanding = active.fold<double>(0, (s, l) => s + l.principal);

    return Row(
      children: [
        Expanded(
          child: _Kpi(
            icon: Icons.south_west_rounded,
            color: AppColors.danger,
            label: t.x('cust.total_borrowed'),
            value: fmt.format(totalBorrowed),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _Kpi(
            icon: Icons.payments_outlined,
            color: AppColors.warning,
            label: t.x('loan.outstanding'),
            value: fmt.format(outstanding),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _Kpi(
            icon: Icons.list_alt_rounded,
            color: AppColors.info,
            label: t.x('cust.loans_tab'),
            value: '${all.length}',
          ),
        ),
      ],
    );
  }
}

class _Kpi extends StatelessWidget {
  const _Kpi({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
  });
  final IconData icon;
  final Color color;
  final String label, value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: color.withAlpha(36),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 16),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.bodyLarge.copyWith(fontSize: 14),
          ),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}

// ───────────────────────────── Loans ────────────────────────────────

class _LoansSection extends ConsumerWidget {
  const _LoansSection({required this.customer, required this.t});
  final Customer customer;
  final T t;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (customer.loans.isEmpty) {
      return _Card(
        title: t.x('cust.loans_tab'),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Row(
            children: [
              const Icon(Icons.info_outline,
                  color: AppColors.textLight, size: 18),
              const SizedBox(width: 8),
              Text(
                t.x('cust.no_loans_yet'),
                style: const TextStyle(color: AppColors.textLight),
              ),
            ],
          ),
        ),
      );
    }

    final fmt = ref.watch(currencyFmtProvider);
    return _Card(
      title: t.x('cust.loans_tab'),
      trailing: Text(
        '${customer.loans.length}',
        style: AppTypography.caption,
      ),
      child: Column(
        children: [
          for (final l in customer.loans) ...[
            _LoanRow(loan: l, fmt: fmt),
            if (l != customer.loans.last)
              const Divider(height: 1, color: AppColors.border),
          ],
        ],
      ),
    );
  }
}

class _LoanRow extends StatelessWidget {
  const _LoanRow({required this.loan, required this.fmt});
  final CustomerLoanSummary loan;
  final NumberFormat fmt;

  Color get _statusColor {
    switch (loan.status) {
      case 'active':
        return AppColors.success;
      case 'overdue':
        return AppColors.danger;
      case 'closed':
        return AppColors.info;
      case 'pending_review':
      case 'pending':
        return AppColors.warning;
      default:
        return AppColors.textLight;
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.go('/loans/${loan.id}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: _statusColor.withAlpha(36),
                borderRadius: BorderRadius.circular(10),
              ),
              alignment: Alignment.center,
              child: Icon(
                Icons.receipt_long_outlined,
                color: _statusColor,
                size: 18,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    loan.loanCode ?? loan.id.substring(0, 8),
                    style: AppTypography.bodyLarge,
                  ),
                  Text(
                    loan.status.toUpperCase(),
                    style: AppTypography.tiny.copyWith(color: _statusColor),
                  ),
                ],
              ),
            ),
            Text(fmt.format(loan.principal), style: AppTypography.bodyLarge),
            const SizedBox(width: 6),
            const Icon(Icons.chevron_right, color: AppColors.textLight),
          ],
        ),
      ),
    );
  }
}

// ───────────────────────────── Identity / KYC ───────────────────────

/// The customer's stored location — captured (or last-known-fallback) at
/// creation time — regardless of whether the viewer's device has a live GPS
/// fix right now. Prefers the primary collection point, else the first one
/// with coordinates.
CustomerCollectionPoint? _primaryGpsPoint(Customer customer) {
  final withGps =
      customer.collectionPoints.where((p) => p.latitude != null && p.longitude != null);
  if (withGps.isEmpty) return null;
  return withGps.firstWhere((p) => p.isPrimary, orElse: () => withGps.first);
}

class _IdentitySection extends StatelessWidget {
  const _IdentitySection({required this.customer, required this.t});
  final Customer customer;
  final T t;

  @override
  Widget build(BuildContext context) {
    return _Card(
      title: t.x('cust.profile'),
      child: Column(
        children: [
          _IdRow(
            icon: Icons.phone_outlined,
            label: t.x('fld.phone'),
            value: customer.phone,
          ),
          if (customer.address != null && customer.address!.isNotEmpty)
            _IdRow(
              icon: Icons.location_on_outlined,
              label: t.x('fld.address_label'),
              value: customer.address!,
            ),
          if (_primaryGpsPoint(customer) != null)
            Builder(
              builder: (context) {
                final p = _primaryGpsPoint(customer)!;
                return _IdRow(
                  icon: Icons.my_location_outlined,
                  label: 'GPS location',
                  value: 'View on map',
                  valueColor: AppColors.primary,
                  onTap: () => launchUrl(
                    Uri.parse(
                        'https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}',),
                    mode: LaunchMode.externalApplication,
                  ),
                );
              },
            ),
          if (customer.aadharNumberMasked != null)
            _IdRow(
              icon: Icons.credit_card_outlined,
              label: t.x('fld.aadhaar_label'),
              value: customer.aadharNumberMasked!,
            ),
          if (customer.kycStatus != null)
            _IdRow(
              icon: Icons.verified_user_outlined,
              label: t.x('fld.kyc'),
              value: customer.kycStatus!.toUpperCase(),
              valueColor: customer.kycStatus == 'verified'
                  ? AppColors.success
                  : AppColors.warning,
            ),
          if (customer.email != null && customer.email!.isNotEmpty)
            _IdRow(
              icon: Icons.email_outlined,
              label: t.x('fld.email'),
              value: customer.email!,
            ),
          if (customer.pan != null && customer.pan!.isNotEmpty)
            _IdRow(
              icon: Icons.badge_outlined,
              label: t.x('fld.pan'),
              value: customer.pan!,
            ),
          if (customer.routeName != null)
            _IdRow(
              icon: Icons.route_outlined,
              label: t.x('fld.route'),
              value: customer.routeName!,
            ),
          if (customer.agentName != null)
            _IdRow(
              icon: Icons.person_outline,
              label: t.x('fld.agent'),
              value: customer.agentName!,
            ),
        ],
      ),
    );
  }
}

class _IdRow extends StatelessWidget {
  const _IdRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
    this.onTap,
  });
  final IconData icon;
  final String label, value;
  final Color? valueColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final row = Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 16, color: AppColors.textSecondary),
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: 70,
            child: Text(
              label,
              style: AppTypography.caption,
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: AppTypography.bodyLarge.copyWith(color: valueColor),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
    return onTap != null ? GestureDetector(onTap: onTap, child: row) : row;
  }
}

// ───────────────────────────── Guarantors ───────────────────────────

class _GuarantorsSection extends ConsumerWidget {
  const _GuarantorsSection({required this.guarantors});
  final List<Guarantor> guarantors;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    return _Card(
      title: t.x('sec.guarantors'),
      trailing: Text('${guarantors.length}', style: AppTypography.caption),
      child: Column(
        children: [
          for (final g in guarantors)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppColors.purpleBg,
                      shape: BoxShape.circle,
                      image: g.photoUrl != null && g.photoUrl!.isNotEmpty
                          ? DecorationImage(
                              image: authedImage(ref, g.photoUrl!),
                              fit: BoxFit.cover,
                            )
                          : null,
                    ),
                    alignment: Alignment.center,
                    child: g.photoUrl != null && g.photoUrl!.isNotEmpty
                        ? null
                        : const Icon(
                            Icons.shield_outlined,
                            color: AppColors.purple,
                            size: 18,
                          ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(g.name, style: AppTypography.bodyLarge),
                        Text(
                          [
                            g.phone,
                            if (g.relation != null && g.relation!.isNotEmpty)
                              g.relation
                          ].join(' · '),
                          style: AppTypography.caption,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () async {
                      final uri = Uri(scheme: 'tel', path: g.phone);
                      if (await canLaunchUrl(uri)) {
                        await launchUrl(uri, mode: LaunchMode.externalApplication);
                      }
                    },
                    icon: const Icon(
                      Icons.call_rounded,
                      color: AppColors.success,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _CompanySection extends ConsumerWidget {
  const _CompanySection({required this.customer});
  final Customer customer;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _Card(
      title: 'Business & Employment',
      child: Column(
        children: [
          if (customer.companyLogo != null && customer.companyLogo!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image(
                      image: authedImage(ref, customer.companyLogo!),
                      width: 48,
                      height: 48,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        width: 48,
                        height: 48,
                        color: AppColors.primaryLight,
                        child: Icon(Icons.business, color: AppColors.primary),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          customer.companyName ?? '',
                          style: AppTypography.nameLg.copyWith(fontSize: 16),
                        ),
                        if (customer.designation != null &&
                            customer.designation!.isNotEmpty)
                          Text(
                            customer.designation!,
                            style: AppTypography.caption,
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          if (customer.companyLogo == null || customer.companyLogo!.isEmpty)
            _IdRow(
              icon: Icons.business_outlined,
              label: 'Company',
              value: customer.companyName ?? '—',
            ),
          if (customer.businessType != null &&
              customer.businessType!.isNotEmpty)
            _IdRow(
              icon: Icons.category_outlined,
              label: 'Business Type',
              value: customer.businessType!,
            ),
          if (customer.gstNumber != null && customer.gstNumber!.isNotEmpty)
            _IdRow(
              icon: Icons.text_snippet_outlined,
              label: 'GSTIN',
              value: customer.gstNumber!,
            ),
          if (customer.monthlyIncome != null)
            _IdRow(
              icon: Icons.currency_rupee_outlined,
              label: 'Income',
              value: '₹${customer.monthlyIncome!.toStringAsFixed(0)}',
            ),
          if (customer.companyAddress != null &&
              customer.companyAddress!.isNotEmpty)
            _IdRow(
              icon: Icons.location_on_outlined,
              label: 'Work Address',
              value: customer.companyAddress!,
            ),
        ],
      ),
    );
  }
}

class _SecurityChequesSection extends ConsumerWidget {
  const _SecurityChequesSection({required this.cheques});
  final List<SecurityCheque> cheques;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _Card(
      title: 'Security Cheques',
      trailing: Text('${cheques.length}', style: AppTypography.caption),
      child: Column(
        children: [
          for (final c in cheques)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Icon(
                      Icons.account_balance_wallet_outlined,
                      color: AppColors.primary,
                      size: 18,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Cheque #${c.chequeNumber}',
                            style: AppTypography.bodyLarge),
                        Text(
                          [
                            c.bankName,
                            if (c.amount != null)
                              '₹${c.amount!.toStringAsFixed(0)}'
                          ].join(' · '),
                          style: AppTypography.caption,
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: c.status == 'active'
                          ? AppColors.successBg
                          : AppColors.border,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      c.status.toUpperCase(),
                      style: AppTypography.tiny.copyWith(
                        color: c.status == 'active'
                            ? AppColors.success
                            : AppColors.textSecondary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ───────────────────────────── KYC docs ─────────────────────────────

bool _looksLikeImage(String url) {
  final lower = url.toLowerCase();
  return lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.heic');
}

class _KycDocsSection extends ConsumerWidget {
  const _KycDocsSection({required this.docs});
  final List<KycDocument> docs;

  void _openDoc(
      BuildContext context, WidgetRef ref, KycDocument d, String url,) {
    if (_looksLikeImage(d.url)) {
      showDialog<void>(
        context: context,
        builder: (ctx) => Dialog(
          backgroundColor: Colors.black,
          insetPadding: const EdgeInsets.all(12),
          child: Stack(
            children: [
              InteractiveViewer(
                minScale: 0.5,
                maxScale: 4,
                child: Center(
                  child: Image(
                    image: authedImage(ref, d.url),
                    errorBuilder: (_, __, ___) => const Padding(
                      padding: EdgeInsets.all(32),
                      child: Icon(Icons.broken_image_outlined,
                          color: Colors.white54, size: 48,),
                    ),
                  ),
                ),
              ),
              Positioned(
                top: 6,
                right: 6,
                child: IconButton(
                  icon: const Icon(Icons.close, color: Colors.white),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ),
            ],
          ),
        ),
      );
      return;
    }
    () async {
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    }();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final mediaBase = ref.watch(mediaBaseUrlProvider);
    return _Card(
      title: t.x('sec.kyc_docs'),
      trailing: Text('${docs.length}', style: AppTypography.caption),
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        children: [
          for (final d in docs)
            InkWell(
              onTap: () =>
                  _openDoc(context, ref, d, absoluteMediaUrl(mediaBase, d.url)),
              borderRadius: BorderRadius.circular(10),
              child: Container(
                width: 92,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: _looksLikeImage(d.url)
                          ? Image(
                              image: authedImage(ref, d.url),
                              width: 76,
                              height: 76,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                width: 76,
                                height: 76,
                                color: AppColors.surface,
                                alignment: Alignment.center,
                                child: const Icon(
                                  Icons.insert_drive_file_outlined,
                                  color: AppColors.textLight,
                                ),
                              ),
                            )
                          : Container(
                              width: 76,
                              height: 76,
                              color: AppColors.surface,
                              alignment: Alignment.center,
                              child: const Icon(
                                Icons.picture_as_pdf_outlined,
                                color: AppColors.textLight,
                                size: 28,
                              ),
                            ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      d.type.toUpperCase(),
                      style: AppTypography.tiny,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
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

// ───────────────────────────── Card shell ───────────────────────────

class _Card extends StatelessWidget {
  const _Card({required this.title, required this.child, this.trailing});
  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
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
              Expanded(
                child: Text(title, style: AppTypography.sectionTitle),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

// ───────────────────────────── Loading / Error ──────────────────────

class _LoadingDetail extends StatelessWidget {
  const _LoadingDetail();
  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          Skeleton(height: 200, borderRadius: AppTokens.radius),
          SizedBox(height: 16),
          Skeleton(height: 140, borderRadius: AppTokens.radius),
        ],
      ),
    );
  }
}

class _ErrorDetail extends ConsumerWidget {
  const _ErrorDetail({required this.message});
  final String message;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off, size: 56, color: AppColors.textLight),
              const SizedBox(height: 12),
              Text(t.x('err.could_not_load_customer'),
                  style: AppTypography.sectionTitle),
              const SizedBox(height: 6),
              Text(
                message,
                style:
                    AppTypography.body.copyWith(color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
