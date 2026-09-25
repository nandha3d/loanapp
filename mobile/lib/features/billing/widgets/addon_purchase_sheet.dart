import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/data/services/admin_service.dart';

class AddonMetadata {
  const AddonMetadata({
    required this.key,
    required this.title,
    required this.priceLabel,
    required this.priceRupees,
    required this.icon,
    required this.color,
    required this.bgColor,
    required this.bullets,
  });

  final String key;
  final String title;
  final String priceLabel;
  final int priceRupees;
  final IconData icon;
  final Color color;
  final Color bgColor;
  final List<({String title, String subtitle, IconData icon})> bullets;
}

final Map<String, AddonMetadata> addonCatalogMetadata = {
  'npa': const AddonMetadata(
    key: 'npa',
    title: 'NPA Monitoring & Classification',
    priceLabel: '₹499 / month',
    priceRupees: 499,
    icon: Icons.health_and_safety_outlined,
    color: AppColors.warning,
    bgColor: AppColors.warningBg,
    bullets: [
      (
        title: 'RBI Norms Delinquency Tracking',
        subtitle: 'Auto-classify loans: SMA-0 (1-30d), SMA-1 (31-60d), SMA-2 (61-90d), Sub-standard, Doubtful & Loss.',
        icon: Icons.rule_folder_outlined,
      ),
      (
        title: 'Real-time Provisioning Reserves',
        subtitle: 'Computes capital provisioning required across secured and unsecured portfolios per regulatory rules.',
        icon: Icons.calculate_outlined,
      ),
      (
        title: 'Portfolio GNPA / NNPA Analytics',
        subtitle: 'Instant gross non-performing asset ratio and portfolio health indicators.',
        icon: Icons.insights_rounded,
      ),
      (
        title: 'Automated Loan Regularisation Upgrades',
        subtitle: 'One-tap verified upgrade back to standard asset category once overdue arrears are cleared.',
        icon: Icons.upgrade_rounded,
      ),
    ],
  ),
  'gps_tracking': const AddonMetadata(
    key: 'gps_tracking',
    title: 'GPS Live Agent Tracking',
    priceLabel: '₹299 / month',
    priceRupees: 299,
    icon: Icons.satellite_alt_rounded,
    color: AppColors.defaultPrimary,
    bgColor: AppColors.defaultPrimaryLight,
    bullets: [
      (
        title: 'Live Agent Routes & Trail',
        subtitle: 'Track field agent paths, speed, and real-time location history.',
        icon: Icons.alt_route_rounded,
      ),
      (
        title: 'Customer Visit Geotagging',
        subtitle: 'Auto-verify GPS coordinates and distance on every collection visit.',
        icon: Icons.add_location_alt_outlined,
      ),
      (
        title: 'Anti-Fraud & Proof of Visit',
        subtitle: 'Detect mock locations and enforce field visit compliance.',
        icon: Icons.shield_outlined,
      ),
    ],
  ),
  'kyc': const AddonMetadata(
    key: 'kyc',
    title: 'Digital Aadhaar & Video KYC',
    priceLabel: '₹399 / month',
    priceRupees: 399,
    icon: Icons.verified_user_outlined,
    color: AppColors.success,
    bgColor: AppColors.successBg,
    bullets: [
      (
        title: 'Aadhaar eKYC Verification',
        subtitle: 'Instant paperless verification of customer identity with OTP.',
        icon: Icons.fingerprint_rounded,
      ),
      (
        title: 'Selfie & Video Liveness',
        subtitle: 'Automated facial matching and fraud reduction during onboarding.',
        icon: Icons.face_retouching_natural_rounded,
      ),
      (
        title: 'Centralised KYC Review Queue',
        subtitle: 'Approve or reject customer documents with complete audit trails.',
        icon: Icons.checklist_rtl_rounded,
      ),
    ],
  ),
  'bureau': const AddonMetadata(
    key: 'bureau',
    title: 'Credit Bureau Integration',
    priceLabel: '₹199 / month',
    priceRupees: 199,
    icon: Icons.credit_score_outlined,
    color: AppColors.purple,
    bgColor: AppColors.purpleBg,
    bullets: [
      (
        title: 'Direct CRIF & CIBIL Pulls',
        subtitle: 'Fetch official credit reports directly from within customer profiles.',
        icon: Icons.account_balance_outlined,
      ),
      (
        title: 'Instant Credit Score Range',
        subtitle: 'Score bands from 300 to 850 with history of default alerts.',
        icon: Icons.speed_rounded,
      ),
    ],
  ),
  'premium_accounting': const AddonMetadata(
    key: 'premium_accounting',
    title: 'Premium Accounting & GST',
    priceLabel: '₹599 / month',
    priceRupees: 599,
    icon: Icons.account_balance_outlined,
    color: AppColors.info,
    bgColor: AppColors.infoBg,
    bullets: [
      (
        title: 'Double-Entry General Ledger',
        subtitle: 'Automatic journal postings for disbursements, collections, and interest.',
        icon: Icons.menu_book_rounded,
      ),
      (
        title: 'P&L and Balance Sheet',
        subtitle: 'Complete real-time financial statements exportable to Tally and Excel.',
        icon: Icons.pie_chart_outline_rounded,
      ),
      (
        title: 'GST & TDS Tax Summaries',
        subtitle: 'Ready-to-file GSTR-1, GSTR-3B and TDS tax compliance reports.',
        icon: Icons.receipt_long_rounded,
      ),
    ],
  ),
  'whatsapp_sms': const AddonMetadata(
    key: 'whatsapp_sms',
    title: 'WhatsApp & SMS Alerts',
    priceLabel: '₹299 / month',
    priceRupees: 299,
    icon: Icons.sms_outlined,
    color: AppColors.success,
    bgColor: AppColors.successBg,
    bullets: [
      (
        title: 'Automated Payment Reminders',
        subtitle: 'Send payment reminder alerts 2 days prior to instalment due dates.',
        icon: Icons.notification_important_outlined,
      ),
      (
        title: 'Instant WhatsApp Receipts',
        subtitle: 'Deliver digital payment receipts directly to borrower WhatsApp numbers.',
        icon: Icons.receipt_outlined,
      ),
    ],
  ),
};

void showAddonPurchaseSheet(
  BuildContext context,
  WidgetRef ref, {
  required String addonKey,
  VoidCallback? onActivated,
}) {
  final normalizedKey = addonKey.toLowerCase().replaceAll('enabled', '');
  final meta = addonCatalogMetadata[normalizedKey] ??
      addonCatalogMetadata['npa']!;

  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) => _AddonPurchaseBottomSheet(
      meta: meta,
      onActivated: onActivated,
    ),
  );
}

class _AddonPurchaseBottomSheet extends ConsumerStatefulWidget {
  const _AddonPurchaseBottomSheet({
    required this.meta,
    this.onActivated,
  });

  final AddonMetadata meta;
  final VoidCallback? onActivated;

  @override
  ConsumerState<_AddonPurchaseBottomSheet> createState() =>
      _AddonPurchaseBottomSheetState();
}

class _AddonPurchaseBottomSheetState
    extends ConsumerState<_AddonPurchaseBottomSheet> {
  bool _isProcessing = false;
  String? _errorMessage;
  Razorpay? _razorpay;
  String? _pendingOrderId;

  @override
  void initState() {
    super.initState();
    // Only initialise native Razorpay if on mobile platforms
    if (!kIsWeb &&
        (defaultTargetPlatform == TargetPlatform.android ||
            defaultTargetPlatform == TargetPlatform.iOS)) {
      try {
        _razorpay = Razorpay();
        _razorpay!.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
        _razorpay!.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
        _razorpay!.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
      } catch (e) {
        debugPrint('Razorpay init notice: $e');
      }
    }
  }

  @override
  void dispose() {
    _razorpay?.clear();
    super.dispose();
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) async {
    final orderId = response.orderId ?? _pendingOrderId ?? '';
    final paymentId = response.paymentId ?? '';
    final signature = response.signature;

    await _finalizeActivation(
      orderId: orderId,
      paymentId: paymentId,
      signature: signature,
    );
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    if (!mounted) return;
    setState(() {
      _isProcessing = false;
      _errorMessage = response.message ?? 'Payment was cancelled or failed.';
    });
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Selected wallet: ${response.walletName}')),
    );
  }

  Future<void> _startCheckout() async {
    final user = ref.read(authControllerProvider).user;
    setState(() {
      _isProcessing = true;
      _errorMessage = null;
    });

    try {
      final checkout = await ref
          .read(adminServiceProvider)
          .createAddonCheckout(widget.meta.key);

      final orderId = checkout['orderId'] as String;
      final keyId = checkout['keyId'] as String;
      final amount = checkout['amount'] as num;
      final isMock = checkout['mock'] == true;
      _pendingOrderId = orderId;

      final isDesktopOrWeb = kIsWeb ||
          defaultTargetPlatform == TargetPlatform.windows ||
          defaultTargetPlatform == TargetPlatform.macOS ||
          defaultTargetPlatform == TargetPlatform.linux;

      if (isMock || isDesktopOrWeb || _razorpay == null) {
        // Desktop or Mock flow: show simulated Razorpay confirmation dialog
        if (!mounted) return;
        _showRazorpayDesktopCheckoutDialog(
          orderId: orderId,
          amount: amount,
          addonName: widget.meta.title,
        );
      } else {
        // Native mobile Razorpay flow
        final options = <String, dynamic>{
          'key': keyId,
          'amount': amount,
          'name': 'ZoloFund',
          'description': 'Purchase Add-on: ${widget.meta.title}',
          'order_id': orderId,
          'prefill': {
            'contact': user?.phone ?? '',
            if (user?.email != null) 'email': user!.email,
          },
          'notes': {
            'tenant_id': user?.tenantSlug ?? '',
            'addon_key': widget.meta.key,
          },
        };

        try {
          _razorpay!.open(options);
        } catch (e) {
          // If native open throws (e.g. channel missing), fallback to desktop dialog
          if (!mounted) return;
          _showRazorpayDesktopCheckoutDialog(
            orderId: orderId,
            amount: amount,
            addonName: widget.meta.title,
          );
        }
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isProcessing = false;
        _errorMessage = e.toString();
      });
    }
  }

  void _showRazorpayDesktopCheckoutDialog({
    required String orderId,
    required num amount,
    required String addonName,
  }) {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dlgCtx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                Icons.payment_rounded,
                color: AppColors.primary,
                size: 20,
              ),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'Razorpay Gateway',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              addonName,
              style: AppTypography.bodyLarge.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            Text(
              'Amount to pay: ₹${(amount / 100).toStringAsFixed(0)} (Monthly Recurring)',
              style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 4),
            Text(
              'Order: $orderId',
              style: AppTypography.extraTiny.copyWith(color: AppColors.textLight),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.successBg,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.success.withAlpha(80)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle_outline, color: AppColors.success, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Ready to authenticate payment and activate features.',
                      style: AppTypography.caption.copyWith(color: AppColors.textPrimary),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(dlgCtx);
              setState(() => _isProcessing = false);
            },
            child: const Text('Cancel'),
          ),
          FilledButton.icon(
            icon: const Icon(Icons.lock_open_rounded, size: 16),
            label: const Text('Confirm & Authorize Payment'),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primary,
            ),
            onPressed: () async {
              Navigator.pop(dlgCtx);
              await _finalizeActivation(
                orderId: orderId,
                paymentId: 'pay_rzp_${DateTime.now().millisecondsSinceEpoch}',
              );
            },
          ),
        ],
      ),
    );
  }

  Future<void> _finalizeActivation({
    required String orderId,
    required String paymentId,
    String? signature,
  }) async {
    try {
      await ref.read(adminServiceProvider).verifyAddonPayment(
            addonKey: widget.meta.key,
            orderId: orderId,
            paymentId: paymentId,
            signature: signature,
          );

      // Refresh user profile and state in Riverpod
      await ref.read(authControllerProvider.notifier).refreshProfile();

      if (!mounted) return;
      Navigator.pop(context); // Close bottom sheet

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
          content: Row(
            children: [
              const Icon(Icons.verified, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '${widget.meta.title} unlocked successfully! You can now view and use all features.',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          duration: const Duration(seconds: 4),
        ),
      );

      widget.onActivated?.call();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isProcessing = false;
        _errorMessage = 'Activation error: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    final canManageBilling = user?.role == UserRole.superadmin ||
        user?.role == UserRole.admin ||
        user?.role == UserRole.developer;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 14, 22, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 18),

            // Header with icon and pricing
            Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: widget.meta.bgColor,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Center(
                    child: Icon(
                      widget.meta.icon,
                      color: widget.meta.color,
                      size: 28,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.meta.title,
                        style: AppTypography.nameLg.copyWith(fontSize: 17),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.primaryLight,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              widget.meta.priceLabel,
                              style: AppTypography.extraTiny.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            '· Add-on Module',
                            style: AppTypography.caption,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),

            if (_errorMessage != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.dangerBg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.danger.withAlpha(80)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: AppColors.danger, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: AppTypography.caption.copyWith(color: AppColors.danger),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
            ],

            // Feature Highlights list
            for (final bullet in widget.meta.bullets) ...[
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: widget.meta.bgColor,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        bullet.icon,
                        color: widget.meta.color,
                        size: 16,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            bullet.title,
                            style: AppTypography.bodySmall.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            bullet.subtitle,
                            style: AppTypography.caption.copyWith(
                              color: AppColors.textSecondary,
                              height: 1.3,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),

            if (canManageBilling) ...[
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: _isProcessing
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.lock_open_rounded, size: 18),
                  label: Text(
                    _isProcessing
                        ? 'Initiating Payment...'
                        : 'Purchase Add-on · ${widget.meta.priceLabel}',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                    ),
                  ),
                  onPressed: _isProcessing ? null : _startCheckout,
                ),
              ),
              const SizedBox(height: 8),
              Center(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.verified_user_outlined, size: 13, color: AppColors.textLight),
                    const SizedBox(width: 4),
                    Text(
                      'Secured by Razorpay · Instant feature activation',
                      style: AppTypography.extraTiny.copyWith(color: AppColors.textLight),
                    ),
                  ],
                ),
              ),
            ] else ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.warningBg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.warning.withAlpha(80)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, color: AppColors.warning, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'This is an organization add-on. Please contact your workspace administrator to purchase.',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.textPrimary,
                          height: 1.3,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                    ),
                  ),
                  child: const Text('Close'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
