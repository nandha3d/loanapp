import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/network/authed_image.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/collection_entry.dart';
import 'package:zolofund/features/collection/collection_screen.dart';
import 'package:zolofund/features/collection/quick_collect_sheet.dart';

class CustomerMapPinData {
  const CustomerMapPinData({
    required this.customerId,
    required this.customerName,
    required this.customerCode,
    this.customerPhoto,
    this.customerPhone,
    this.routeName,
    required this.lat,
    required this.lng,
    required this.dueAmount,
    required this.collectedAmount,
    required this.outstanding,
    required this.isPaid,
    required this.isOverdue,
    this.collectionRow,
    this.customerRows,
  });

  final String customerId;
  final String customerName;
  final String customerCode;
  final String? customerPhoto;
  final String? customerPhone;
  final String? routeName;
  final double lat;
  final double lng;
  final double dueAmount;
  final double collectedAmount;
  final double outstanding;
  final bool isPaid;
  final bool isOverdue;
  final CollectionRow? collectionRow;
  final List<CollectionRow>? customerRows;

  Color get statusColor {
    if (isPaid) return const Color(0xFF10B981);
    if (isOverdue) return const Color(0xFFEF4444);
    if (outstanding > 0 || dueAmount > 0) return const Color(0xFFF59E0B);
    return const Color(0xFF9CA3AF);
  }

  String get amountText {
    if (isPaid) {
      final amt = collectedAmount > 0 ? collectedAmount : dueAmount;
      final k = amt >= 1000
          ? '${(amt / 1000).toStringAsFixed(amt % 1000 == 0 ? 0 : 1)}k'
          : amt.toStringAsFixed(0);
      return amt > 0 ? 'Paid ₹$k' : 'Paid';
    } else if (outstanding > 0) {
      final amt = outstanding;
      final k = amt >= 1000
          ? '${(amt / 1000).toStringAsFixed(amt % 1000 == 0 ? 0 : 1)}k'
          : amt.toStringAsFixed(0);
      return 'Due ₹$k';
    } else if (collectedAmount > 0) {
      final amt = collectedAmount;
      final k = amt >= 1000
          ? '${(amt / 1000).toStringAsFixed(amt % 1000 == 0 ? 0 : 1)}k'
          : amt.toStringAsFixed(0);
      return 'Paid ₹$k';
    } else {
      return '₹0';
    }
  }

  factory CustomerMapPinData.fromRows(List<CollectionRow> rows) {
    final primary = rows.first;
    final totalDue = rows.fold<double>(0, (s, r) => s + r.dueAmount);
    final totalCollected =
        rows.fold<double>(0, (s, r) => s + r.receivedAmount);
    final totalOutstanding = rows.fold<double>(0, (s, r) => s + r.outstanding);
    final isPaid = rows.every((r) => r.isResolved);
    final isOverdue =
        rows.any((r) => r.isOverdueBucket && !r.isResolved);

    return CustomerMapPinData(
      customerId: primary.customerId,
      customerName: primary.customerName,
      customerCode: primary.customerCode,
      customerPhoto: primary.customerPhoto,
      customerPhone: primary.customerPhone,
      routeName: primary.routeName,
      lat: primary.lat!,
      lng: primary.lng!,
      dueAmount: totalDue,
      collectedAmount: totalCollected,
      outstanding: totalOutstanding,
      isPaid: isPaid,
      isOverdue: isOverdue,
      collectionRow: primary,
      customerRows: rows,
    );
  }
}

class CustomerPhotoMapPin extends ConsumerWidget {
  const CustomerPhotoMapPin({
    super.key,
    required this.pin,
    this.isSelected = false,
  });

  final CustomerMapPinData pin;
  final bool isSelected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statusColor = pin.statusColor;
    final hasPhoto =
        pin.customerPhoto != null && pin.customerPhoto!.trim().isNotEmpty;
    final amountText = pin.amountText;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Photo with status ring
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white,
            border: Border.all(color: statusColor, width: 2.5),
            boxShadow: const [
              BoxShadow(
                color: Colors.black26,
                blurRadius: 4,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: ClipOval(
            child: hasPhoto
                ? Image(
                    image: authedImage(
                      ref,
                      pin.customerPhoto!,
                    ),
                    fit: BoxFit.cover,
                  )
                : Container(
                    color: statusColor.withAlpha(25),
                    alignment: Alignment.center,
                    child: Text(
                      pin.customerName.isNotEmpty
                          ? pin.customerName[0].toUpperCase()
                          : '?',
                      style: TextStyle(
                        color: statusColor,
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                      ),
                    ),
                  ),
          ),
        ),

        // Downward pointer
        CustomPaint(
          size: const Size(8, 4),
          painter: _PinPointerPainter(color: statusColor),
        ),

        const SizedBox(height: 1),

        // Compact Due/Collected Pill Tag
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(
              color: statusColor.withAlpha(150),
              width: 0.8,
            ),
            boxShadow: const [
              BoxShadow(
                color: Colors.black26,
                blurRadius: 2,
                offset: Offset(0, 1),
              ),
            ],
          ),
          child: Text(
            amountText,
            style: TextStyle(
              color: statusColor,
              fontWeight: FontWeight.w800,
              fontSize: 8.5,
              letterSpacing: 0.1,
            ),
          ),
        ),
      ],
    );
  }
}

class _PinPointerPainter extends CustomPainter {
  const _PinPointerPainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width / 2, size.height)
      ..close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_PinPointerPainter oldDelegate) =>
      oldDelegate.color != color;
}

Future<void> showCustomerMapPinSheet({
  required BuildContext context,
  required WidgetRef ref,
  required CustomerMapPinData pin,
  required NumberFormat fmt,
  required T t,
  VoidCallback? onCollectDone,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: pin.statusColor,
                    width: 2.5,
                  ),
                ),
                child: ClipOval(
                  child: pin.customerPhoto != null &&
                          pin.customerPhoto!.trim().isNotEmpty
                      ? Image(
                          image: authedImage(ref, pin.customerPhoto!),
                          fit: BoxFit.cover,
                        )
                      : Container(
                          color: pin.statusColor.withAlpha(25),
                          alignment: Alignment.center,
                          child: Text(
                            pin.customerName.isNotEmpty
                                ? pin.customerName[0].toUpperCase()
                                : '?',
                            style: TextStyle(
                              color: pin.statusColor,
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(pin.customerName, style: AppTypography.sectionTitle),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Text(
                          pin.isPaid
                              ? 'Paid today'
                              : (pin.isOverdue ? 'Overdue' : 'Due today'),
                          style: AppTypography.caption.copyWith(
                            color: pin.statusColor,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if (pin.customerCode.isNotEmpty) ...[
                          Text(' • ', style: AppTypography.caption),
                          Text(pin.customerCode, style: AppTypography.caption),
                        ],
                        if (pin.routeName != null &&
                            pin.routeName!.isNotEmpty) ...[
                          Text(' • ', style: AppTypography.caption),
                          Text(pin.routeName!, style: AppTypography.caption),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        t.x('map.due_label').toUpperCase(),
                        style: AppTypography.extraTiny.copyWith(
                          color: AppColors.textLight,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        fmt.format(
                          pin.outstanding > 0
                              ? pin.outstanding
                              : pin.dueAmount,
                        ),
                        style: AppTypography.bodyLarge.copyWith(
                          fontWeight: FontWeight.w800,
                          color: pin.isPaid
                              ? AppColors.textSecondary
                              : (pin.isOverdue
                                  ? AppColors.danger
                                  : const Color(0xFFF59E0B)),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        t.x('map.collected_label').toUpperCase(),
                        style: AppTypography.extraTiny.copyWith(
                          color: AppColors.textLight,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        fmt.format(pin.collectedAmount),
                        style: AppTypography.bodyLarge.copyWith(
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF10B981),
                        ),
                      ),
                    ],
                  ),
                ),
                if (pin.outstanding > 0 && pin.collectedAmount > 0)
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'TOTAL DUE',
                          style: AppTypography.extraTiny.copyWith(
                            color: AppColors.textLight,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          fmt.format(pin.dueAmount),
                          style: AppTypography.bodyLarge.copyWith(
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              if (pin.customerPhone != null &&
                  pin.customerPhone!.trim().isNotEmpty) ...[
                OutlinedButton.icon(
                  icon: const Icon(Icons.phone_rounded, size: 16),
                  label: const Text('Call'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 12,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                    ),
                  ),
                  onPressed: () async {
                    final uri = Uri.parse('tel:${pin.customerPhone}');
                    if (await canLaunchUrl(uri)) {
                      await launchUrl(uri);
                    }
                  },
                ),
                const SizedBox(width: 8),
              ],
              OutlinedButton.icon(
                icon: const Icon(
                  Icons.directions_rounded,
                  size: 16,
                  color: Color(0xFF2563EB),
                ),
                label: Text(
                  t.x('map.directions'),
                  style: const TextStyle(
                    color: Color(0xFF2563EB),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  side: const BorderSide(color: Color(0xFF2563EB)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                  ),
                ),
                onPressed: () async {
                  final url = Uri.parse(
                    'https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}',
                  );
                  if (await canLaunchUrl(url)) {
                    await launchUrl(url, mode: LaunchMode.externalApplication);
                  }
                },
              ),
              const SizedBox(width: 8),
              if (pin.collectionRow != null && !pin.isPaid)
                Expanded(
                  child: FilledButton.icon(
                    icon: const Icon(Icons.payments_rounded, size: 16),
                    label: const Text('Collect'),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius:
                            BorderRadius.circular(AppTokens.radiusSm),
                      ),
                    ),
                    onPressed: () async {
                      Navigator.pop(ctx);
                      await showModalBottomSheet<void>(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Colors.transparent,
                        builder: (_) => QuickCollectSheet(
                          row: pin.collectionRow!,
                          scopeRows: pin.customerRows,
                        ),
                      );
                      ref.invalidate(collectionDashboardProvider);
                      onCollectDone?.call();
                    },
                  ),
                ),
            ],
          ),
        ],
      ),
    ),
  );
}
