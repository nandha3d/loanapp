import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:printing/printing.dart';
import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:url_launcher/url_launcher.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:zolofund/core/gps/gps_service.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/network/authed_image.dart';
import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/customer.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/data/repositories/customer_repository.dart';
import 'package:zolofund/data/services/customer_service.dart';
import 'package:zolofund/data/services/kyc_service.dart';
import 'package:zolofund/features/billing/widgets/plan_upgrade_sheet.dart';
import 'package:zolofund/features/location/location_picker_screen.dart';
import 'package:zolofund/shared/utils/phone.dart';
import 'package:zolofund/shared/widgets/app_badge.dart';
import 'package:zolofund/shared/widgets/skeleton.dart';

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

class _KycActions extends ConsumerStatefulWidget {
  const _KycActions({required this.customer, required this.onRefresh});

  final Customer customer;
  final VoidCallback onRefresh;

  @override
  ConsumerState<_KycActions> createState() => _KycActionsState();
}

class _KycActionsState extends ConsumerState<_KycActions> {
  final _aadhaar = TextEditingController();
  final _otp = TextEditingController();
  String? _sessionId;
  String? _videoUrl;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _aadhaar.dispose();
    _otp.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      widget.onRefresh();
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final customer = widget.customer;
    final kycMethod = ref.watch(authControllerProvider).user?.kycMethod ?? 'manual_upload';
    final showAadhaar = kycMethod == 'aadhaar_otp' || kycMethod == 'both';
    final showVideo = kycMethod == 'video_kyc' || kycMethod == 'both';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(t.x('kyc.verify_identity'), style: AppTypography.sectionTitle),
            const SizedBox(height: 8),
            Text('${t.x('kyc.status')}: ${customer.kycStatus ?? ''}'),
            if (customer.kycMethod != null)
              Text('${t.x('kyc.method')}: ${customer.kycMethod}'),
            if (customer.aadhaarName != null)
              Text('${t.x('kyc.verified_name')}: ${customer.aadhaarName}'),
            if (customer.aadhaarDob != null)
              Text('${t.x('kyc.verified_dob')}: ${customer.aadhaarDob}'),
            if (customer.aadhaarAddress != null)
              Text(
                  '${t.x('kyc.verified_address')}: ${customer.aadhaarAddress}',),
            // CUST-07: same KYC facts web shows.
            if (customer.kycStatus == 'verified' && customer.kycVerifiedAt != null)
              Text(
                '${t.x('kyc.verified_on')}: ${DateFormat('dd MMM yyyy').format(customer.kycVerifiedAt!)}',
              ),
            if (customer.kycStatus == 'rejected' &&
                (customer.kycRejectedReason ?? '').isNotEmpty)
              Text(
                '${t.x('kyc.rejected_reason')}: ${customer.kycRejectedReason}',
                style: const TextStyle(color: AppColors.danger),
              ),
            if (customer.kycStatus != 'verified') ...[
              if (showAadhaar) ...[
                const SizedBox(height: 12),
                if (_sessionId == null) ...[
                  TextField(
                    controller: _aadhaar,
                    keyboardType: TextInputType.number,
                    maxLength: 12,
                    decoration:
                        InputDecoration(labelText: t.x('kyc.aadhaar_number')),
                    onChanged: (_) => setState(() {}),
                  ),
                  OutlinedButton(
                    onPressed: _busy ||
                            !RegExp(r'^\d{12}$').hasMatch(_aadhaar.text)
                        ? null
                        : () => _run(() async {
                              _sessionId = await ref
                                  .read(kycServiceProvider)
                                  .startAadhaarOtp(customer.id, _aadhaar.text);
                              _aadhaar.clear();
                            }),
                    child: Text(t.x('kyc.send_otp')),
                  ),
                ] else ...[
                  TextField(
                    controller: _otp,
                    keyboardType: TextInputType.number,
                    maxLength: 8,
                    decoration: InputDecoration(labelText: t.x('kyc.enter_otp')),
                    onChanged: (_) => setState(() {}),
                  ),
                  OutlinedButton(
                    onPressed: _busy || !RegExp(r'^\d{4,8}$').hasMatch(_otp.text)
                        ? null
                        : () => _run(() async {
                              await ref
                                  .read(kycServiceProvider)
                                  .verifyAadhaarOtp(_sessionId!, _otp.text);
                              _otp.clear();
                              _sessionId = null;
                            }),
                    child: Text(t.x('kyc.verify_otp')),
                  ),
                ],
              ],
              if (showVideo) ...[
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: _busy
                      ? null
                      : () => _run(() async {
                            final url = await ref
                                .read(kycServiceProvider)
                                .startVideo(customer.id);
                            final uri = Uri.tryParse(url);
                            if (uri == null || uri.scheme != 'https') {
                              throw Exception(t.x('kyc.invalid_link'));
                            }
                            _videoUrl = url;
                            await launchUrl(uri,
                                mode: LaunchMode.externalApplication,);
                          }),
                  child: Text(t.x('kyc.start_video')),
                ),
                if (_videoUrl != null)
                  TextButton(
                    onPressed: () => launchUrl(Uri.parse(_videoUrl!),
                        mode: LaunchMode.externalApplication,),
                    child: Text(t.x('kyc.open_video')),
                  ),
              ],
            ],
            TextButton(
                onPressed: widget.onRefresh,
                child: Text(t.x('kyc.refresh_status')),),
            if (_busy) const LinearProgressIndicator(),
            if (_error != null)
              Text(_error!, style: const TextStyle(color: AppColors.danger)),
          ],
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
      final applied = await ref
          .read(customerRepositoryProvider)
          .update(widget.customer.id, {'status': next});
      ref.invalidate(customerListProvider);
      widget.onRefresh();
      if (applied == null && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(T.of(ref).x('msg.submitted_for_approval'))),
        );
      }
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

  Future<void> _showGpsRegistrationDialog(Customer customer) async {
    final t = T.of(ref);
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.pin_drop, color: AppColors.primary, size: 24),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Register GPS for ${customer.name}',
                      style: AppTypography.sectionTitle,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Set the 200m geofence anchor used to verify field collection visits for this borrower.',
                style: AppTypography.bodySmall
                    .copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withAlpha(25),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(Icons.my_location, color: AppColors.primary),
                ),
                title: Text(t.x('btn.use_my_gps'),
                    style: const TextStyle(fontWeight: FontWeight.w600),),
                subtitle: const Text('Capture device GPS location right now'),
                onTap: () async {
                  Navigator.pop(ctx);
                  final pos =
                      await ref.read(gpsServiceProvider).currentOrLastKnown();
                  if (pos == null) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(t.x('coll.location_off'))),
                      );
                    }
                    return;
                  }
                  try {
                    final applied = await ref
                        .read(customerRepositoryProvider)
                        .update(customer.id, {
                      'lat': pos.latitude,
                      'lng': pos.longitude,
                    });
                    ref.invalidate(customerDetailProvider(customer.id));
                    ref.invalidate(customerListProvider);
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            applied == null
                                ? T.of(ref).x('msg.submitted_for_approval')
                                : 'GPS coordinates registered successfully!',
                          ),
                          backgroundColor: AppColors.success,
                        ),
                      );
                    }
                  } catch (e) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Failed to update GPS: $e'),
                          backgroundColor: AppColors.danger,
                        ),
                      );
                    }
                  }
                },
              ),
              const Divider(),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.info.withAlpha(25),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.map_outlined, color: AppColors.info),
                ),
                title: Text(t.x('btn.pin_on_map'),
                    style: const TextStyle(fontWeight: FontWeight.w600),),
                subtitle: const Text(
                    'Search area or drag marker on map to pinpoint house/shop',),
                onTap: () async {
                  Navigator.pop(ctx);
                  final picked =
                      await Navigator.of(context).push<PickedLocation>(
                    MaterialPageRoute(
                      builder: (_) => LocationPickerScreen(
                        initialLat: customer.lat,
                        initialLng: customer.lng,
                        title: t.x('btn.pin_on_map'),
                      ),
                    ),
                  );
                  if (picked == null) return;
                  try {
                    final applied = await ref
                        .read(customerRepositoryProvider)
                        .update(customer.id, {
                      'lat': picked.lat,
                      'lng': picked.lng,
                    });
                    ref.invalidate(customerDetailProvider(customer.id));
                    ref.invalidate(customerListProvider);
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            applied == null
                                ? T.of(ref).x('msg.submitted_for_approval')
                                : 'GPS coordinates pinned on map successfully!',
                          ),
                          backgroundColor: AppColors.success,
                        ),
                      );
                    }
                  } catch (e) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Failed to update GPS: $e'),
                          backgroundColor: AppColors.danger,
                        ),
                      );
                    }
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.customer;
    final t = T.of(ref);
    final isChit = AppType.userIsChit(ref.watch(authControllerProvider).user);

    return Column(
      children: [
        _Header(customer: c, t: t),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (c.lat == null || c.lng == null) ...[
                _MissingGpsBanner(
                  customer: c,
                  t: t,
                  onRegister: () => _showGpsRegistrationDialog(c),
                ),
                const SizedBox(height: 14),
              ],
              _QuickContact(customer: c, t: t),
              const SizedBox(height: 14),
              _RiskCard(customer: c, t: t),
              const SizedBox(height: 14),
              if (!isChit) ...[
                _KpiStrip(customer: c, t: t),
                const SizedBox(height: 14),
                _LoansSection(customer: c, t: t),
                const SizedBox(height: 14),
              ],
              _IdentitySection(customer: c, t: t),
              const SizedBox(height: 14),
              if (ref.watch(authControllerProvider).user?.kycEnabled == true) ...[
                _KycActions(customer: c, onRefresh: widget.onRefresh),
                const SizedBox(height: 14),
              ] else ...[
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppTokens.radius),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: ListTile(
                    leading: Icon(Icons.verified_user_outlined,
                        color: AppColors.textSecondary),
                    title: Text(t.x('plan.feature.kyc'),
                        style: AppTypography.bodyLarge),
                    trailing: const PlanLockBadge(),
                    onTap: () =>
                        showPlanUpgradeSheet(context, ref, featureKey: 'kyc'),
                  ),
                ),
                const SizedBox(height: 14),
              ],
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
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              border: Border(top: BorderSide(color: AppColors.border)),
              boxShadow: AppTokens.shadowLg,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (!isChit) ...[
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed:
                              _printingReceipt ? null : _openCollectionReceipt,
                          icon: _printingReceipt
                              ? SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: AppColors.primary,
                                  ),
                                )
                              : Icon(Icons.picture_as_pdf_outlined,
                                  color: AppColors.primary, size: 18,),
                          label: Text(
                            t.x('cust.passbook'),
                            style: TextStyle(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(color: AppColors.primary, width: 1.5),
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton.icon(
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 1,
                          ),
                          onPressed: () => context.push(
                            '/loans/new',
                            extra: c,
                          ),
                          icon: const Icon(Icons.add_card_rounded, size: 18),
                          label: Text(
                            (ref.watch(authControllerProvider).user?.bypassLoanApproval ?? false)
                                ? t.x('title.new_loan')
                                : t.x('title.request_loan'),
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                ],
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(
                            color: c.status == 'suspended'
                                ? AppColors.primary
                                : AppColors.danger.withAlpha(160),
                          ),
                          foregroundColor: c.status == 'suspended'
                              ? AppColors.primary
                              : AppColors.danger,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        onPressed: _suspending ? null : _toggleSuspend,
                        child: _suspending
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text(
                                c.status == 'suspended'
                                    ? t.x('cust.unsuspend')
                                    : t.x('cust.suspend'),
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                              ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      flex: 2,
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          backgroundColor: AppColors.primaryLight.withAlpha(90),
                          side: BorderSide(color: AppColors.primary.withAlpha(90)),
                          foregroundColor: AppColors.primary,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        icon: Icon(Icons.edit_outlined, size: 17, color: AppColors.primary),
                        label: Text(
                          t.x('cust.edit_profile'),
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            color: AppColors.primary,
                          ),
                        ),
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
          colors: [AppColors.heroDarkFrom, AppColors.heroDarkTo],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 18),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                  Text(
                    t.x('cust.title_360'),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                    ),
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.edit_outlined, color: Colors.white, size: 20),
                        tooltip: t.x('cust.edit_profile'),
                        onPressed: () async {
                          await context.push<Object?>(
                            '/customers/${customer.id}/edit',
                            extra: customer,
                          );
                          ref.invalidate(customerDetailProvider(customer.id));
                        },
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
                              } else if (value == 'reset_password') {
                                _resetPortalPassword(context, ref, customer);
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
                              if (role == UserRole.admin ||
                                  role == UserRole.superadmin)
                                PopupMenuItem(
                                  value: 'reset_password',
                                  child: ListTile(
                                    leading: const Icon(Icons.lock_reset_outlined),
                                    title: Text(t.x('cust.reset_portal_password')),
                                    contentPadding: EdgeInsets.zero,
                                  ),
                                ),
                              if (canDelete)
                                const PopupMenuItem(
                                  value: 'delete',
                                  child: ListTile(
                                    leading: Icon(Icons.delete_outline,
                                        color: AppColors.danger,),
                                    title: Text(
                                      'Delete Customer',
                                      style: TextStyle(color: AppColors.danger),
                                    ),
                                    contentPadding: EdgeInsets.zero,
                                  ),
                                ),
                            ],
                          );
                        },
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  _PhotoOrInitials(customer: customer, size: 84),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          customer.name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.3,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            InkWell(
                              onTap: () {
                                Clipboard.setData(ClipboardData(text: customer.customerCode));
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text('Copied ${customer.customerCode}'),
                                    duration: const Duration(seconds: 1),
                                    behavior: SnackBarBehavior.floating,
                                  ),
                                );
                              },
                              borderRadius: BorderRadius.circular(6),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: Colors.white.withAlpha(25),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: Colors.white.withAlpha(35)),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      customer.customerCode,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontFamily: 'monospace',
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    const Icon(Icons.copy_rounded, color: Colors.white70, size: 11),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            AppBadge(
                              label: customer.status,
                              kind: _badgeForStatus(customer.status),
                            ),
                          ],
                        ),
                        if (customer.routeName != null && customer.routeName!.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Icon(Icons.route_outlined, size: 13, color: Colors.white.withAlpha(180)),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  customer.routeName!,
                                  style: TextStyle(
                                    color: Colors.white.withAlpha(200),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// CUST-07: clears the borrower portal password (admin), same as web.
  Future<void> _resetPortalPassword(
    BuildContext context,
    WidgetRef ref,
    Customer customer,
  ) async {
    final t = T.of(ref);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(t.x('cust.reset_portal_password')),
        content: Text(t.x('cust.reset_portal_password_hint')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(t.x('common.cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(t.x('cust.reset_portal_password')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(customerServiceProvider).resetPortalPassword(customer.id);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t.x('cust.portal_password_reset'))),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    }
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
          border: Border.all(color: Colors.white.withAlpha(80), width: 2.5),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(50),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
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
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          colors: [Color(0xFF8E24AA), Color(0xFF5E1B5F)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: Colors.white.withAlpha(80), width: 2.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(50),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        customer.initials,
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.40,
          fontWeight: FontWeight.w800,
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
    final hasAddress = (customer.lat != null && customer.lng != null) ||
        (customer.address != null && customer.address!.isNotEmpty);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withAlpha(120)),
        boxShadow: AppTokens.shadow,
      ),
      child: Row(
        children: [
          Expanded(
            child: _ContactBtn(
              icon: Icons.call_rounded,
              label: t.x('cust.call'),
              color: AppColors.success,
              bg: AppColors.successBg,
              onTap: () => _launch(Uri(scheme: 'tel', path: customer.phone)),
            ),
          ),
          Expanded(
            child: _ContactBtn(
              icon: Icons.chat_bubble_outline_rounded,
              label: t.x('cust.message'),
              color: AppColors.info,
              bg: AppColors.infoBg,
              onTap: () => _launch(Uri(scheme: 'sms', path: customer.phone)),
            ),
          ),
          Expanded(
            child: _ContactBtn(
              icon: Icons.send_rounded,
              label: t.x('cust.whatsapp'),
              color: const Color(0xFF25D366),
              bg: const Color(0xFFE8F8EE),
              onTap: () => _launch(
                Uri.parse(
                  'https://wa.me/${whatsappNumber(customer.phone, ref.read(authControllerProvider).user?.phoneCountryCode ?? '91')}',
                ),
              ),
            ),
          ),
          if (hasAddress)
            Expanded(
              child: _ContactBtn(
                icon: Icons.near_me_rounded,
                label: t.x('cust.directions'),
                color: AppColors.primary,
                bg: AppColors.primaryLight,
                onTap: () => _launch(
                  Uri.parse(
                    customer.lat != null && customer.lng != null
                        ? 'https://www.google.com/maps/dir/?api=1&destination=${customer.lat},${customer.lng}'
                        : 'https://www.google.com/maps/search/?api=1&query=${Uri.encodeQueryComponent(customer.address!)}',
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ContactBtn extends StatelessWidget {
  const _ContactBtn({
    required this.icon,
    required this.label,
    required this.color,
    required this.bg,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final Color color;
  final Color bg;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: bg,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
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
        color: AppColors.textSecondary,
        bg: AppColors.background,
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
        bg: AppColors.warningBg,
      );
    }
    if (s < 750) {
      return (
        label: cs.grade,
        color: const Color(0xFFD97706),
        bg: AppColors.warningBg,
      );
    }
    return (label: cs.grade, color: AppColors.success, bg: AppColors.successBg);
  }

  @override
  Widget build(BuildContext context) {
    final cs = customer.creditScore;
    final band = _band(cs);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withAlpha(120)),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(Icons.speed_rounded, color: AppColors.primary, size: 18),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    t.x('cust.risk_score'),
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: band.bg,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: band.color.withAlpha(60)),
                ),
                child: Text(
                  band.label.toUpperCase(),
                  style: TextStyle(
                    color: band.color,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          _ScoreMeter(
            score: cs?.score ?? 0,
            grade: band.label,
            color: band.color,
            isRated: cs?.rated ?? false,
          ),
          const SizedBox(height: 16),
          Text(
            _explainer(cs),
            style: TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
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
          Container(
            width: 68,
            height: 68,
            decoration: BoxDecoration(
              color: AppColors.primaryLight.withAlpha(90),
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.primary.withAlpha(50), width: 1.5),
            ),
            child: Icon(Icons.speed_rounded, size: 36, color: AppColors.primary),
          ),
          const SizedBox(height: 12),
          Text(
            grade.toUpperCase(),
            style: TextStyle(
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w800,
              fontSize: 13,
              letterSpacing: 1.2,
            ),
          ),
        ],
      );
    }

    return Column(
      children: [
        SizedBox(
          width: 190,
          height: 100,
          child: CustomPaint(
            painter: _ScoreMeterPainter(score: score),
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: color.withAlpha(25),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Text(
            grade.toUpperCase(),
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w800,
              fontSize: 12,
              letterSpacing: 0.5,
            ),
          ),
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
      ..strokeCap = StrokeCap.round;

    // Draw background track arc
    final bgPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..strokeCap = StrokeCap.round
      ..color = AppColors.border.withAlpha(120);
    canvas.drawArc(rect, math.pi, math.pi, false, bgPaint);

    // Draw colored arcs
    paint.strokeCap = StrokeCap.butt;
    paint.color = AppColors.danger;
    canvas.drawArc(rect, math.pi, math.pi * 0.36, false, paint);

    paint.color = AppColors.warning;
    canvas.drawArc(
      rect,
      math.pi + (math.pi * 0.36),
      math.pi * 0.27,
      false,
      paint,
    );

    paint.color = AppColors.success;
    canvas.drawArc(
      rect,
      math.pi + (math.pi * 0.63),
      math.pi * 0.37,
      false,
      paint,
    );

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
      text: TextSpan(
        text: '300',
        style: TextStyle(
          color: AppColors.textLight,
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
      textDirection: ui.TextDirection.ltr,
    )..layout();
    textPainter300.paint(canvas, Offset(4, size.height + 6));

    final textPainter850 = TextPainter(
      text: TextSpan(
        text: '850',
        style: TextStyle(
          color: AppColors.textLight,
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
      textDirection: ui.TextDirection.ltr,
    )..layout();
    textPainter850.paint(
      canvas,
      Offset(size.width - textPainter850.width - 4, size.height + 6),
    );

    // Main Score
    final scorePainter = TextPainter(
      text: TextSpan(
        text: '$score',
        style: const TextStyle(
          color: Color(0xFF111827),
          fontSize: 34,
          fontWeight: FontWeight.w900,
        ),
      ),
      textDirection: ui.TextDirection.ltr,
    )..layout();
    scorePainter.paint(
      canvas,
      Offset(
        center.dx - scorePainter.width / 2,
        size.height - scorePainter.height + 4,
      ),
    );
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
    // CUST-04: server creditScore.stats only — outstanding is
    // Σ(totalPayable − totalCollected) over active/overdue loans, same as web.
    final cs = customer.creditScore;
    final totalBorrowed = cs?.totalBorrowed ?? 0;
    final outstanding = cs?.outstanding ?? 0;
    final punctuality = cs?.punctuality ?? 0;
    final activeLoans = cs?.activeLoans ?? 0;
    final closedLoans = cs?.closedLoans ?? 0;

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _KpiCard(
                icon: Icons.south_west_rounded,
                iconColor: AppColors.danger,
                iconBg: AppColors.dangerBg,
                label: t.x('cust.total_borrowed'),
                value: fmt.format(totalBorrowed),
                subtext: 'Disbursed',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _KpiCard(
                icon: Icons.payments_outlined,
                iconColor: AppColors.warning,
                iconBg: AppColors.warningBg,
                label: t.x('loan.outstanding'),
                value: fmt.format(outstanding),
                valueColor: outstanding > 0 ? AppColors.warningText : AppColors.textPrimary,
                subtext: outstanding > 0 ? 'Pending dues' : 'Cleared',
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _KpiCard(
                icon: Icons.receipt_long_rounded,
                iconColor: AppColors.info,
                iconBg: AppColors.infoBg,
                label: t.x('dash.active_loans'),
                value: '$activeLoans',
                valueUnit: '/ $closedLoans',
                subtext: '$closedLoans ${t.x('status.closed').toLowerCase()}',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _KpiCard(
                icon: Icons.verified_outlined,
                iconColor: AppColors.success,
                iconBg: AppColors.successBg,
                label: t.x('cust.punctuality'),
                value: '$punctuality%',
                valueColor: punctuality >= 80
                    ? AppColors.success
                    : (punctuality >= 50 ? AppColors.warning : AppColors.danger),
                progress: punctuality / 100.0,
                subtext: 'On-time track',
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.label,
    required this.value,
    this.valueUnit,
    this.valueColor,
    this.subtext,
    this.progress,
  });

  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final String label;
  final String value;
  final String? valueUnit;
  final Color? valueColor;
  final String? subtext;
  final double? progress;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withAlpha(120)),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: iconColor, size: 18),
              ),
              if (subtext != null && progress == null)
                Text(
                  subtext!,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textLight,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: valueColor ?? AppColors.textPrimary,
                    letterSpacing: -0.3,
                  ),
                ),
                if (valueUnit != null) ...[
                  const SizedBox(width: 4),
                  Text(
                    valueUnit!,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (progress != null) ...[
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress!.clamp(0.0, 1.0),
                minHeight: 4,
                backgroundColor: AppColors.border,
                color: valueColor ?? AppColors.success,
              ),
            ),
          ],
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
    final count = customer.loans.length;
    final trailing = Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.primaryLight,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        '$count',
        style: TextStyle(
          color: AppColors.primary,
          fontWeight: FontWeight.bold,
          fontSize: 12,
        ),
      ),
    );

    if (customer.loans.isEmpty) {
      return _Card(
        title: t.x('cust.loans_tab'),
        trailing: trailing,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Row(
            children: [
              Icon(Icons.info_outline, color: AppColors.textLight, size: 20),
              const SizedBox(width: 10),
              Text(
                t.x('cust.no_loans_yet'),
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
            ],
          ),
        ),
      );
    }

    final fmt = ref.watch(currencyFmtProvider);
    return _Card(
      title: t.x('cust.loans_tab'),
      trailing: trailing,
      child: Column(
        children: [
          for (final l in customer.loans) ...[
            _LoanRow(loan: l, fmt: fmt),
            if (l != customer.loans.last)
              const SizedBox(height: 10),
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

  Color get _statusBg {
    switch (loan.status) {
      case 'active':
        return AppColors.successBg;
      case 'overdue':
        return AppColors.dangerBg;
      case 'closed':
        return AppColors.infoBg;
      case 'pending_review':
      case 'pending':
        return AppColors.warningBg;
      default:
        return AppColors.background;
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.go('/loans/${loan.id}'),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.background.withAlpha(120),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border.withAlpha(140)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: _statusBg,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    Icons.receipt_long_rounded,
                    color: _statusColor,
                    size: 18,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        loan.loanCode ?? loan.id.substring(0, 8),
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: _statusBg,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              loan.status.replaceAll('_', ' ').toUpperCase(),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: _statusColor,
                              ),
                            ),
                          ),
                          if (loan.frequency != null) ...[
                            const SizedBox(width: 6),
                            Text(
                              '• ${loan.frequency}',
                              style: TextStyle(
                                fontSize: 11,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                          if (loan.startDate != null) ...[
                            const SizedBox(width: 4),
                            Text(
                              '• ${DateFormat('dd MMM yyyy').format(loan.startDate!)}',
                              style: TextStyle(
                                fontSize: 11,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      fmt.format(loan.principal),
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Icon(
                      Icons.chevron_right_rounded,
                      color: AppColors.primary,
                      size: 20,
                    ),
                  ],
                ),
              ],
            ),
            if (loan.tenure > 0) ...[
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${loan.paidCount}/${loan.tenure} instalments paid',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  Text(
                    '${((loan.paidCount / loan.tenure).clamp(0.0, 1.0) * 100).toInt()}%',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: _statusColor,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: (loan.paidCount / loan.tenure).clamp(0.0, 1.0),
                  minHeight: 5,
                  backgroundColor: AppColors.border,
                  color: _statusColor,
                ),
              ),
            ],
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
  final withGps = customer.collectionPoints
      .where((p) => p.latitude != null && p.longitude != null);
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
            actionIcon: Icons.call_outlined,
            onTap: () => launchUrl(Uri(scheme: 'tel', path: customer.phone)),
          ),
          if (customer.address != null && customer.address!.isNotEmpty)
            _IdRow(
              icon: Icons.location_on_outlined,
              label: t.x('fld.address_label'),
              value: customer.address!,
            ),
          if (customer.lat != null && customer.lng != null)
            _IdRow(
              icon: Icons.my_location_outlined,
              label: 'GPS location',
              value:
                  '${customer.lat!.toStringAsFixed(5)}, ${customer.lng!.toStringAsFixed(5)}',
              valueColor: AppColors.primary,
              actionLabel: 'View Map',
              actionIcon: Icons.open_in_new_rounded,
              onTap: () => launchUrl(
                Uri.parse(
                  'https://www.google.com/maps/search/?api=1&query=${customer.lat},${customer.lng}',
                ),
                mode: LaunchMode.externalApplication,
              ),
            )
          else if (_primaryGpsPoint(customer) != null)
            Builder(
              builder: (context) {
                final p = _primaryGpsPoint(customer)!;
                return _IdRow(
                  icon: Icons.my_location_outlined,
                  label: 'GPS location',
                  value: '${p.latitude!.toStringAsFixed(5)}, ${p.longitude!.toStringAsFixed(5)}',
                  valueColor: AppColors.primary,
                  actionLabel: 'View Map',
                  actionIcon: Icons.open_in_new_rounded,
                  onTap: () => launchUrl(
                    Uri.parse(
                      'https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}',
                    ),
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
    this.actionLabel,
    this.actionIcon,
    this.onTap,
  });
  final IconData icon;
  final String label, value;
  final Color? valueColor;
  final String? actionLabel;
  final IconData? actionIcon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final row = Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.primaryLight.withAlpha(80),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: valueColor ?? AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          if (actionLabel != null || actionIcon != null) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (actionIcon != null)
                    Icon(actionIcon, size: 14, color: AppColors.primary),
                  if (actionLabel != null && actionIcon != null)
                    const SizedBox(width: 4),
                  if (actionLabel != null)
                    Text(
                      actionLabel!,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
    return onTap != null ? InkWell(onTap: onTap, borderRadius: BorderRadius.circular(8), child: row) : row;
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
                              g.relation,
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
                        await launchUrl(uri,
                            mode: LaunchMode.externalApplication,);
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
                            style: AppTypography.bodyLarge,),
                        Text(
                          [
                            c.bankName,
                            if (c.amount != null)
                              '₹${c.amount!.toStringAsFixed(0)}',
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
    BuildContext context,
    WidgetRef ref,
    KycDocument d,
    String url,
  ) {
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
                      child: Icon(
                        Icons.broken_image_outlined,
                        color: Colors.white54,
                        size: 48,
                      ),
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
                                child: Icon(
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
                              child: Icon(
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
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withAlpha(120)),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                    letterSpacing: -0.2,
                  ),
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 12),
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
              Icon(Icons.cloud_off, size: 56, color: AppColors.textLight),
              const SizedBox(height: 12),
              Text(t.x('err.could_not_load_customer'),
                  style: AppTypography.sectionTitle,),
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

class _MissingGpsBanner extends StatelessWidget {
  const _MissingGpsBanner({
    required this.customer,
    required this.t,
    required this.onRegister,
  });
  final Customer customer;
  final T t;
  final VoidCallback onRegister;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFCD34D)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF3C7),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.location_off, color: Color(0xFFD97706), size: 20),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'No GPS Registered',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                    color: Color(0xFF92400E),
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Field collection verification requires registered coordinates.',
                  style: TextStyle(fontSize: 11, color: Color(0xFFB45309)),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          FilledButton.icon(
            onPressed: onRegister,
            icon: const Icon(Icons.my_location, size: 14),
            label: const Text('Register', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFD97706),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ],
      ),
    );
  }
}
