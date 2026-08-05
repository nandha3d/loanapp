import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/nach.dart';
import 'package:zolofund/data/services/nach_service.dart';

/// e-NACH Auto-Debit panel — embedded in the loan detail screen.
/// Self-contained: reads/writes mandates via NachService.
class NachPanel extends ConsumerStatefulWidget {
  const NachPanel({
    super.key,
    required this.loanId,
    required this.customerId,
    this.customerName,
    this.customerPhone,
    this.customerEmail,
    this.defaultMaxAmount,
    this.isAdmin = false,
  });

  final String loanId;
  final String customerId;
  final String? customerName;
  final String? customerPhone;
  final String? customerEmail;
  final double? defaultMaxAmount;
  final bool isAdmin;

  @override
  ConsumerState<NachPanel> createState() => _NachPanelState();
}

class _NachPanelState extends ConsumerState<NachPanel> {
  NachMandate? _mandate;
  late final Razorpay _razorpay;
  bool _loaded = false;
  bool _showForm = false;
  bool _busy = false;
  String? _error;
  bool _expanded = true;

  // Form fields
  late TextEditingController _holderCtrl;
  late TextEditingController _accountCtrl;
  late TextEditingController _confirmCtrl;
  late TextEditingController _ifscCtrl;
  late TextEditingController _bankCtrl;
  late TextEditingController _maxAmountCtrl;
  String _accountType = 'savings';
  String _authType = 'netbanking';

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
    _holderCtrl = TextEditingController(text: widget.customerName ?? '');
    _accountCtrl = TextEditingController();
    _confirmCtrl = TextEditingController();
    _ifscCtrl = TextEditingController();
    _bankCtrl = TextEditingController();
    _maxAmountCtrl = TextEditingController(
      text: widget.defaultMaxAmount != null
          ? widget.defaultMaxAmount!.ceil().toString()
          : '',
    );
    _refresh();
  }

  @override
  void dispose() {
    _razorpay.clear();
    _holderCtrl.dispose();
    _accountCtrl.dispose();
    _confirmCtrl.dispose();
    _ifscCtrl.dispose();
    _bankCtrl.dispose();
    _maxAmountCtrl.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final mandate =
          await ref.read(nachServiceProvider).getMandate(widget.loanId);
      if (mounted) setState(() {
        _mandate = mandate;
        _loaded = true;
      });
    } catch (_) {
      if (mounted) setState(() => _loaded = true);
    }
  }

  Future<void> _submitMandate() async {
    if (_accountCtrl.text != _confirmCtrl.text) {
      setState(() => _error = 'Account numbers do not match');
      return;
    }
    final maxAmount = double.tryParse(_maxAmountCtrl.text) ?? 0;
    if (maxAmount <= 0) {
      setState(() => _error = 'Enter a valid max debit amount');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final mandate = await ref.read(nachServiceProvider).createMandate(
            loanId: widget.loanId,
            customerId: widget.customerId,
            accountHolderName: _holderCtrl.text.trim(),
            accountNumber: _accountCtrl.text.trim(),
            ifscCode: _ifscCtrl.text.trim().toUpperCase(),
            accountType: _accountType,
            authType: _authType,
            maxAmount: maxAmount,
            bankName:
                _bankCtrl.text.trim().isEmpty ? null : _bankCtrl.text.trim(),
            customerPhone: widget.customerPhone,
            customerEmail: widget.customerEmail,
          );
      setState(() {
        _mandate = mandate;
        _showForm = false;
      });
      // If Razorpay order was created, open checkout
      if (mandate.razorpayOrderId != null && mandate.razorpayKeyId != null) {
        _openRazorpayCheckout(mandate);
      }
    } catch (e) {
      setState(() => _error = e.toString());
    }
    setState(() => _busy = false);
  }

  void _openRazorpayCheckout(NachMandate mandate) {
    if (mandate.razorpayOrderId != null && mandate.razorpayKeyId != null) {
      _openRazorpayCheckoutNative(mandate);
      return;
    }

    // Razorpay checkout for mandate authorization.
    // On mobile, we use the razorpay_flutter package.
    // The Razorpay key and order are embedded in the mandate response.
    // For now, we show a dialog with instructions — the actual Razorpay
    // integration requires the razorpay_flutter package to be wired up
    // in the platform-specific config.
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Mandate Authorisation'),
        content: Text(
          'A Razorpay checkout will open for the borrower to authorise '
          'auto-debit. Order ID: ${mandate.razorpayOrderId}\n\n'
          'Share the authorisation link with the borrower if they are '
          'not present.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _refresh();
            },
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  void _openRazorpayCheckoutNative(NachMandate mandate) {
    final key = mandate.razorpayKeyId;
    final orderId = mandate.razorpayOrderId;
    if (key == null || key.isEmpty || orderId == null || orderId.isEmpty) {
      setState(() => _error = 'Razorpay checkout details are missing');
      return;
    }

    final options = <String, dynamic>{
      'key': key,
      'order_id': orderId,
      'name': 'ZoloFund',
      'description': 'e-NACH mandate authorisation',
      'prefill': {
        if (widget.customerPhone != null) 'contact': widget.customerPhone,
        if (widget.customerEmail != null) 'email': widget.customerEmail,
      },
      'notes': {
        'loan_id': widget.loanId,
        'mandate_id': mandate.id,
      },
    };

    try {
      _razorpay.open(options);
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) {
    if (!mounted) return;
    final reference = response.paymentId ?? response.orderId ?? '';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Mandate authorisation submitted: $reference')),
    );
    _refresh();
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    if (!mounted) return;
    setState(() => _error = response.message ?? 'Mandate authorisation failed');
    _refresh();
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    if (!mounted) return;
    final wallet = response.walletName ?? 'external wallet';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('External wallet selected: $wallet')),
    );
  }

  Future<void> _cancelMandate() async {
    if (_mandate == null) return;
    final reason = await showDialog<String>(
      context: context,
      builder: (_) {
        String r = '';
        return AlertDialog(
          title: const Text('Cancel Mandate'),
          content: TextField(
            decoration:
                const InputDecoration(hintText: 'Reason for cancellation'),
            onChanged: (v) => r = v,
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Back')),
            TextButton(
              onPressed: () => Navigator.pop(context, r),
              style: TextButton.styleFrom(foregroundColor: AppColors.danger),
              child: const Text('Cancel Mandate'),
            ),
          ],
        );
      },
    );
    if (reason == null) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(nachServiceProvider)
          .cancelMandate(_mandate!.id, reason: reason.isEmpty ? null : reason);
      await _refresh();
    } catch (e) {
      setState(() => _error = e.toString());
    }
    setState(() => _busy = false);
  }

  static const _statusStyles = <String, (Color, Color, String)>{
    'active': (Color(0x1A22C55E), Color(0xFF16A34A), 'Active'),
    'pending_auth': (Color(0x1AF59E0B), Color(0xFFD97706), 'Pending Auth'),
    'created': (Color(0x1AF59E0B), Color(0xFFD97706), 'Created'),
    'cancelled': (Color(0x268892A4), Color(0xFF6B7280), 'Cancelled'),
    'rejected': (Color(0x1AEF4444), Color(0xFFDC2626), 'Rejected'),
    'paused': (Color(0x268892A4), Color(0xFF6B7280), 'Paused'),
    'expired': (Color(0x268892A4), Color(0xFF6B7280), 'Expired'),
  };

  @override
  Widget build(BuildContext context) {
    if (!_loaded) return const SizedBox.shrink();
    final fmt = ref.watch(currencyFmtProvider);
    final style = _mandate != null
        ? _statusStyles[_mandate!.status] ?? _statusStyles['created']!
        : null;

    return Container(
      margin: const EdgeInsets.only(top: 16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          GestureDetector(
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
              child: Row(
                children: [
                  const Text('🏦', style: TextStyle(fontSize: 20)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text('e-NACH Auto-Debit',
                        style: AppTypography.sectionTitle),
                  ),
                  if (_mandate != null && style != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: style.$1,
                        borderRadius:
                            BorderRadius.circular(AppTokens.radiusBadge),
                      ),
                      child: Text(style.$3,
                          style: AppTypography.caption.copyWith(
                              color: style.$2, fontWeight: FontWeight.w700)),
                    ),
                  const SizedBox(width: 8),
                  Icon(
                    _expanded ? Icons.expand_less : Icons.expand_more,
                    color: AppColors.textSecondary,
                  ),
                ],
              ),
            ),
          ),
          if (_expanded) ...[
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  margin: const EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(
                    color: AppColors.dangerBg,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(_error!,
                      style: AppTypography.caption
                          .copyWith(color: AppColors.danger)),
                ),
              ),
            // No mandate — show prompt
            if (_mandate == null && !_showForm)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'No auto-debit mandate. Register e-NACH so EMIs are '
                        'pulled from the borrower\'s bank automatically.',
                        style: AppTypography.caption,
                      ),
                    ),
                    if (widget.isAdmin)
                      TextButton(
                        onPressed: () => setState(() => _showForm = true),
                        child: const Text('Set up'),
                      ),
                  ],
                ),
              ),
            // Active mandate — show details
            if (_mandate != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _DetailRow('Account holder', _mandate!.accountHolderName),
                    _DetailRow('Account', _mandate!.maskedAccount),
                    _DetailRow('Bank / IFSC',
                        '${_mandate!.bankName ?? "—"} · ${_mandate!.ifscCode}'),
                    _DetailRow('Max debit', fmt.format(_mandate!.maxAmount)),
                    if (_mandate!.activatedAt != null)
                      _DetailRow('Active since',
                          DateFormat('dd MMM yyyy').format(_mandate!.activatedAt!)),
                    // Presentations
                    if (_mandate!.presentations.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Text('RECENT DEBITS',
                          style: AppTypography.caption.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AppColors.textSecondary)),
                      const SizedBox(height: 6),
                      ...(_mandate!.presentations.take(5).map((p) {
                        final isOk = p.status == 'success';
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '${DateFormat('dd MMM').format(p.presentedAt)} · ${fmt.format(p.amount)}',
                                style: AppTypography.caption,
                              ),
                              Text(
                                p.status +
                                    (p.failureReason != null
                                        ? ' — ${p.failureReason}'
                                        : ''),
                                style: AppTypography.caption.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color:
                                      isOk ? AppColors.success : AppColors.danger,
                                ),
                              ),
                            ],
                          ),
                        );
                      })),
                    ],
                    // Cancel button
                    if (widget.isAdmin &&
                        ['active', 'pending_auth', 'created', 'paused']
                            .contains(_mandate!.status))
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: TextButton(
                          onPressed: _busy ? null : _cancelMandate,
                          style: TextButton.styleFrom(
                              foregroundColor: AppColors.danger),
                          child: const Text('Cancel Mandate'),
                        ),
                      ),
                  ],
                ),
              ),
            // Mandate form
            if (_showForm)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: Column(
                  children: [
                    TextField(
                      controller: _holderCtrl,
                      decoration: const InputDecoration(
                          labelText: 'Account holder name', isDense: true),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _accountCtrl,
                      decoration: const InputDecoration(
                          labelText: 'Account number', isDense: true),
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _confirmCtrl,
                      decoration: const InputDecoration(
                          labelText: 'Confirm account number', isDense: true),
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _ifscCtrl,
                      decoration: const InputDecoration(
                          labelText: 'IFSC code', isDense: true),
                      textCapitalization: TextCapitalization.characters,
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _bankCtrl,
                      decoration: const InputDecoration(
                          labelText: 'Bank name (optional)', isDense: true),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            value: _accountType,
                            decoration: const InputDecoration(
                                labelText: 'Account type', isDense: true),
                            items: const [
                              DropdownMenuItem(
                                  value: 'savings', child: Text('Savings')),
                              DropdownMenuItem(
                                  value: 'current', child: Text('Current')),
                            ],
                            onChanged: (v) =>
                                setState(() => _accountType = v ?? 'savings'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: _maxAmountCtrl,
                            decoration: const InputDecoration(
                                labelText: 'Max debit (₹)', isDense: true),
                            keyboardType: TextInputType.number,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: _authType,
                      decoration: const InputDecoration(
                          labelText: 'Authorisation method', isDense: true),
                      items: const [
                        DropdownMenuItem(
                            value: 'netbanking', child: Text('Net Banking')),
                        DropdownMenuItem(
                            value: 'debitcard', child: Text('Debit Card')),
                        DropdownMenuItem(
                            value: 'aadhaar', child: Text('Aadhaar')),
                      ],
                      onChanged: (v) =>
                          setState(() => _authType = v ?? 'netbanking'),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton(
                            onPressed: _busy ? null : _submitMandate,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: Colors.white,
                            ),
                            child: Text(
                                _busy ? 'Creating…' : 'Create & Authorise'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        TextButton(
                          onPressed: () => setState(() {
                            _showForm = false;
                            _error = null;
                          }),
                          child: const Text('Cancel'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label,
                style:
                    AppTypography.caption.copyWith(color: AppColors.textSecondary)),
          ),
          Expanded(
            child: Text(value,
                style:
                    AppTypography.body.copyWith(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}
