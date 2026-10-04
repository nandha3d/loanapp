// ignore_for_file: require_trailing_commas

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:zolofund/core/network/authed_image.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/collection_entry.dart';
import 'package:zolofund/data/models/loan.dart';
import 'package:zolofund/features/collection/quick_collect_sheet.dart';

/// Auto Finance "Put Bill" card.
///
/// At a traffic signal an agent needs three things on the customer's profile
/// without scrolling: the location, phone, WhatsApp, and a box to type the cash
/// they just took. This card sits at the top of the loan detail and does exactly
/// that, handing off to the existing QuickCollectSheet for the actual write so
/// offline queueing and receipt generation stay in one place.
class QuickPutBillCard extends ConsumerStatefulWidget {
  const QuickPutBillCard({
    super.key,
    required this.loan,
    required this.dueNow,
    this.onCompleted,
  });

  final Loan loan;

  /// Overdue + today's dues, already computed by the caller.
  final double dueNow;
  final VoidCallback? onCompleted;

  @override
  ConsumerState<QuickPutBillCard> createState() => _QuickPutBillCardState();
}

class _QuickPutBillCardState extends ConsumerState<QuickPutBillCard> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String get _phone => widget.loan.customer?.phone ?? '';

  /// WhatsApp needs a country-coded number with no separators.
  String get _waNumber {
    final digits = _phone.replaceAll(RegExp(r'\D'), '');
    return digits.length == 10 ? '91$digits' : digits;
  }

  Future<void> _launch(Uri uri) async {
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Cannot open ${uri.scheme}')),
      );
    }
  }

  Future<void> _openLocation() async {
    final c = widget.loan.customer;
    if (c?.lat != null && c?.lng != null && c!.lat != 0 && c.lng != 0) {
      final uri = Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=driving',
      );
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        return;
      }
    }
    final query = [
      c?.name,
      if (c?.address != null && c!.address!.isNotEmpty) c.address,
      widget.loan.loanCode,
    ].where((s) => s != null && s.isNotEmpty).join(', ');
    final uri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=${Uri.encodeQueryComponent(query)}',
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open map navigation')),
      );
    }
  }

  /// Opens the shared collect sheet seeded with the typed amount.
  void _putBill() {
    final loan = widget.loan;
    final typed = double.tryParse(_controller.text.trim());

    // Target the oldest unpaid instalment — that is what the money settles.
    final pending = loan.instalments
        .where((i) => i.dynamicStatus != 'paid')
        .toList()
      ..sort((a, b) => a.dueDate.compareTo(b.dueDate));

    if (pending.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nothing outstanding on this account.')),
      );
      return;
    }

    final target = pending.first;
    final row = CollectionRow(
      instalmentId: target.id,
      loanId: target.loanId,
      loanCode: loan.loanCode,
      customerId: loan.customerId,
      customerName: loan.customer?.name ?? '—',
      customerCode: loan.customer?.customerCode ?? '',
      customerPhone: _phone,
      routeName: null,
      dueAmount: typed != null && typed > 0 ? typed : widget.dueNow,
      receivedAmount: target.receivedAmount,
      dueDate: target.dueDate,
      status: target.dynamicStatus,
    );

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => QuickCollectSheet(row: row, scopeRows: [row]),
    ).then((_) {
      _controller.clear();
      widget.onCompleted?.call();
    });
  }

  @override
  Widget build(BuildContext context) {
    final fmt = ref.watch(currencyFmtProvider);
    final loan = widget.loan;
    final customer = loan.customer;
    final statusAccent =
        widget.dueNow > 0 ? AppColors.danger : AppColors.success;

    final lastPaid = loan.instalments
        .where((i) => i.receivedAt != null)
        .fold<DateTime?>(null, (latest, i) {
      final at = i.receivedAt!;
      return latest == null || at.isAfter(latest) ? at : latest;
    });

    final initials = (customer?.name ?? '?').trim().isEmpty
        ? '?'
        : (customer!.name).trim()[0].toUpperCase();

    final hasCoords = customer?.lat != null &&
        customer?.lng != null &&
        customer!.lat != 0 &&
        customer.lng != 0;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(8),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
          BoxShadow(
            color: AppColors.primary.withAlpha(15),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: const Color(0xFFE2E8F0),
              width: 1.0,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: AppColors.primary.withAlpha(25),
                            border: Border.all(
                              color: statusAccent.withAlpha(120),
                              width: 1.5,
                            ),
                            image: (customer?.photoUrl != null &&
                                    customer!.photoUrl!.isNotEmpty)
                                ? DecorationImage(
                                    image: authedImage(ref, customer.photoUrl!),
                                    fit: BoxFit.cover,
                                  )
                                : null,
                          ),
                          alignment: Alignment.center,
                          child: (customer?.photoUrl != null &&
                                  customer!.photoUrl!.isNotEmpty)
                              ? null
                              : Text(
                                  initials,
                                  style: AppTypography.bodyLarge.copyWith(
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primaryDark,
                                  ),
                                ),
                        ),
                        Positioned(
                          right: -1,
                          bottom: -1,
                          child: Container(
                            width: 11,
                            height: 11,
                            decoration: BoxDecoration(
                              color: statusAccent,
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 2),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            customer?.name ?? '—',
                            style: AppTypography.bodyLarge.copyWith(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            lastPaid == null
                                ? 'No payment yet'
                                : 'Last paid ${DateFormat('dd MMM yyyy').format(lastPaid)}',
                            style: AppTypography.bodySmall.copyWith(
                              color: AppColors.textLight,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                    _BillActionIcon(
                      tooltip: 'Location / Navigation',
                      icon: Icons.near_me_rounded,
                      iconColor: const Color(0xFF2563EB),
                      bgColor: const Color(0xFFEFF6FF),
                      hasCoords: hasCoords,
                      onTap: _openLocation,
                    ),
                    if (_phone.isNotEmpty) ...[
                      const SizedBox(width: 5),
                      _BillActionIcon(
                        tooltip: 'WhatsApp',
                        icon: Icons.chat_bubble_outline_rounded,
                        iconColor: const Color(0xFF16A34A),
                        bgColor: const Color(0xFFF0FDF4),
                        onTap: () =>
                            _launch(Uri.parse('https://wa.me/$_waNumber')),
                      ),
                      const SizedBox(width: 5),
                      _BillActionIcon(
                        tooltip: 'Call',
                        icon: Icons.call_rounded,
                        iconColor: AppColors.success,
                        bgColor: const Color(0xFFECFDF5),
                        onTap: () => _launch(Uri.parse('tel:$_phone')),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 10),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: statusAccent.withAlpha(15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Due now',
                        style: AppTypography.caption.copyWith(
                          fontWeight: FontWeight.w600,
                          color: statusAccent,
                        ),
                      ),
                      Text(
                        fmt.format(widget.dueNow),
                        style: AppTypography.bodyLarge.copyWith(
                          fontWeight: FontWeight.w800,
                          color: statusAccent,
                          fontSize: 15,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 42,
                        child: TextField(
                          controller: _controller,
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          decoration: InputDecoration(
                            labelText: 'Cash collected',
                            labelStyle: const TextStyle(fontSize: 12),
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 8),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                          onSubmitted: (_) => _putBill(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      height: 42,
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                        ),
                        onPressed: _putBill,
                        icon: const Icon(Icons.receipt_long, size: 17),
                        label: const Text('Put Bill',
                            style: TextStyle(fontWeight: FontWeight.w700)),
                      ),
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
}

class _BillActionIcon extends StatelessWidget {
  const _BillActionIcon({
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
