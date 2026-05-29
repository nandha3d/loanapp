import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/customer.dart';
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
            child: Row(
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
                  IconButton(
                    icon: const Icon(Icons.more_vert, color: Colors.white),
                    onPressed: () {},
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

class _PhotoOrInitials extends StatelessWidget {
  const _PhotoOrInitials({required this.customer, this.size = 80});
  final Customer customer;
  final double size;

  @override
  Widget build(BuildContext context) {
    final url = customer.photoUrl;
    if (url != null && url.isNotEmpty) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white24, width: 2),
          image: DecorationImage(
            image: NetworkImage(url),
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
      await launchUrl(uri);
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

  // Colors mirror the web gauge (lib/creditScoreGauge.ts) on the 300–850 scale,
  // and the label is the server-provided grade — no client-side recomputation.
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
    // 300–850 mapped to a 0–1 ring, identical span to the web gauge.
    final pct = (cs == null || !cs.rated)
        ? 0.0
        : ((cs.score - 300) / (850 - 300)).clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Row(
        children: [
          SizedBox(
            width: 74,
            height: 74,
            child: Stack(
              alignment: Alignment.center,
              children: [
                CircularProgressIndicator(
                  value: pct,
                  strokeWidth: 7,
                  backgroundColor: band.bg,
                  valueColor: AlwaysStoppedAnimation<Color>(band.color),
                ),
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      (cs == null || !cs.rated) ? '—' : '${cs.score}',
                      style: AppTypography.heroLabel.copyWith(
                        fontSize: 20,
                        color: band.color,
                      ),
                    ),
                    Text(
                      '/850',
                      style: AppTypography.extraTiny.copyWith(
                        color: AppColors.textLight,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  t.x('cust.risk_score'),
                  style: AppTypography.caption.copyWith(
                    color: AppColors.textSecondary,
                    letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: band.bg,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    band.label,
                    style: AppTypography.tiny.copyWith(color: band.color),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _explainer(cs),
                  style: AppTypography.caption,
                ),
              ],
            ),
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

// ───────────────────────────── KPI strip ────────────────────────────

class _KpiStrip extends StatelessWidget {
  const _KpiStrip({required this.customer, required this.t});
  final Customer customer;
  final T t;

  @override
  Widget build(BuildContext context) {
    final fmt =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
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

class _LoansSection extends StatelessWidget {
  const _LoansSection({required this.customer, required this.t});
  final Customer customer;
  final T t;

  @override
  Widget build(BuildContext context) {
    if (customer.loans.isEmpty) {
      return _Card(
        title: t.x('cust.loans_tab'),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Row(
            children: [
              const Icon(Icons.info_outline, color: AppColors.textLight, size: 18),
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

    final fmt =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
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
  });
  final IconData icon;
  final String label, value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
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
                    decoration: const BoxDecoration(
                      color: AppColors.purpleBg,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: const Icon(
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
                        Text(g.phone, style: AppTypography.caption),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () async {
                      final uri = Uri(scheme: 'tel', path: g.phone);
                      if (await canLaunchUrl(uri)) {
                        await launchUrl(uri);
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

// ───────────────────────────── KYC docs ─────────────────────────────

class _KycDocsSection extends ConsumerWidget {
  const _KycDocsSection({required this.docs});
  final List<KycDocument> docs;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    return _Card(
      title: t.x('sec.kyc_docs'),
      trailing: Text('${docs.length}', style: AppTypography.caption),
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        children: [
          for (final d in docs)
            InkWell(
              onTap: () async {
                final uri = Uri.parse(d.url);
                if (await canLaunchUrl(uri)) {
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                }
              },
              borderRadius: BorderRadius.circular(10),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.attach_file_rounded,
                      size: 14,
                      color: AppColors.textSecondary,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      d.type.toUpperCase(),
                      style: AppTypography.caption,
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
              Text(t.x('err.could_not_load_customer'), style: AppTypography.sectionTitle),
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
