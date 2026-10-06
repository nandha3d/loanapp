// ignore_for_file: require_trailing_commas

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:zolofund/core/network/authed_image.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/customer.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/shared/utils/phone.dart';
import 'package:zolofund/shared/widgets/app_badge.dart';

class CustomerTile extends ConsumerWidget {
  const CustomerTile({super.key, required this.customer, required this.onTap});

  final Customer customer;
  final VoidCallback onTap;

  Color _statusColor(String status) {
    switch (status) {
      case 'active':
        return AppColors.success;
      case 'pending_review':
      case 'pending':
        return AppColors.warning;
      case 'suspended':
      case 'blacklisted':
        return AppColors.danger;
      default:
        return AppColors.primary;
    }
  }

  Future<void> _openLocation(BuildContext context, Customer c) async {
    if (c.lat != null && c.lng != null && c.lat != 0 && c.lng != 0) {
      final uri = Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=driving',
      );
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        return;
      }
    }
    final query = [
      c.name,
      if (c.address != null && c.address!.isNotEmpty) c.address,
      if (c.routeName != null && c.routeName!.isNotEmpty) c.routeName,
    ].where((s) => s != null && s.isNotEmpty).join(', ');
    final uri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=${Uri.encodeQueryComponent(query)}',
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open map navigation')),
      );
    }
  }

  Future<void> _openWhatsApp(
    BuildContext context,
    Customer c,
    String countryCode,
  ) async {
    if (c.phone.isEmpty) return;
    final phone = whatsappNumber(c.phone, countryCode);
    final text = Uri.encodeComponent(
      'Namaste ${c.name}, greeting from ZoloFund.',
    );
    final uri = Uri.parse('https://wa.me/$phone?text=$text');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open WhatsApp')),
      );
    }
  }

  Future<void> _callCustomer(Customer c) async {
    if (c.phone.isEmpty) return;
    final uri = Uri(scheme: 'tel', path: c.phone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final user = ref.watch(authControllerProvider).user;
    final isChit = AppType.userIsChit(user);
    final cs = customer.creditScore;
    // CUST-01 (D7): server figures for loans not closed (active/overdue) —
    // principal, not outstanding.
    final activePrincipal = customer.activeLoanPrincipal;
    final loansCount = customer.activeLoanCount;
    final statusAccent = _statusColor(customer.status);

    final snippets = <Widget>[
      _InfoSnippet(
        icon: Icons.speed_rounded,
        label: t.x('cust.risk_score'),
        value: (cs != null && cs.rated) ? '${cs.score}' : '—',
        valueColor: _scoreColor(cs?.score ?? 0),
      ),
      if (!isChit) ...[
        _InfoSnippet(
          icon: Icons.account_balance_wallet_outlined,
          label: t.x('cust.active_principal'),
          value: ref.watch(currencyFmtProvider).format(activePrincipal),
          valueColor:
              activePrincipal > 0 ? AppColors.textPrimary : AppColors.textLight,
        ),
        _InfoSnippet(
          icon: Icons.receipt_long_outlined,
          label: t.x('dash.active_loans'),
          value: '$loansCount',
          valueColor: AppColors.textPrimary,
        ),
      ],
    ];
    // CUST-03: phone beside the code, as on web.
    final codeText = Text(
      customer.phone.isEmpty
          ? customer.customerCode
          : '${customer.customerCode} · ${customer.phone}',
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: AppTypography.caption.copyWith(
        fontFamily: 'monospace',
        color: AppColors.textLight,
        fontSize: 11,
      ),
    );
    final routeBadge = customer.routeName == null
        ? null
        : Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
            decoration: BoxDecoration(
              color: AppColors.primary.withAlpha(20),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              customer.routeName!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.tiny.copyWith(
                color: AppColors.primaryDark,
                fontWeight: FontWeight.w600,
                fontSize: 10,
              ),
            ),
          );

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.border,
          width: 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(8),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
          BoxShadow(
            color: Colors.black.withAlpha(3),
            blurRadius: 2,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    _Avatar(
                      initials: customer.initials,
                      size: 44,
                      image: (customer.photoUrl != null &&
                              customer.photoUrl!.isNotEmpty)
                          ? authedImage(ref, customer.photoUrl!)
                          : null,
                      statusColor: statusAccent,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            customer.name,
                            style: AppTypography.bodyLarge.copyWith(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              Flexible(child: codeText),
                              if (customer.routeName != null && !isChit) ...[
                                const SizedBox(width: 6),
                                Flexible(child: routeBadge!),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 6),
                    _CardActionIcon(
                      tooltip: 'Location / Navigation',
                      icon: Icons.near_me_rounded,
                      iconColor: const Color(0xFF2563EB),
                      bgColor: const Color(0xFFEFF6FF),
                      hasCoords: customer.lat != null && customer.lng != null,
                      onTap: () => _openLocation(context, customer),
                    ),
                    if (customer.phone.isNotEmpty) ...[
                      const SizedBox(width: 5),
                      _CardActionIcon(
                        tooltip: 'WhatsApp',
                        icon: Icons.chat_bubble_outline_rounded,
                        iconColor: const Color(0xFF16A34A),
                        bgColor: const Color(0xFFF0FDF4),
                        onTap: () => _openWhatsApp(
                          context,
                          customer,
                          user?.phoneCountryCode ?? '91',
                        ),
                      ),
                      const SizedBox(width: 5),
                      _CardActionIcon(
                        tooltip: 'Call customer',
                        icon: Icons.call_rounded,
                        iconColor: AppColors.success,
                        bgColor: const Color(0xFFECFDF5),
                        onTap: () => _callCustomer(customer),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        children: snippets,
                      ),
                    ),
                    const SizedBox(width: 6),
                    AppBadge(
                      label: customer.status,
                      kind: _kindFor(customer.status),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // Same bands as web (CUST-03): ≥750 green, ≥650 amber, else red; unrated grey.
  Color _scoreColor(int score) {
    if (score == 0) return AppColors.textLight;
    if (score < 650) return AppColors.danger;
    if (score < 750) return AppColors.warning;
    return AppColors.success;
  }

  BadgeKind _kindFor(String status) {
    switch (status) {
      case 'active':
        return BadgeKind.active;
      case 'pending_review':
      case 'pending':
        return BadgeKind.pending;
      case 'suspended':
      case 'blacklisted':
        return BadgeKind.overdue;
      default:
        return BadgeKind.info;
    }
  }
}

class _CardActionIcon extends StatelessWidget {
  const _CardActionIcon({
    required this.icon,
    required this.iconColor,
    required this.bgColor,
    required this.onTap,
    this.tooltip,
    this.hasCoords = false,
  });

  final IconData icon;
  final Color iconColor;
  final Color bgColor;
  final VoidCallback onTap;
  final String? tooltip;
  final bool hasCoords;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip ?? '',
      child: Material(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: onTap,
          child: Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: iconColor.withAlpha(50)),
            ),
            alignment: Alignment.center,
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                Icon(icon, size: 16, color: iconColor),
                if (hasCoords)
                  Positioned(
                    top: -2,
                    right: -2,
                    child: Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: Color(0xFF2563EB),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({
    required this.initials,
    this.image,
    this.statusColor,
    this.size = 44,
  });

  final String initials;
  final ImageProvider? image;
  final Color? statusColor;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: image == null
                ? LinearGradient(
                    colors: [AppColors.primary, AppColors.primaryDark],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  )
                : null,
            image: image != null
                ? DecorationImage(image: image!, fit: BoxFit.cover)
                : null,
            boxShadow: [
              BoxShadow(
                color: (statusColor ?? AppColors.primary).withAlpha(50),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
            border: Border.all(
              color: statusColor != null
                  ? statusColor!.withAlpha(120)
                  : AppColors.primary.withAlpha(80),
              width: 1.5,
            ),
          ),
          alignment: Alignment.center,
          child: image != null
              ? null
              : Text(
                  initials.isEmpty ? '?' : initials,
                  style: AppTypography.bodyLarge.copyWith(
                    color: Colors.white,
                    fontSize: size * 0.36,
                    fontWeight: FontWeight.bold,
                  ),
                ),
        ),
        if (statusColor != null)
          Positioned(
            right: -1,
            bottom: -1,
            child: Container(
              width: 11,
              height: 11,
              decoration: BoxDecoration(
                color: statusColor,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
              ),
            ),
          ),
      ],
    );
  }
}

class _InfoSnippet extends StatelessWidget {
  const _InfoSnippet({
    required this.icon,
    required this.label,
    required this.value,
    required this.valueColor,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3.5),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(180),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppColors.border.withAlpha(100)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: AppColors.textLight),
          const SizedBox(width: 4),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: AppTypography.extraTiny.copyWith(
                  color: AppColors.textLight,
                  fontSize: 9,
                ),
              ),
              Text(
                value,
                style: AppTypography.caption.copyWith(
                  color: valueColor,
                  fontWeight: FontWeight.w700,
                  fontSize: 11.5,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
