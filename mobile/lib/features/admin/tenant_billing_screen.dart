import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/data/services/admin_service.dart';
import 'package:zolofund/features/billing/widgets/addon_purchase_sheet.dart';
import 'package:zolofund/features/dashboard/widgets/dashboard_gps_widget.dart';
import 'package:zolofund/shared/widgets/app_button.dart';

class TenantBillingScreen extends ConsumerStatefulWidget {
  const TenantBillingScreen({super.key, this.isSubscriptionOnly = false});
  final bool isSubscriptionOnly;

  @override
  ConsumerState<TenantBillingScreen> createState() => _TenantBillingScreenState();
}

class _TenantBillingScreenState extends ConsumerState<TenantBillingScreen> {
  bool _isLoading = true;
  String _error = '';
  Map<String, dynamic> _billingData = {};

  @override
  void initState() {
    super.initState();
    _fetchBilling();
  }

  Future<void> _fetchBilling() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });
    try {
      final data = await ref.read(adminServiceProvider).getBilling();
      setState(() {
        _billingData = data;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = _billingData['role'] as String? ?? 'admin';
    final isDev = role == 'developer';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(widget.isSubscriptionOnly ? 'Subscription & Plan' : 'Billing & Subscriptions'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchBilling,
          ),
        ],
      ),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _error.isNotEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('Error loading billing: $_error', style: const TextStyle(color: AppColors.danger)),
                          const SizedBox(height: 16),
                          AppButton(label: 'Retry', onPressed: _fetchBilling),
                        ],
                      ),
                    ),
                  )
                : isDev
                    ? _buildDeveloperBillingView()
                    : _buildStandardBillingView(),
      ),
    );
  }

  Widget _buildDeveloperBillingView() {
    final tenants = _billingData['tenants'] as List<dynamic>? ?? [];
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: tenants.length,
      itemBuilder: (context, index) {
        final t = Map<String, dynamic>.from(tenants[index] as Map);
        final sub = t['subscription'] as Map<String, dynamic>?;
        final name = t['name'] as String? ?? 'Tenant';
        final slug = t['slug'] as String? ?? '';
        final plan = (sub?['plan'] as String? ?? 'trial').toUpperCase();
        final status = (sub?['status'] as String? ?? 'active').toUpperCase();

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppTokens.radius),
            boxShadow: AppTokens.shadow,
            border: Border.all(color: AppColors.border, width: 1),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(name, style: AppTypography.nameLg.copyWith(fontSize: 16)),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(plan, style: AppTypography.tiny.copyWith(color: AppColors.primaryDark, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text('Slug: $slug · Status: $status', style: AppTypography.caption),
              if (sub != null) ...[
                const SizedBox(height: 8),
                Text(
                  'Limits: maxBranches: ${sub['maxBranches']} · maxAgents: ${sub['maxAgents']} · maxActiveLoans: ${sub['maxActiveLoans']}',
                  style: AppTypography.caption,
                ),
              ],
              const Divider(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  AppButton(
                    size: AppButtonSize.small,
                    label: 'Edit Limits / Sub',
                    onPressed: () => _showEditLimitsSheet(context, t),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStandardBillingView() {
    final sub = _billingData['subscription'] as Map<String, dynamic>?;
    final invoices = _billingData['invoices'] as List<dynamic>? ?? [];

    final plan = sub?['plan'] as String? ?? 'trial';
    final status = sub?['status'] as String? ?? 'active';
    final currentPeriodEndStr = sub?['currentPeriodEnd'] as String?;
    final dateFormatted = currentPeriodEndStr != null 
        ? DateTime.parse(currentPeriodEndStr).toLocal().toString().split(' ')[0]
        : 'N/A';

    final user = ref.watch(authControllerProvider).user;
    final role = _billingData['role'] as String? ?? 'admin';
    final isDev = role == 'developer' || user?.role == UserRole.developer;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Plan Overview Card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: const LinearGradient(
              colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
            ),
            boxShadow: AppTokens.shadow,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Active Plan', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${plan.toUpperCase()} SUITE',
                    style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.successBg.withAlpha(50),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.success, width: 1),
                    ),
                    child: Text(
                      status.toUpperCase(),
                      style: const TextStyle(color: AppColors.success, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                'Expiry/Renewal Date: $dateFormatted · Billing: $plan',
                style: const TextStyle(color: Colors.white60, fontSize: 12),
              ),
              if (sub != null) ...[
                const Divider(color: Colors.white24, height: 24),
                Text(
                  'Limits: Max Active Loans: ${sub['maxActiveLoans']} · Max Agents: ${sub['maxAgents']} · Max Branches: ${sub['maxBranches']}',
                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Add-ons & Premium Modules
        Text('Add-ons & Premium Modules', style: AppTypography.sectionTitle),
        const SizedBox(height: 12),
        ..._buildAddonList(user, isDev),
        const SizedBox(height: 16),

        if (!widget.isSubscriptionOnly) ...[
          Text('Billing Statements', style: AppTypography.sectionTitle),
          const SizedBox(height: 12),
          if (invoices.isEmpty)
            const Center(child: Text('No billing invoices found.'))
          else
            ...invoices.map((inv) {
              final id = inv['id'] as String? ?? '';
              final amt = inv['amount'] as num? ?? 0;
              final invStatus = inv['status'] as String? ?? 'paid';
              final createdAtStr = inv['createdAt'] as String?;
              final invDate = createdAtStr != null
                  ? DateTime.parse(createdAtStr).toLocal().toString().split(' ')[0]
                  : 'N/A';
              return _InvoiceRow(
                invoiceId: id.substring(0, Math.min(id.length, 12)),
                date: invDate,
                amount: '₹$amt',
                status: invStatus,
              );
            }),
        ],
      ],
    );
  }

  void _showEditLimitsSheet(BuildContext context, Map<String, dynamic> tenant) {
    final sub = tenant['subscription'] as Map<String, dynamic>?;

    final planController = TextEditingController(text: sub?['plan'] as String? ?? 'trial');
    final statusController = TextEditingController(text: sub?['status'] as String? ?? 'active');
    final maxLoansController = TextEditingController(text: (sub?['maxActiveLoans'] ?? 100).toString());
    final maxAgentsController = TextEditingController(text: (sub?['maxAgents'] ?? 5).toString());
    final maxBranchesController = TextEditingController(text: (sub?['maxBranches'] ?? 3).toString());

    bool whatsapp = sub?['whatsappSmsEnabled'] == true;
    bool pdf = sub?['receiptPdfAllowed'] == true;
    bool kyc = sub?['kycEnabled'] == true;
    bool gps = sub?['gpsTrackingEnabled'] == true;
    bool acct = sub?['premiumAccountingEnabled'] == true;
    bool npa = sub?['npaEnabled'] == true;
    bool bureau = sub?['bureauEnabled'] == true;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
              child: ListView(
                shrinkWrap: true,
                children: [
                  Text('Update Subscription Limits', style: AppTypography.sectionTitle),
                  const SizedBox(height: 16),
                  TextField(
                    controller: planController,
                    decoration: const InputDecoration(labelText: 'Plan (trial, monthly, yearly)', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: statusController,
                    decoration: const InputDecoration(labelText: 'Status (active, suspended)', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: maxLoansController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Max Active Loans', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: maxAgentsController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Max Agents', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: maxBranchesController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Max Branches', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  CheckboxListTile(
                    title: const Text('NPA Monitoring & Provisioning Engine'),
                    value: npa,
                    onChanged: (v) => setModalState(() => npa = v ?? false),
                  ),
                  CheckboxListTile(
                    title: const Text('Credit Bureau Integration (CRIF)'),
                    value: bureau,
                    onChanged: (v) => setModalState(() => bureau = v ?? false),
                  ),
                  CheckboxListTile(
                    title: const Text('WhatsApp/SMS Enabled'),
                    value: whatsapp,
                    onChanged: (v) => setModalState(() => whatsapp = v ?? false),
                  ),
                  CheckboxListTile(
                    title: const Text('Receipt PDF Allowed'),
                    value: pdf,
                    onChanged: (v) => setModalState(() => pdf = v ?? false),
                  ),
                  CheckboxListTile(
                    title: const Text('KYC Verification Suite'),
                    value: kyc,
                    onChanged: (v) => setModalState(() => kyc = v ?? false),
                  ),
                  CheckboxListTile(
                    title: const Text('GPS Live Tracking'),
                    value: gps,
                    onChanged: (v) => setModalState(() => gps = v ?? false),
                  ),
                  CheckboxListTile(
                    title: const Text('Premium Ledger Accounting'),
                    value: acct,
                    onChanged: (v) => setModalState(() => acct = v ?? false),
                  ),
                  const SizedBox(height: 16),
                  AppButton(
                    label: 'Save Subscription Configuration',
                    onPressed: () async {
                      Navigator.pop(context);
                      setState(() => _isLoading = true);
                      final messenger = ScaffoldMessenger.of(this.context);
                      try {
                        await ref.read(adminServiceProvider).updateBilling({
                          'tenantId': tenant['id'] as String,
                          'plan': planController.text.trim(),
                          'status': statusController.text.trim(),
                          'maxActiveLoans': int.tryParse(maxLoansController.text.trim()) ?? 100,
                          'maxAgents': int.tryParse(maxAgentsController.text.trim()) ?? 5,
                          'maxBranches': int.tryParse(maxBranchesController.text.trim()) ?? 3,
                          'npaEnabled': npa,
                          'bureauEnabled': bureau,
                          'whatsappSmsEnabled': whatsapp,
                          'receiptPdfAllowed': pdf,
                          'kycEnabled': kyc,
                          'gpsTrackingEnabled': gps,
                          'premiumAccountingEnabled': acct,
                        });
                        await _fetchBilling();
                      } catch (e) {
                        setState(() => _isLoading = false);
                        if (!mounted) return;
                        messenger.showSnackBar(
                          SnackBar(content: Text('Failed to update subscription config: $e')),
                        );
                      }
                    },
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  List<Widget> _buildAddonList(User? user, bool isDev) {
    final addons = [
      _BillingAddonItem(
        key: 'npa',
        name: 'NPA Monitoring & Provisioning',
        priceText: '₹499/mo',
        desc: 'Overdue classification (SMA 0/1/2/NPA) & RBI provisioning engine',
        icon: Icons.health_and_safety_outlined,
        isSubscribed: user?.npaEnabled == true || isDev,
      ),
      _BillingAddonItem(
        key: 'gps_tracking',
        name: 'GPS Live Tracking',
        priceText: '₹299/mo',
        desc: 'Real-time agent location, geotagged collections & route audit',
        icon: Icons.gps_fixed_rounded,
        isSubscribed: user?.gpsTrackingEnabled == true || isDev,
      ),
      _BillingAddonItem(
        key: 'kyc',
        name: 'KYC Verification Suite',
        priceText: '₹199/mo',
        desc: 'Instant Aadhaar OTP verification, document OCR & Video KYC',
        icon: Icons.verified_user_outlined,
        isSubscribed: user?.kycEnabled == true || isDev,
      ),
      _BillingAddonItem(
        key: 'bureau',
        name: 'Credit Bureau Integration',
        priceText: '₹399/mo',
        desc: 'Instant CRIF High Mark credit reports and risk scoring',
        icon: Icons.assignment_ind_outlined,
        isSubscribed: user?.bureauEnabled == true || isDev,
      ),
      _BillingAddonItem(
        key: 'premium_accounting',
        name: 'Premium Ledger & Accounting',
        priceText: '₹399/mo',
        desc: 'Automated double-entry journals, trial balance & P&L exports',
        icon: Icons.account_balance_outlined,
        isSubscribed: user?.premiumAccountingEnabled == true || isDev,
      ),
      _BillingAddonItem(
        key: 'whatsapp_sms',
        name: 'WhatsApp & SMS Notifications',
        priceText: '₹199/mo',
        desc: 'Instant collection receipts and automated repayment reminders',
        icon: Icons.chat_bubble_outline_rounded,
        isSubscribed: user?.whatsappSmsEnabled == true || isDev,
      ),
    ];

    return addons.map((addon) {
      return Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: addon.isSubscribed
                ? AppColors.success.withAlpha(80)
                : AppColors.border,
          ),
          boxShadow: AppTokens.shadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: addon.isSubscribed
                        ? AppColors.successBg
                        : AppColors.warningBg,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    addon.icon,
                    color: addon.isSubscribed
                        ? AppColors.success
                        : AppColors.warning,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              addon.name,
                              style: AppTypography.bodySmall.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 6),
                          if (!addon.isSubscribed)
                            const Icon(
                              Icons.lock_rounded,
                              size: 14,
                              color: AppColors.warning,
                            ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        addon.isSubscribed
                            ? 'Active · Included in organization plan'
                            : '${addon.priceText} · ${addon.desc}',
                        style: AppTypography.extraTiny.copyWith(
                          color: AppColors.textSecondary,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: addon.isSubscribed
                        ? AppColors.successBg
                        : AppColors.warningBg,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: addon.isSubscribed
                          ? AppColors.success
                          : AppColors.warning,
                    ),
                  ),
                  child: Text(
                    addon.isSubscribed ? 'ACTIVE' : 'LOCKED',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: addon.isSubscribed
                          ? AppColors.success
                          : AppColors.warning,
                    ),
                  ),
                ),
              ],
            ),
            if (!addon.isSubscribed) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    showAddonPurchaseSheet(
                      context,
                      ref,
                      addonKey: addon.key,
                      onActivated: () {
                        _fetchBilling();
                        ref
                            .read(authControllerProvider.notifier)
                            .refreshProfile();
                      },
                    );
                  },
                  icon: const Icon(Icons.flash_on_rounded, size: 16),
                  label: Text(
                    'Subscribe to ${addon.name} (${addon.priceText})',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
            ],
          ],
        ),
      );
    }).toList();
  }
}

class _BillingAddonItem {
  const _BillingAddonItem({
    required this.key,
    required this.name,
    required this.priceText,
    required this.desc,
    required this.icon,
    required this.isSubscribed,
  });
  final String key;
  final String name;
  final String priceText;
  final String desc;
  final IconData icon;
  final bool isSubscribed;
}

class _InvoiceRow extends StatelessWidget {
  const _InvoiceRow({
    required this.invoiceId,
    required this.date,
    required this.amount,
    required this.status,
  });

  final String invoiceId;
  final String date;
  final String amount;
  final String status;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Row(
        children: [
          const Icon(Icons.receipt_outlined, color: AppColors.textSecondary, size: 24),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(invoiceId, style: AppTypography.nameLg.copyWith(fontSize: 14)),
                Text(date, style: AppTypography.caption),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(amount, style: AppTypography.nameLg.copyWith(fontSize: 14)),
              const SizedBox(height: 2),
              Text(status.toUpperCase(), style: AppTypography.tiny.copyWith(color: AppColors.success, fontWeight: FontWeight.bold)),
            ],
          ),
        ],
      ),
    );
  }
}

// Math.min helper
class Math {
  static int min(int a, int b) => a < b ? a : b;
}
