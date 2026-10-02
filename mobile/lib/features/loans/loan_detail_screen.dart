import 'dart:typed_data';
import 'package:printing/printing.dart';
import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'dart:convert';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/data/services/collection_service.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/core/l10n/app_strings.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/instalment.dart';
import 'package:zolofund/data/models/loan.dart';
import 'package:zolofund/features/loans/gold_servicing_sheet.dart';
import 'package:zolofund/features/loans/property_servicing_sheet.dart';
import 'package:zolofund/features/loans/product_servicing_sheet.dart';
import 'package:zolofund/features/loans/widgets/nach_panel.dart';
import 'package:zolofund/features/loans/widgets/quick_put_bill_card.dart';
import 'package:zolofund/core/network/authed_image.dart';
import 'package:zolofund/data/models/collection_entry.dart';
import 'package:zolofund/data/services/approval_service.dart';
import 'package:zolofund/data/services/loan_service.dart';
import 'package:zolofund/data/services/penalty_service.dart';
import 'package:zolofund/features/collection/quick_collect_sheet.dart';
import 'package:zolofund/features/loans/widgets/loan_heatmap.dart';
import 'package:zolofund/shared/widgets/app_badge.dart';
import 'package:zolofund/shared/widgets/empty_state.dart';
import 'package:zolofund/shared/widgets/skeleton.dart';

final loanDetailProvider =
    FutureProvider.autoDispose.family<Loan, String>((ref, id) {
  return ref.watch(loanServiceProvider).getById(id);
});

final _customerLoansProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, customerId) {
  return ref.watch(loanServiceProvider).list(customerId: customerId);
});

/// Server figure (metrics.dueNow, LD-03) — no client maths.
double _dueNowForLoan(Loan loan) => loan.metrics?.dueNow ?? 0;

class LoanDetailScreen extends ConsumerWidget {
  const LoanDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(loanDetailProvider(id));
    final t = T.of(ref);

    final loaded = async.valueOrNull;
    return Scaffold(
      appBar: AppBar(
        title: Text(t.x('title.loan_details')),
        centerTitle: true,
        actions: [
          if (loaded != null && loaded.loanType == 'gold')
            IconButton(
              icon: const Icon(Icons.workspace_premium_outlined),
              tooltip: t.x('gold.servicing'),
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (_) => GoldServicingSheet(loanId: loaded.id),
              ),
            ),
          if (loaded != null && loaded.loanType == 'property')
            IconButton(
              icon: const Icon(Icons.home_work_outlined),
              tooltip: 'Property servicing',
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (_) => PropertyServicingSheet(loan: loaded),
              ),
            ),
          if (loaded != null && loaded.loanType == 'other')
            IconButton(
              icon: const Icon(Icons.shopping_bag_outlined),
              tooltip: 'Product servicing',
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (_) => ProductServicingSheet(loan: loaded),
              ),
            ),
          if (loaded != null && loaded.status != 'closed')
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              // The edit screen always files a reviewed request (requestEdit /
              // PATCH) regardless of role — safe to show to agents too; it
              // was previously hidden from them for no functional reason.
              tooltip: t.x('loan.edit_title'),
              onPressed: () =>
                  context.push('/loans/${loaded.id}/edit', extra: loaded),
            ),
        ],
      ),
      body: async.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: Skeleton(height: 200, borderRadius: 12),
        ),
        error: (e, _) => EmptyState(
          icon: Icons.cloud_off,
          title: t.x('err.could_not_load_loan'),
          subtitle: e.toString(),
        ),
        data: (loan) => _LoanBody(loan: loan),
      ),
      bottomNavigationBar: loaded == null ? null : _LoanBottomBar(loan: loaded),
    );
  }
}

class _LoanBody extends ConsumerStatefulWidget {
  const _LoanBody({required this.loan});
  final Loan loan;

  @override
  ConsumerState<_LoanBody> createState() => _LoanBodyState();
}

class _LoanBodyState extends ConsumerState<_LoanBody> {
  final _scrollCtrl = ScrollController();
  final _pageCtrl = PageController();
  final _rowKeys = <int, GlobalKey>{};
  int? _highlight;
  String _viewMode = 'actual';
  bool _restructureToggle = false;
  bool _tenureOver = false;

  /// The restructured rate is for the tenure only — once the last scheduled
  /// due is behind today the loan runs on extended days at the normal rate.
  bool get _showRestructuredRates => _restructureToggle && !_tenureOver;
  int _currentSummaryPage = 0;

  @override
  void dispose() {
    _scrollCtrl.dispose();
    _pageCtrl.dispose();
    super.dispose();
  }

  void _jumpTo(int instalmentNo) {
    final key = _rowKeys[instalmentNo];
    final ctx = key?.currentContext;
    if (ctx == null) return;
    Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeInOutCubic,
      alignment: 0.2,
    );
    setState(() => _highlight = instalmentNo);
    Future<void>.delayed(const Duration(milliseconds: 1800), () {
      if (!mounted) return;
      setState(() => _highlight = null);
    });
  }

  @override
  Widget build(BuildContext context) {
    final loan = widget.loan;
    final fmt = ref.watch(currencyFmtProvider);
    final isMicrolending =
        ref.watch(authControllerProvider).user?.appType == AppType.microlending;
    final compactSchedule =
        isMicrolending && MediaQuery.sizeOf(context).width < 600;
    // Progress ring & paid period come directly from server metrics (GET /api/v1/loans/[id]).
    final paid = loan.metrics?.paidPeriod ?? 0;
    final progress = loan.metrics?.progress ?? 0.0;

    _tenureOver = loan.extendedSchedule?.scheduleFinished ?? false;
    final displayInstalments = _computeDisplayInstalments(loan);

    return ListView(
      controller: _scrollCtrl,
      padding: const EdgeInsets.all(16),
      children: [
        // ── Closed-loan banner ───────────────────────────────────────────
        if (loan.status == 'closed') ...[
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: const Color(0xFF10B981).withAlpha(25),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: const Color(0xFF10B981).withAlpha(60),
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(
                    color: Color(0xFF10B981),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check_rounded,
                    color: Colors.white,
                    size: 18,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Consumer(
                        builder: (ctx, ref, _) => Text(
                          T.of(ref).x('loan.closed_banner'),
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF10B981),
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Consumer(
                        builder: (ctx, ref, _) => Text(
                          T.of(ref).x('loan.closed_banner_sub'),
                          style: TextStyle(
                            fontSize: 12,
                            color: const Color(0xFF10B981).withAlpha(200),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
        ],
        // Auto Finance: instant call / WhatsApp / receipt right at the top,
        // so a field agent never scrolls to take cash. The module comes from
        // the session — Loan itself does not carry appType.
        if (ref.watch(authControllerProvider).user?.appType ==
            AppType.autofinance) ...[
          QuickPutBillCard(
            loan: loan,
            dueNow: _dueNowForLoan(loan),
            onCompleted: () => ref.invalidate(loanDetailProvider(loan.id)),
          ),
          const SizedBox(height: 14),
        ],
        _buildSummaryCards(loan, fmt, progress, paid),
        const SizedBox(height: 10),
        _LoanPillRow(loan: loan),
        if (loan.loanType == 'gold' ||
            loan.loanType == 'property' ||
            loan.loanType == 'other') ...[
          const SizedBox(height: 14),
          _buildCollateralDetailsCard(loan, fmt),
        ],
        const SizedBox(height: 14),
        LoanHeatmap(
          instalments: displayInstalments,
          onJump: _jumpTo,
          extraPeriods: loan.extendedSchedule?.extraPeriods ?? 0,
          projectedEndDate: loan.extendedSchedule?.projectedEndDate,
          extendedRows: loan.extendedSchedule?.extendedRows ?? const [],
        ),
        if (!_showRestructuredRates &&
            loan.extendedSchedule != null &&
            loan.extendedSchedule!.extraPeriods > 0) ...[
          const SizedBox(height: 14),
          _ExtendedPlanCard(loan: loan, fmt: fmt),
        ],
        const SizedBox(height: 14),
        _OverdueSummaryCard(loan: loan, fmt: fmt),
        const SizedBox(height: 14),
        _PenaltySummaryCard(loan: loan, fmt: fmt),
        const SizedBox(height: 14),
        Consumer(
          builder: (ctx, ref, _) {
            final user = ref.watch(authControllerProvider).user;
            final isAdmin = user != null &&
                (user.role == UserRole.admin ||
                    user.role == UserRole.superadmin ||
                    user.role == UserRole.developer);
            return NachPanel(
              loanId: loan.id,
              customerId: loan.customerId,
              customerName: loan.customer?.name,
              customerPhone: loan.customer?.phone,
              customerEmail: loan.customer?.email,
              defaultMaxAmount: loan.perInstalment, // LD-04: same default as web
              isAdmin: isAdmin,
            );
          },
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.symmetric(vertical: 6),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppTokens.radius),
            boxShadow: AppTokens.shadow,
          ),
          child: Column(
            children: [
              _buildListControls(ref),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Consumer(
                    builder: (ctx, ref, _) => Text(
                      T.of(ref).x('loan.payment_schedule'),
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ),
              ),
              // A compact card carries the same schedule fields on phones.
              if (!compactSchedule)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: const BoxDecoration(
                    color: AppColors.background,
                    border: Border(
                      bottom: BorderSide(color: AppColors.border),
                    ),
                  ),
                  child: Consumer(
                    builder: (ctx, ref, _) {
                      final t = T.of(ref);
                      return Row(
                        children: [
                          SizedBox(
                            width: 30,
                            child: Text(
                              '#',
                              style: AppTypography.tiny
                                  .copyWith(fontWeight: FontWeight.w700),
                            ),
                          ),
                          Expanded(
                            flex: 3,
                            child: Text(
                              t.x('loan.col_date'),
                              style: AppTypography.tiny
                                  .copyWith(fontWeight: FontWeight.w700),
                            ),
                          ),
                          Expanded(
                            flex: 2,
                            child: Text(
                              t.x('loan.col_due'),
                              style: AppTypography.tiny.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                              textAlign: TextAlign.right,
                            ),
                          ),
                          Expanded(
                            flex: 2,
                            child: Text(
                              t.x('loan.col_received'),
                              style: AppTypography.tiny.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                              textAlign: TextAlign.right,
                            ),
                          ),
                          const SizedBox(width: 8),
                          SizedBox(
                            width: 70,
                            child: Text(
                              t.x('loan.col_status'),
                              style: AppTypography.tiny
                                  .copyWith(fontWeight: FontWeight.w700),
                              textAlign: TextAlign.center,
                            ),
                          ),
                          const SizedBox(width: 4),
                          SizedBox(
                            width: 48,
                            child: Text(
                              t.x('loan.col_action'),
                              style: AppTypography.tiny
                                  .copyWith(fontWeight: FontWeight.w700),
                              textAlign: TextAlign.center,
                            ),
                          ),
                          const Spacer(),
                        ],
                      );
                    },
                  ),
                ),
              ...displayInstalments.map(
                (inst) => _InstalmentRow(
                  key: _rowKeys.putIfAbsent(
                    inst.instalmentNo,
                    GlobalKey.new,
                  ),
                  inst: inst,
                  loan: loan,
                  fmt: fmt,
                  highlighted: _highlight == inst.instalmentNo,
                  isRestructured: _showRestructuredRates,
                  // Server-computed (lib/restructure.ts) — no client math.
                  restructuredAmount: inst.restructuredAmount ?? inst.dueAmount,
                  mobile: compactSchedule,
                ),
              ),
              if (!_showRestructuredRates &&
                  loan.extendedSchedule != null &&
                  loan.extendedSchedule!.extraPeriods > 0)
                ..._buildProjectedExtraRows(loan, fmt, compactSchedule),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCollateralDetailsCard(Loan loan, NumberFormat fmt) {
    if (loan.loanType == 'property') {
      final pc = loan.propertyCollateral;
      if (pc == null) return const SizedBox();
      final isReleased = (pc['mortgageStatus'] ?? 'mortgaged') == 'released';

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
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('🏡 Property Collateral', style: AppTypography.bodyLarge),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: isReleased
                        ? AppColors.success.withAlpha(28)
                        : AppColors.danger.withAlpha(28),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    isReleased ? 'Released' : 'Mortgaged',
                    style: AppTypography.caption.copyWith(
                      color: isReleased ? AppColors.success : AppColors.danger,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            _detailRow('Type',
                (pc['propertyType'] ?? 'residential').toString().toUpperCase()),
            _detailRow('Value', '₹ ${pc['marketValue'] ?? '—'}'),
            _detailRow('Address', (pc['address'] ?? '—').toString()),
            if (pc['titleDeedPath'] != null ||
                pc['ecPath'] != null ||
                pc['taxReceiptPath'] != null) ...[
              const SizedBox(height: 12),
              Text('Documents',
                  style: AppTypography.caption
                      .copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 6),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (pc['titleDeedPath'] != null)
                    _docPill('Title Deed', pc['titleDeedPath'].toString()),
                  if (pc['ecPath'] != null)
                    _docPill('EC', pc['ecPath'].toString()),
                  if (pc['taxReceiptPath'] != null)
                    _docPill('Tax Receipt', pc['taxReceiptPath'].toString()),
                ],
              ),
            ],
          ],
        ),
      );
    } else if (loan.loanType == 'other') {
      final pi = loan.productFinanceItem;
      if (pi == null) return const SizedBox();
      final isRepossessed =
          (pi['repossessionStatus'] ?? 'active') == 'repossessed';

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
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('📱 Product Financing', style: AppTypography.bodyLarge),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: isRepossessed
                        ? AppColors.danger.withAlpha(28)
                        : AppColors.success.withAlpha(28),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    isRepossessed ? 'Repossessed' : 'Active',
                    style: AppTypography.caption.copyWith(
                      color:
                          isRepossessed ? AppColors.danger : AppColors.success,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            _detailRow(
                'Product', '${pi['brand'] ?? ''} ${pi['productName'] ?? ''}'),
            _detailRow('Model / Serial',
                '${pi['modelNo'] ?? '—'} / ${pi['serialNo'] ?? '—'}'),
            _detailRow('Invoice Amount', '₹ ${pi['invoiceAmount'] ?? '—'}'),
            _detailRow('Dealer', (pi['dealerName'] ?? '—').toString()),
            if (pi['invoicePath'] != null || pi['photoPath'] != null) ...[
              const SizedBox(height: 12),
              Text('Documents',
                  style: AppTypography.caption
                      .copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 6),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (pi['invoicePath'] != null)
                    _docPill('Invoice', pi['invoicePath'].toString()),
                  if (pi['photoPath'] != null)
                    _docPill('Photo Verification', pi['photoPath'].toString()),
                ],
              ),
            ],
          ],
        ),
      );
    }
    // LD-04: cheque collateral (default type) — the loan's JSON cheque plus the
    // customer's security cheques, same as web.
    if (loan.loanType == null || loan.loanType == 'cheque') {
      final t = T.of(ref);
      Map<String, dynamic> col = const {};
      try {
        final raw = loan.collateralDetails;
        if (raw != null && raw.isNotEmpty) {
          final decoded = jsonDecode(raw);
          if (decoded is Map<String, dynamic>) col = decoded;
        }
      } catch (_) {}
      final cheques = loan.customer?.securityCheques ?? const [];
      final bankName = col['bankName']?.toString() ?? '';
      if (bankName.isEmpty && cheques.isEmpty) return const SizedBox();
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
            Text(t.x('loan.fld_collateral'), style: AppTypography.bodyLarge),
            if (bankName.isNotEmpty) ...[
              const SizedBox(height: 10),
              _detailRow(t.x('fld.bank_name'), bankName),
              _detailRow(t.x('fld.cheque_no'), col['chequeNumber']?.toString() ?? '—'),
              _detailRow(t.x('fld.amount'),
                  fmt.format(double.tryParse('${col['chequeAmount'] ?? 0}') ?? 0)),
            ],
            for (final ch in cheques)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text('${ch.bankName} — ${ch.chequeNumber}',
                          style: AppTypography.body),
                    ),
                    Text(ch.status, style: AppTypography.caption),
                  ],
                ),
              ),
          ],
        ),
      );
    }
    return const SizedBox();
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label,
                style:
                    AppTypography.caption.copyWith(color: AppColors.textLight)),
          ),
          Expanded(
              child: Text(value,
                  style: AppTypography.caption
                      .copyWith(color: AppColors.textPrimary))),
        ],
      ),
    );
  }

  Widget _docPill(String label, String url) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.primary.withAlpha(15),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withAlpha(40)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.description_outlined, size: 14, color: AppColors.primary),
          const SizedBox(width: 4),
          Text(label,
              style: AppTypography.tiny.copyWith(
                  color: AppColors.primary, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  List<Instalment> _computeDisplayInstalments(Loan loan) {
    if (_viewMode == 'actual') {
      // Past the term the server sends the date ledger (EXT-1): cash filled
      // oldest-due-first, so the rows show the dues actually still unpaid.
      return loan.instalments
          .map(
            (i) => i.ledgerStatus == null
                ? i
                : i.copyWith(
                    receivedAmount: i.ledgerReceivedAmount ?? 0,
                    status: i.ledgerStatus,
                  ),
          )
          .toList();
    }

    final dist = loan.instalments.map((i) => i.copyWith()).toList();
    double remaining =
        loan.instalments.fold(0.0, (sum, i) => sum + i.receivedAmount);
    final today = DateTime.now();
    final todayStart = DateTime(today.year, today.month, today.day);

    for (var i = 0; i < dist.length; i++) {
      final due = dist[i].dueAmount;
      if (remaining >= due) {
        dist[i] = dist[i].copyWith(receivedAmount: due, status: 'paid');
        remaining -= due;
      } else if (remaining > 0) {
        dist[i] =
            dist[i].copyWith(receivedAmount: remaining, status: 'partial');
        remaining = 0;
      } else {
        final dDate = DateTime(
            dist[i].dueDate.year, dist[i].dueDate.month, dist[i].dueDate.day);
        dist[i] = dist[i].copyWith(
          receivedAmount: 0,
          status: dist[i].status == 'waived'
              ? 'waived'
              : (dDate.isBefore(todayStart) ? 'missed' : 'upcoming'),
        );
      }
    }
    return dist;
  }

  List<Widget> _buildProjectedExtraRows(
      Loan loan, NumberFormat fmt, bool compactSchedule,) {
    final ext = loan.extendedSchedule;
    if (ext == null || ext.extraPeriods <= 0) return const [];

    if (ext.extendedRows.isNotEmpty) {
      final rows = <Widget>[];
      for (final r in ext.extendedRows) {
        rows.add(
          _ProjectedExtraRow(
            no: r.no,
            date: r.date,
            amount: r.amount,
            receivedAmount: r.receivedAmount,
            status: r.status,
            receivedAt: r.receivedAt,
            collectionEntryId: r.collectionEntryId,
            editInstalmentId: r.editInstalmentId,
            fmt: fmt,
            mobile: compactSchedule,
            loan: loan,
          ),
        );
      }
      return rows;
    }

    final extraPeriods = ext.extraPeriods;
    List<DateTime> dates;
    if (ext.projectedDates.isNotEmpty) {
      dates = ext.projectedDates.length >= extraPeriods
          ? ext.projectedDates.sublist(ext.projectedDates.length - extraPeriods)
          : ext.projectedDates;
    } else {
      final lastDate = loan.instalments.isNotEmpty
          ? loan.instalments.last.dueDate
          : DateTime.now();
      dates = List.generate(extraPeriods, (idx) {
        if (loan.frequency == 'weekly') {
          return lastDate.add(Duration(days: 7 * (idx + 1)));
        } else if (loan.frequency == 'monthly') {
          return DateTime(lastDate.year, lastDate.month + idx + 1, lastDate.day);
        } else {
          return lastDate.add(Duration(days: idx + 1));
        }
      });
    }

    final startNo = (loan.instalmentCount > 0 ? loan.instalmentCount : loan.instalments.length) + 1;
    final per = loan.perInstalment;

    final rows = <Widget>[];
    for (var idx = 0; idx < dates.length; idx++) {
      final date = dates[idx];
      final amount = (idx == dates.length - 1 && ext.finalPartial > 0)
          ? ext.finalPartial
          : per;
      rows.add(
        _ProjectedExtraRow(
          no: startNo + idx,
          date: date,
          amount: amount,
          receivedAmount: 0,
          status: 'projected',
          fmt: fmt,
          mobile: compactSchedule,
          loan: loan,
        ),
      );
    }
    return rows;
  }

  Widget _buildListControls(WidgetRef ref) {
    final t = T.of(ref);
    final isMicrolending =
        ref.watch(authControllerProvider).user?.appType == AppType.microlending;
    final modeSelector = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildSegment('actual', t.x('loan.actual')),
        _buildSegment('distributed', t.x('loan.distributed')),
      ],
    );
    final rateToggle = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Checkbox(
          value: _showRestructuredRates,
          onChanged: (v) => setState(() => _restructureToggle = v ?? false),
          activeColor: AppColors.primary,
          visualDensity: VisualDensity.compact,
        ),
        Text(
          t.x('loan.show_restructured_rate'),
          style: AppTypography.tiny.copyWith(
            fontWeight: FontWeight.w600,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: LayoutBuilder(
        builder: (context, constraints) =>
            isMicrolending && constraints.maxWidth < 600
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: modeSelector,
                      ),
                      if (!_tenureOver)
                      SizedBox(
                        width: constraints.maxWidth,
                        child: Row(
                          children: [
                            Checkbox(
                              value: _showRestructuredRates,
                              onChanged: (v) => setState(
                                  () => _restructureToggle = v ?? false),
                              activeColor: AppColors.primary,
                            ),
                            Expanded(
                              child: Text(t.x('loan.show_restructured_rate'),
                                  style: AppTypography.tiny),
                            ),
                          ],
                        ),
                      ),
                    ],
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      modeSelector,
                      if (!_tenureOver) rateToggle,
                    ],
                  ),
      ),
    );
  }

  Widget _buildSegment(String mode, String label) {
    final active = _viewMode == mode;
    return GestureDetector(
      onTap: () => setState(() => _viewMode = mode),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: active
              ? AppColors.primary.withValues(alpha: 0.1)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: active ? AppColors.primary : AppColors.border,
          ),
        ),
        margin: const EdgeInsets.only(right: 8),
        child: Text(
          label,
          style: AppTypography.caption.copyWith(
            fontWeight: FontWeight.w700,
            color: active ? AppColors.primary : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryCards(
      Loan loan, NumberFormat fmt, double progress, int paid) {
    return Column(
      children: [
        SizedBox(
          height: 250,
          child: PageView(
            controller: _pageCtrl,
            onPageChanged: (i) => setState(() => _currentSummaryPage = i),
            children: [
              _SummaryCardOverview(loan: loan, fmt: fmt, progress: progress),
              _SummaryCardMetrics(
                  loan: loan, fmt: fmt, progress: progress, paid: paid),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(2, (i) {
            final active = _currentSummaryPage == i;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.symmetric(horizontal: 4),
              height: 6,
              width: active ? 16 : 6,
              decoration: BoxDecoration(
                color: active ? AppColors.primary : AppColors.border,
                borderRadius: BorderRadius.circular(3),
              ),
            );
          }),
        ),
      ],
    );
  }
}

/// Missed instalments + overdue amount (strictly before today — does not
/// include today's due). Matches the web loan-detail "Overdues" card so both
/// platforms agree on the figure.
class _OverdueSummaryCard extends StatelessWidget {
  const _OverdueSummaryCard({required this.loan, required this.fmt});
  final Loan loan;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    // Server figures only (LD-03) — the Dart arrears fallback is gone.
    final missedCount = loan.metrics?.missedCount ?? 0;
    final overdueAmount = loan.metrics?.overdueAmount ?? 0;

    return Container(
      padding: const EdgeInsets.all(14),
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
              const Icon(
                Icons.report_problem_outlined,
                size: 18,
                color: AppColors.danger,
              ),
              const SizedBox(width: 6),
              Text('Overdues', style: AppTypography.sectionTitle),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _MiniStat(
                  label: 'Missed Days',
                  value: '$missedCount',
                  color: AppColors.danger,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MiniStat(
                  label: 'Overdue Amount',
                  value: fmt.format(overdueAmount),
                  color: AppColors.danger,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Total / settled+waived / net-due penalty snapshot, matching the web
/// loan-detail Penalty Summary card. `netPenalty = totalPenalty -
/// settledPenalty - waivedPenalty`, where totalPenalty is the greater of
/// recorded penalty rows or (missedCount * penaltyRate) — same server-side
/// convention the web page already uses, replicated client-side here since
/// both read from the same `loan.penalties` + `loan.penaltyRate` fields.
class _PenaltySummaryCard extends ConsumerWidget {
  const _PenaltySummaryCard({required this.loan, required this.fmt});
  final Loan loan;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Prefer server-supplied summary (single source of truth) to eliminate calculation drift
    final summary = loan.penaltySummary;
    final double totalPenalty;
    final double settledPenalty;
    final double waivedPenalty;
    final double netPenalty;

    if (summary != null) {
      totalPenalty = summary.gross;
      settledPenalty = summary.settled;
      waivedPenalty = summary.waived;
      netPenalty = summary.netDue;
    } else {
      final missedCount =
          loan.instalments.where((i) => i.dynamicStatus == 'missed').length;
      final recordedPenalty =
          loan.penalties.fold<double>(0, (s, p) => s + p.grossPenalty);
      final potentialPenalty = missedCount * loan.penaltyRate;
      totalPenalty =
          recordedPenalty > potentialPenalty ? recordedPenalty : potentialPenalty;
      settledPenalty =
          loan.penalties.fold<double>(0, (s, p) => s + p.settledAmount);
      waivedPenalty =
          loan.penalties.fold<double>(0, (s, p) => s + p.waivedAmount);
      netPenalty = totalPenalty - settledPenalty - waivedPenalty;
    }

    return Container(
      padding: const EdgeInsets.all(14),
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
              Icon(Icons.gavel_outlined, size: 18, color: AppColors.primary),
              const SizedBox(width: 6),
              Text('Penalty Summary', style: AppTypography.sectionTitle),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _MiniStat(
                  label: 'Total',
                  value: fmt.format(totalPenalty),
                  color: AppColors.danger,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _MiniStat(
                  label: 'Settled + Waived',
                  value: fmt.format(settledPenalty + waivedPenalty),
                  color: AppColors.success,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _MiniStat(
                  label: 'Net Due',
                  value: fmt.format(netPenalty),
                  color: AppColors.primaryDark,
                ),
              ),
            ],
          ),
          if (netPenalty > 0) ...[
            const SizedBox(height: 12),
            // DEC-06: agents (and staff) collect penalties here; money posts
            // to wallet / cash book / ledger like a loan collection.
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => _collectPenaltyDialog(context, ref, loan),
                icon: const Icon(Icons.payments_outlined, size: 16),
                label: Text(T.of(ref).x('pen.collect_penalty')),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _requestPenaltyWaiverDialog(context, ref, loan, netPenalty),
                icon: const Icon(Icons.request_quote_outlined, size: 16),
                label: Text(
                  T.of(ref).x('btn.request_waiver'),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// DEC-06: collect a penalty on this loan. The server splits the amount over
/// the loan's own open penalties, oldest first (DEC-03) — no local maths.
Future<void> _collectPenaltyDialog(BuildContext context, WidgetRef ref, Loan loan) async {
  final t = T.of(ref);
  final max = loan.penaltySummary?.netDue ?? 0;
  if (max <= 0) return;
  final ctrl = TextEditingController(text: max.toStringAsFixed(2));
  var paymentMode = 'cash';
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(t.x('pen.collect_penalty')),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: ctrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(labelText: t.x('pen.amount_rupee')),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: paymentMode,
            decoration: InputDecoration(labelText: t.x('pen.payment_mode')),
            items: [
              for (final m in const ['cash', 'upi', 'bank_transfer', 'cheque'])
                DropdownMenuItem(value: m, child: Text(t.x('pen.mode_$m'))),
            ],
            onChanged: (v) => paymentMode = v ?? 'cash',
          ),
        ],
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(t.x('common.cancel'))),
        FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(t.x('pen.confirm_settle'))),
      ],
    ),
  );
  final amount = double.tryParse(ctrl.text.trim()) ?? 0;
  ctrl.dispose();
  if (ok != true || amount <= 0 || !context.mounted) return;
  if (amount > max + 0.001) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(
            '${t.x('err.enter_valid_amount')} (max ${ref.read(currencyFmtProvider).format(max)})')));
    return;
  }
  try {
    await ref.read(penaltyServiceProvider).settleLoan(loanId: loan.id, amount: amount, paymentMode: paymentMode);
    ref.invalidate(loanDetailProvider(loan.id));
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }
}

/// DEC-01: the preclose penalty popup — paid / discount / waived. Returns the
/// `penaltyResolution` body or null when cancelled. The server re-checks it.
Future<Map<String, dynamic>?> _penaltyResolutionSheet(
    BuildContext context, WidgetRef ref, double due, int days) {
  final t = T.of(ref);
  final fmt = ref.read(currencyFmtProvider);
  var action = 'paid';
  var mode = 'cash';
  final ctrl = TextEditingController();
  return showModalBottomSheet<Map<String, dynamic>>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setLocal) {
        final collected = double.tryParse(ctrl.text.trim()) ?? 0;
        final amount = action == 'paid' ? due : action == 'discount' ? collected : 0.0;
        final valid = action != 'discount' || (collected > 0 && collected < due);
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(t.x('prc.penalty_title'), style: AppTypography.sectionTitle),
              const SizedBox(height: 8),
              Text('${t.x('prc.penalty_due')}: ${fmt.format(due)} ($days ${t.x('prc.penalty_days')})',
                  style: AppTypography.bodyLarge),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  for (final opt in const ['paid', 'discount', 'waived'])
                    ChoiceChip(
                      label: Text(t.x('prc.opt_$opt')),
                      selected: action == opt,
                      onSelected: (_) => setLocal(() => action = opt),
                    ),
                ],
              ),
              if (action == 'discount')
                TextField(
                  controller: ctrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(labelText: t.x('prc.collected')),
                  onChanged: (_) => setLocal(() {}),
                ),
              if (amount > 0)
                DropdownButtonFormField<String>(
                  initialValue: mode,
                  decoration: InputDecoration(labelText: t.x('loan.payment_mode')),
                  items: [
                    DropdownMenuItem(value: 'cash', child: Text(t.x('coll.cash'))),
                    DropdownMenuItem(value: 'upi', child: Text(t.x('coll.upi'))),
                    DropdownMenuItem(value: 'bank_transfer', child: Text(t.x('loan.bank_transfer'))),
                    DropdownMenuItem(value: 'cheque', child: Text(t.x('mode.cheque'))),
                  ],
                  onChanged: (v) => mode = v ?? 'cash',
                ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: valid
                      ? () => Navigator.pop(ctx, <String, dynamic>{
                            'action': action,
                            'amount': amount,
                            'paymentMode': amount > 0 ? mode : null,
                          })
                      : null,
                  child: Text(t.x('prc.continue')),
                ),
              ),
            ],
          ),
        );
      },
    ),
  ).whenComplete(ctrl.dispose);
}

/// The outcome sentence after a preclose (same wording as web).
String _penaltyOutcomeText(T t, NumberFormat fmt, Map<String, dynamic> o) {
  double n(Object? v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
  final key = o['action'] == 'waived'
      ? 'prc.outcome_waived'
      : o['action'] == 'discount'
          ? 'prc.outcome_discount'
          : 'prc.outcome_paid';
  return t
      .x(key)
      .replaceAll('{due}', fmt.format(n(o['due'])))
      .replaceAll('{paid}', fmt.format(n(o['paid'])))
      .replaceAll('{discount}', fmt.format(n(o['discount'])));
}

Future<void> _requestPenaltyWaiverDialog(
  BuildContext context,
  WidgetRef ref,
  Loan loan,
  double netPenalty,
) async {
  final t = T.of(ref);
  final activePenalty = loan.penalties.where((p) => p.status == 'pending' || p.status == 'partial').firstOrNull
      ?? loan.penalties.firstOrNull;

  if (activePenalty == null) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No recorded penalty row found to waive.')),
      );
    }
    return;
  }

  final amountCtrl = TextEditingController(text: netPenalty.toStringAsFixed(2));
  final reasonCtrl = TextEditingController();

  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(t.x('btn.request_waiver')),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Request a waiver for loan ${loan.loanCode}. An administrator reviews and approves this request.',
            style: AppTypography.caption,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: amountCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              labelText: 'Waiver Amount',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: reasonCtrl,
            decoration: const InputDecoration(
              labelText: 'Reason *',
              border: OutlineInputBorder(),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: Text(t.x('common.cancel')),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(t.x('btn.submit')),
        ),
      ],
    ),
  );

  if (confirmed != true) return;
  final amount = double.tryParse(amountCtrl.text.trim());
  final reason = reasonCtrl.text.trim();
  if (amount == null || amount <= 0 || reason.isEmpty) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid waiver amount and reason.')),
      );
    }
    return;
  }

  try {
    await ref.read(approvalServiceProvider).request(
      requestType: 'penalty_waive',
      entityType: 'penalty',
      entityId: activePenalty.id,
      requestedChanges: {'amount': amount},
      reason: reason,
    );
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Penalty waiver request submitted for review')),
    );
  } catch (e) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({
    required this.label,
    required this.value,
    required this.color,
  });
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: AppTypography.tiny.copyWith(color: AppColors.textLight),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: AppTypography.bodyLarge.copyWith(
              fontWeight: FontWeight.w800,
              color: color,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _SummaryCardOverview extends ConsumerWidget {
  const _SummaryCardOverview({
    required this.loan,
    required this.fmt,
    required this.progress,
  });
  final Loan loan;
  final NumberFormat fmt;
  final double progress;

  BadgeKind _badge(String s) => switch (s) {
        'active' => BadgeKind.active,
        'overdue' => BadgeKind.overdue,
        'closed' => BadgeKind.closed,
        'pending_review' || 'pending' => BadgeKind.pending,
        _ => BadgeKind.info,
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final pct = (progress * 100).round();
    final outstanding = loan.metrics?.totalOutstanding ?? 0;

    final name = loan.customer?.name ?? '—';
    final code = loan.customer?.customerCode ?? '';
    final photo = loan.customer?.photoUrl;
    final hasPhoto = photo != null && photo.isNotEmpty;

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
          // Combined customer identity + loan header.
          GestureDetector(
            onTap: () => context.push('/customers/${loan.customerId}'),
            behavior: HitTestBehavior.opaque,
            child: Row(
              children: [
                if (hasPhoto)
                  CircleAvatar(
                      radius: 34, backgroundImage: authedImage(ref, photo))
                else
                  CircleAvatar(
                    radius: 34,
                    backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                    child: Text(
                      loan.customer?.initials ?? '?',
                      style: TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w800,
                          fontSize: 22),
                    ),
                  ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: AppTypography.sectionTitle
                            .copyWith(fontSize: 18, letterSpacing: -0.3),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          if (code.isNotEmpty) ...[
                            Text(code, style: AppTypography.caption),
                            const SizedBox(width: 8),
                          ],
                          AppBadge(
                              label: loan.status, kind: _badge(loan.status)),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          const Divider(height: 1, color: AppColors.border),
          const SizedBox(height: 14),
          // Loan figures + progress ring.
          Row(
            children: [
              SizedBox(
                width: 72,
                height: 72,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CircularProgressIndicator(
                      value: progress.clamp(0.0, 1.0),
                      strokeWidth: 6,
                      backgroundColor: AppColors.border,
                      valueColor: AlwaysStoppedAnimation(AppColors.primary),
                    ),
                    Center(
                      child: Text(
                        '$pct%',
                        style: AppTypography.bodyLarge.copyWith(
                            fontWeight: FontWeight.w800, fontSize: 15),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(loan.loanCode, style: AppTypography.caption),
              const Spacer(),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(t.x('loan.lbl_principal').toUpperCase(),
                      style: AppTypography.tiny.copyWith(
                          color: AppColors.textLight,
                          fontWeight: FontWeight.w600)),
                  Text(fmt.format(loan.principalAmount),
                      style: AppTypography.bodyLarge
                          .copyWith(color: AppColors.textPrimary)),
                  const SizedBox(height: 8),
                  Text(t.x('loan.lbl_outstanding').toUpperCase(),
                      style: AppTypography.tiny.copyWith(
                          color: AppColors.textLight,
                          fontWeight: FontWeight.w600)),
                  Text(fmt.format(outstanding),
                      style: AppTypography.bodyLarge
                          .copyWith(color: AppColors.danger)),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SummaryCardMetrics extends ConsumerWidget {
  const _SummaryCardMetrics({
    required this.loan,
    required this.fmt,
    required this.progress,
    required this.paid,
  });
  final Loan loan;
  final NumberFormat fmt;
  final double progress;
  final int paid;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final totalCollected = loan.totalCollected;
    final perInstalment = loan.perInstalment;
    final totalRepayable = loan.totalPayable;
    final m = loan.metrics;
    final outstanding = m?.totalOutstanding ?? 0;
    final dueNow = _dueNowForLoan(loan);
    // LD-03: server counts (metrics.*), same as web.
    final dynamicRemainingCount = m?.remainingExtended ?? 0;
    final dynamicPaidCount = m?.paidPeriod ?? 0;
    final remainingActual = m?.remainingActual ?? 0;
    final finishingRate = loan.restructure?.available == true
        ? loan.restructure!.restructuredRate
        : 0.0;

    final extraPeriods = loan.extendedSchedule?.extraPeriods ?? 0;
    final tenureDisplay = extraPeriods > 0
        ? '${loan.instalmentCount} + $extraPeriods (${loan.instalmentCount + extraPeriods}) ${_periodUnit(loan, t)}'
        : '${loan.instalmentCount} ${_periodUnit(loan, t)}';

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
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: SingleChildScrollView(
                  child: Wrap(
                    spacing: 16,
                    runSpacing: 14,
                    children: [
                      _StatBlock(t.x('loan.lbl_principal'),
                          fmt.format(loan.principalAmount)),
                      _StatBlock(
                          t.x('loan.lbl_repayable'), fmt.format(totalRepayable),
                          valueColor: AppColors.primaryDark),
                      _StatBlock(t.x('loan.lbl_disbursed'),
                          fmt.format(loan.disbursedAmount)),
                      _StatBlock(t.x('loan.lbl_frequency'), loan.frequency),
                      _StatBlock(t.x('loan.lbl_tenure'), tenureDisplay),
                      _StatBlock(t.x('loan.lbl_start_date'),
                          DateFormat('dd MMM yyyy').format(loan.startDate)),
                      _StatBlock(
                          t.x('loan.lbl_per_inst'), fmt.format(perInstalment)),
                      _StatBlock(
                          t.x('loan.lbl_collected'), fmt.format(totalCollected),
                          valueColor: AppColors.success),
                      _StatBlock('Due now', fmt.format(dueNow),
                          valueColor: AppColors.warning),
                      _StatBlock(
                          t.x('loan.lbl_outstanding'), fmt.format(outstanding),
                          valueColor: AppColors.danger),
                      _StatBlock(t.x('loan.lbl_paid_period'),
                          '$dynamicPaidCount ${_periodUnit(loan, t)}',
                          valueColor: AppColors.success),
                      _StatBlock(t.x('loan.lbl_remaining_actual'),
                          '$remainingActual ${_periodUnit(loan, t)}',
                          valueColor: AppColors.danger),
                      _StatBlock(t.x('loan.lbl_remaining_extended'),
                          '$dynamicRemainingCount ${_periodUnit(loan, t)}',
                          valueColor: AppColors.danger),
                      if (finishingRate > 0)
                        _StatBlock(t.x('loan.lbl_finishing_rate'),
                            fmt.format(finishingRate),
                            valueColor: AppColors.primary),
                      if (extraPeriods > 0)
                        _StatBlock(
                          'Projected Days',
                          '+$extraPeriods ${_periodUnit(loan, t)}',
                          valueColor: AppColors.primary,
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatBlock extends StatelessWidget {
  const _StatBlock(this.label, this.value, {this.valueColor});
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: (MediaQuery.of(context).size.width - 32 - 16 - 70 - 16 - 16) /
          2, // approximate half width minus paddings
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: AppTypography.tiny.copyWith(
              color: AppColors.textLight,
              letterSpacing: 0.5,
              fontWeight: FontWeight.w600,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: AppTypography.body.copyWith(
              fontWeight: FontWeight.w700,
              fontSize: 13,
              color: valueColor ?? AppColors.textPrimary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

// Restructured rate is now computed server-side (lib/restructure.ts) and arrives
// per-instalment as `Instalment.restructuredAmount` — no client recomputation.

class _InstalmentRow extends ConsumerWidget {
  const _InstalmentRow({
    super.key,
    required this.inst,
    required this.loan,
    required this.fmt,
    required this.highlighted,
    this.isRestructured = false,
    this.restructuredAmount = 0,
    this.mobile = false,
  });
  final Instalment inst;
  final Loan loan;
  final NumberFormat fmt;
  final bool highlighted;
  final bool isRestructured;
  final double restructuredAmount;
  final bool mobile;

  BadgeKind _badgeKind(String dynStatus) => switch (dynStatus) {
        'paid' => BadgeKind.active,
        'partial' => BadgeKind.partial,
        'missed' => BadgeKind.overdue,
        'due_today' => BadgeKind.pending,
        'waived' => BadgeKind.waived,
        _ => BadgeKind.upcoming,
      };

  String _statusLabel(String dynStatus, T t) => switch (dynStatus) {
        'paid' => t.x('coll.filter_paid'),
        'partial' => t.x('coll.status_partial'),
        'missed' => t.x('coll.status_overdue_days'),
        'due_today' => t.x('coll.status_due_today'),
        'waived' => t.x('pen.waived'),
        _ => t.x('loan.upcoming'),
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final dynStatus = inst.dynamicStatus;
    final kind = _badgeKind(dynStatus);
    final dateFmt = DateFormat('dd MMM');
    final timeFmt = DateFormat('h:mm a');
    final isPaid = inst.receivedAmount > 0;
    final collectedTime =
        inst.receivedAt != null ? timeFmt.format(inst.receivedAt!) : null;

    // Determine if Pay button should show
    // LD-04: waived and missed rows are not paid from the row (match web).
    final canPay = loan.status != 'closed' &&
        dynStatus != 'paid' &&
        dynStatus != 'partial' &&
        dynStatus != 'waived' &&
        dynStatus != 'missed';

    if (mobile) {
      final showAdjustedDue = isRestructured &&
          restructuredAmount > 0 &&
          inst.receivedAmount < inst.dueAmount &&
          (restructuredAmount - inst.dueAmount).abs() >= 0.01;
      final preciseAmount = NumberFormat.decimalPattern(
        ref.watch(languageProvider).formatLocale,
      )..maximumFractionDigits = 2;
      final adjustedDue =
          '${ref.watch(currencySymbolProvider)}${preciseAmount.format(restructuredAmount)}';
      return AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: highlighted ? AppColors.primaryLight : AppColors.surface,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(AppTokens.radius),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${inst.instalmentNo}  •  ${dateFmt.format(inst.dueDate)}',
                    style: AppTypography.bodyLarge,
                  ),
                ),
                AppBadge(label: _statusLabel(dynStatus, t), kind: kind),
              ],
            ),
            if (collectedTime != null) ...[
              const SizedBox(height: 4),
              Text(collectedTime, style: AppTypography.caption),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t.x('loan.col_due'), style: AppTypography.caption),
                      SizedBox(
                        width: double.infinity,
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(
                            showAdjustedDue
                                ? adjustedDue
                                : fmt.format(inst.dueAmount),
                            style: AppTypography.bodyLarge,
                          ),
                        ),
                      ),
                      if (showAdjustedDue)
                        Text(
                          fmt.format(inst.dueAmount),
                          style: AppTypography.caption.copyWith(
                            decoration: TextDecoration.lineThrough,
                          ),
                        ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t.x('loan.col_received'),
                          style: AppTypography.caption),
                      SizedBox(
                        width: double.infinity,
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(
                            isPaid ? fmt.format(inst.receivedAmount) : '—',
                            style: AppTypography.bodyLarge.copyWith(
                              color: isPaid
                                  ? AppColors.success
                                  : AppColors.textLight,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (canPay)
                  _PayButton(
                    inst: inst,
                    loan: loan,
                    isRestructured: isRestructured,
                    restructuredAmount: restructuredAmount,
                    mobile: true,
                  )
                else if (isPaid)
                  IconButton(
                    icon: const Icon(Icons.edit_outlined),
                    tooltip: t.x('loan.actions'),
                    onPressed: () => _requestCollectionEdit(context, ref, inst),
                  ),
              ],
            ),
          ],
        ),
      );
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: highlighted
            ? AppColors.primaryLight
            : (dynStatus == 'paid'
                ? AppColors.background.withAlpha(128)
                : Colors.transparent),
        border: const Border(
          bottom: BorderSide(color: AppColors.border),
        ),
      ),
      child: Row(
        children: [
          // # column
          SizedBox(
            width: 30,
            child: Text(
              '${inst.instalmentNo}',
              style: AppTypography.caption.copyWith(
                color: AppColors.textLight,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          // Date + Time column
          Expanded(
            flex: 3,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  dateFmt.format(inst.dueDate),
                  style: AppTypography.body.copyWith(fontSize: 12.5),
                ),
                if (collectedTime != null)
                  Text(
                    collectedTime,
                    style: AppTypography.tiny.copyWith(
                      color: AppColors.textLight,
                    ),
                  ),
              ],
            ),
          ),
          // Due column — shows the restructured rate (with the original struck
          // through) for still-collectable future/today instalments when the
          // toggle is on and the figure actually changed.
          Expanded(
            flex: 2,
            child: Builder(
              builder: (_) {
                // Show the restructured rate on EVERY unpaid instalment
                // (missed + today + future), matching the server calc.
                final showAdj = isRestructured &&
                    restructuredAmount > 0 &&
                    inst.receivedAmount < inst.dueAmount &&
                    (restructuredAmount - inst.dueAmount).abs() >= 0.01;
                if (!showAdj) {
                  return Text(
                    fmt.format(inst.dueAmount),
                    style: AppTypography.body.copyWith(fontSize: 12),
                    textAlign: TextAlign.right,
                  );
                }
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      // Show paisa for the restructured rate (e.g. ₹206.25);
                      // trailing zeros trimmed. Matches the web value exactly.
                      '₹${NumberFormat('#,##0.##', 'en_IN').format(restructuredAmount)}',
                      style: AppTypography.body.copyWith(
                        fontSize: 12,
                        color: AppColors.primary,
                        fontWeight: FontWeight.w800,
                      ),
                      textAlign: TextAlign.right,
                    ),
                    Text(
                      fmt.format(inst.dueAmount),
                      style: AppTypography.extraTiny.copyWith(
                        color: AppColors.textLight,
                        decoration: TextDecoration.lineThrough,
                      ),
                      textAlign: TextAlign.right,
                    ),
                  ],
                );
              },
            ),
          ),
          // Received column
          Expanded(
            flex: 2,
            child: Text(
              isPaid ? fmt.format(inst.receivedAmount) : '—',
              style: AppTypography.body.copyWith(
                fontSize: 12,
                color: isPaid ? AppColors.success : AppColors.textLight,
              ),
              textAlign: TextAlign.right,
            ),
          ),
          const SizedBox(width: 8),
          // Status badge
          SizedBox(
            width: 70,
            child: Center(
              child: AppBadge(
                label: _statusLabel(dynStatus, t),
                kind: kind,
              ),
            ),
          ),
          const SizedBox(width: 4),
          // Pay action button
          SizedBox(
            width: 48,
            child: canPay
                ? _PayButton(
                    inst: inst,
                    loan: loan,
                    isRestructured: isRestructured,
                    restructuredAmount: restructuredAmount,
                    onCompleted: () {
                      // Force rebuild by invalidating the provider
                      // This is handled by the parent refreshing
                    },
                  )
                : (isPaid
                    ? IconButton(
                        icon: Icon(
                          Icons.check_circle,
                          size: 20,
                          color: AppColors.success.withAlpha(150),
                        ),
                        tooltip: 'Request correction',
                        padding: EdgeInsets.zero,
                        onPressed: () =>
                            _requestCollectionEdit(context, ref, inst),
                      )
                    : const SizedBox.shrink()),
          ),
        ],
      ),
    );
  }

  Future<void> _requestCollectionEdit(
    BuildContext context,
    WidgetRef ref,
    Instalment shown,
  ) async {
    await _requestInstalmentCorrection(context, ref, loan, shown);
  }
}

/// Correction request for an instalment row (tenure rows and extended days
/// whose payment is the only cash on its row). Acts on the posted amount,
/// never on a display view of it.
Future<void> _requestInstalmentCorrection(
  BuildContext context,
  WidgetRef ref,
  Loan loan,
  Instalment shown,
) async {
  // Corrections act on the amount actually posted on the row, never on a
  // display view (ledger / distributed) of it.
  final inst = loan.instalments.firstWhere(
    (i) => i.id == shown.id,
    orElse: () => shown,
  );
  final amountCtrl =
      TextEditingController(text: inst.receivedAmount.toStringAsFixed(2));
  final reasonCtrl = TextEditingController();
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Request correction'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'This won\'t apply immediately — an admin reviews and approves it.',
            style: AppTypography.caption,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: amountCtrl,
            keyboardType:
                const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              labelText: 'Correct amount',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: reasonCtrl,
            decoration: const InputDecoration(
              labelText: 'Reason *',
              border: OutlineInputBorder(),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: const Text('Submit'),
        ),
      ],
    ),
  );
  if (result != true) return;
  final amount = double.tryParse(amountCtrl.text.trim());
  final reason = reasonCtrl.text.trim();
  if (amount == null || reason.isEmpty) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid amount and reason')),
      );
    }
    return;
  }
  // LD-04: admins correct directly (same as web correctInstalmentPaymentAction);
  // agents file an edit_collection request (ROLE-7).
  final role = ref.read(authControllerProvider).user?.role;
  final isAdmin = role == UserRole.admin ||
      role == UserRole.superadmin ||
      role == UserRole.developer;
  try {
    if (isAdmin) {
      await ref.read(collectionServiceProvider).correctPayment(
            instalmentId: inst.id,
            correctedAmount: amount,
            remarks: reason,
          );
      ref.invalidate(loanDetailProvider(loan.id));
    } else {
      await ref.read(approvalServiceProvider).request(
            requestType: 'edit_collection',
            entityType: 'instalment',
            entityId: inst.id,
            requestedChanges: {'requestedAmount': amount},
            reason: reason,
          );
    }
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(isAdmin
            ? T.of(ref).x('msg.payment_corrected')
            : 'Correction request sent for review'),
      ),
    );
  } catch (e) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
    );
  }
}

class _ExtendedPlanCard extends StatelessWidget {
  const _ExtendedPlanCard({required this.loan, required this.fmt});
  final Loan loan;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    final ext = loan.extendedSchedule;
    // LD-04: shown whenever payments remain on the extended plan (as web).
    if (ext == null || ext.remainingPayments <= 0) return const SizedBox.shrink();
    final endDateStr = ext.projectedEndDate != null
        ? DateFormat('dd MMM yyyy').format(ext.projectedEndDate!)
        : '—';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFEEF2FF), // Indigo-50
        borderRadius: BorderRadius.circular(AppTokens.radius),
        border: Border.all(color: const Color(0xFFC7D2FE)), // Indigo-200
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFF6366F1).withAlpha(30),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.calendar_month_outlined,
              color: Color(0xFF4F46E5),
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
                    const Text(
                      'Extended Plan (Normal Rate)',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF312E81),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF6366F1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '+${ext.extraPeriods} days',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  '${ext.remainingPayments} more ${loan.frequency == 'daily' ? 'days' : loan.frequency == 'weekly' ? 'weeks' : 'periods'} at ${fmt.format(loan.perInstalment)} · finishes $endDateStr',
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF4338CA),
                    height: 1.3,
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

class _ProjectedExtraRow extends ConsumerWidget {
  const _ProjectedExtraRow({
    required this.no,
    required this.date,
    required this.amount,
    required this.fmt,
    required this.mobile,
    required this.loan,
    this.receivedAmount = 0,
    this.status = 'projected',
    this.receivedAt,
    this.collectionEntryId,
    this.editInstalmentId,
  });
  final int no;
  final DateTime date;
  final double amount;
  final NumberFormat fmt;
  final bool mobile;
  final Loan loan;
  final double receivedAmount;
  final String status;
  final DateTime? receivedAt;
  final String? collectionEntryId;

  /// Instalment whose correction edits exactly this day's payment (EXT-1).
  final String? editInstalmentId;

  BadgeKind _badgeKind(String s) => switch (s) {
        'paid' => BadgeKind.active,
        'partial' => BadgeKind.partial,
        'missed' => BadgeKind.overdue,
        'due today' || 'due_today' => BadgeKind.pending,
        _ => BadgeKind.upcoming,
      };

  String _statusLabel(String s, T t) => switch (s) {
        'paid' => t.x('coll.filter_paid'),
        'partial' => t.x('coll.status_partial'),
        'missed' => t.x('coll.status_overdue_days'),
        'due today' || 'due_today' => t.x('coll.status_due_today'),
        _ => 'Projected',
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final dateFmt = DateFormat('dd MMM');
    final timeFmt = DateFormat('h:mm a');
    final isPaid = status == 'paid';
    final isDueToday = status == 'due today';
    final isMissed = status == 'missed';
    final isProjected = status == 'projected';
    final canPay = loan.status != 'closed' && (isDueToday || isMissed);
    final canEdit = loan.status != 'closed' && editInstalmentId != null && receivedAmount > 0;
    final kind = _badgeKind(status);
    final collectedTime = receivedAt != null ? timeFmt.format(receivedAt!) : null;

    final inst = Instalment(
      id: collectionEntryId ?? 'ext-${loan.id}-$no',
      loanId: loan.id,
      instalmentNo: no,
      dueDate: date,
      dueAmount: amount,
      receivedAmount: receivedAmount,
      status: isPaid ? 'paid' : (isDueToday ? 'due today' : (isMissed ? 'missed' : 'upcoming')),
      receivedAt: receivedAt,
    );
    // The correction resolves the posted row by id — this day's payment is the
    // only cash on it (EXT-1), so it edits exactly this payment.
    Widget editButton() => IconButton(
          icon: const Icon(Icons.edit_outlined),
          tooltip: t.x('loan.actions'),
          onPressed: () => _requestInstalmentCorrection(
            context,
            ref,
            loan,
            inst.copyWith(id: editInstalmentId),
          ),
        );

    if (mobile) {
      Color borderColor = const Color(0xFFC7D2FE);
      Color bgColor = const Color(0xFFEEF2FF).withAlpha(160);
      Color numColor = const Color(0xFF3730A3);

      if (isPaid) {
        borderColor = AppColors.success.withAlpha(90);
        bgColor = AppColors.success.withAlpha(20);
        numColor = AppColors.success;
      } else if (isMissed) {
        borderColor = AppColors.danger.withAlpha(90);
        bgColor = AppColors.danger.withAlpha(20);
        numColor = AppColors.danger;
      } else if (isDueToday) {
        borderColor = AppColors.warning.withAlpha(120);
        bgColor = AppColors.warning.withAlpha(20);
        numColor = AppColors.warning;
      }

      return Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: bgColor,
          border: Border.all(color: borderColor),
          borderRadius: BorderRadius.circular(AppTokens.radius),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '$no  •  ${dateFmt.format(date)}',
                    style: AppTypography.bodyLarge.copyWith(color: numColor),
                  ),
                ),
                if (isProjected)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFF6366F1).withAlpha(30),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFF6366F1).withAlpha(80)),
                    ),
                    child: const Text(
                      'Projected',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF4F46E5),
                      ),
                    ),
                  )
                else
                  AppBadge(
                    label: _statusLabel(status, t),
                    kind: kind,
                  ),
              ],
            ),
            if (collectedTime != null) ...[
              const SizedBox(height: 4),
              Text(collectedTime, style: AppTypography.caption),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('DUE', style: AppTypography.caption),
                      Text(
                        fmt.format(amount),
                        style: AppTypography.bodyLarge.copyWith(
                          color: isProjected ? const Color(0xFF4F46E5) : AppColors.textPrimary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('RECEIVED', style: AppTypography.caption),
                      Text(
                        receivedAmount > 0 ? fmt.format(receivedAmount) : '—',
                        style: AppTypography.bodyLarge.copyWith(
                          color: isPaid ? AppColors.success : AppColors.textLight,
                          fontWeight: isPaid ? FontWeight.w700 : FontWeight.normal,
                        ),
                      ),
                    ],
                  ),
                ),
                if (canPay)
                  _PayButton(
                    inst: inst,
                    loan: loan,
                    mobile: true,
                    // LD-04: a missed extended day is paid for its own date (web).
                    collectionDate: isMissed ? date : null,
                  )
                else if (canEdit)
                  editButton()
                else
                  const SizedBox(width: 48),
              ],
            ),
          ],
        ),
      );
    }

    // Wide / Desktop layout
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: isPaid
            ? AppColors.success.withAlpha(15)
            : isMissed
                ? AppColors.danger.withAlpha(15)
                : isDueToday
                    ? AppColors.warning.withAlpha(15)
                    : const Color(0xFFF8FAFC),
        border: const Border(
          bottom: BorderSide(color: AppColors.border),
        ),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 30,
            child: Text(
              '$no',
              style: AppTypography.caption.copyWith(
                color: isProjected ? const Color(0xFF6366F1) : AppColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              dateFmt.format(date),
              style: AppTypography.body.copyWith(fontSize: 12.5),
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              fmt.format(amount),
              style: AppTypography.body.copyWith(
                fontSize: 12,
                color: isProjected ? const Color(0xFF4F46E5) : AppColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.right,
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              receivedAmount > 0 ? fmt.format(receivedAmount) : '—',
              style: AppTypography.body.copyWith(
                fontSize: 12,
                color: isPaid ? AppColors.success : AppColors.textLight,
                fontWeight: isPaid ? FontWeight.w700 : FontWeight.normal,
              ),
              textAlign: TextAlign.right,
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 70,
            child: Center(
              child: isProjected
                  ? Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF6366F1).withAlpha(30),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'Projected',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF4F46E5),
                        ),
                      ),
                    )
                  : AppBadge(
                      label: _statusLabel(status, t),
                      kind: kind,
                    ),
            ),
          ),
          const SizedBox(width: 4),
          SizedBox(
            width: 48,
            child: canPay
                ? _PayButton(
                    inst: inst,
                    loan: loan,
                    collectionDate: isMissed ? date : null,
                  )
                : canEdit
                ? editButton()
                : const Center(
                    child: Text(
                      '—',
                      style: TextStyle(color: AppColors.textLight),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

/// Pay button that opens the QuickCollectSheet for this instalment.
class _PayButton extends ConsumerWidget {
  const _PayButton({
    required this.inst,
    required this.loan,
    this.isRestructured = false,
    this.restructuredAmount = 0,
    this.onCompleted,
    this.mobile = false,
    this.collectionDate,
  });
  final Instalment inst;
  final Loan loan;
  final bool isRestructured;
  final double restructuredAmount;
  final VoidCallback? onCompleted;
  final bool mobile;
  /// Business date to record the payment on (extended missed day); null = today.
  final DateTime? collectionDate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final button = Material(
      color: AppColors.primary,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => _openPaySheet(context, ref),
        child: Padding(
          padding: mobile
              ? const EdgeInsets.all(15)
              : const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: const Icon(
            Icons.payments_outlined,
            color: Colors.white,
            size: 18,
          ),
        ),
      ),
    );
    return mobile
        ? Tooltip(message: T.of(ref).x('btn.collect'), child: button)
        : button;
  }

  void _openPaySheet(BuildContext context, WidgetRef ref) {
    var defaultAmount = inst.dueAmount;
    // Pre-fill the restructured (even-spread) rate for any unpaid instalment
    // when the toggle is on.
    if (isRestructured &&
        restructuredAmount > 0 &&
        inst.receivedAmount < inst.dueAmount) {
      defaultAmount = restructuredAmount;
    }

    final today = DateTime.now();
    final todayStart = DateTime(today.year, today.month, today.day);
    CollectionRow rowFor(Instalment source, {double? dueAmount}) {
      return CollectionRow(
        instalmentId: source.id,
        loanId: source.loanId,
        loanCode: loan.loanCode,
        customerId: loan.customerId,
        customerName: loan.customer?.name ?? '-',
        customerCode: loan.customer?.customerCode ?? '',
        customerPhone: loan.customer?.phone ?? '',
        routeName: null,
        dueAmount: dueAmount ?? source.dueAmount,
        receivedAmount: source.receivedAmount,
        dueDate: source.dueDate,
        status: source.dynamicStatus,
      );
    }

    final dueNowRows = loan.instalments
        .where((source) {
          final due = DateTime(
            source.dueDate.year,
            source.dueDate.month,
            source.dueDate.day,
          );
          return !due.isAfter(todayStart) && source.dynamicStatus != 'paid';
        })
        .map(rowFor)
        .toList(growable: false);

    // Build a CollectionRow from the instalment data to reuse QuickCollectSheet.
    // When opened from loan detail, seed every overdue/today row for this loan
    // so "Total Due" is overdue + today, not full outstanding.
    final row = CollectionRow(
      instalmentId: inst.id,
      loanId: inst.loanId,
      loanCode: loan.loanCode,
      customerId: loan.customerId,
      customerName: loan.customer?.name ?? '—',
      customerCode: loan.customer?.customerCode ?? '',
      customerPhone: loan.customer?.phone ?? '',
      routeName: null,
      dueAmount: defaultAmount,
      receivedAmount: inst.receivedAmount,
      dueDate: inst.dueDate,
      status: inst.dynamicStatus,
    );

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => QuickCollectSheet(
        row: row,
        scopeRows: dueNowRows.isEmpty ? [row] : dueNowRows,
        collectionDate: collectionDate,
      ),
    ).then((_) {
      // Invalidate the loan detail to refetch after payment
      ref.invalidate(loanDetailProvider(loan.id));
      onCompleted?.call();
    });
  }
}

class _LoanPillRow extends ConsumerWidget {
  const _LoanPillRow({required this.loan});
  final Loan loan;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_customerLoansProvider(loan.customerId));
    return async.when(
      loading: () => const SizedBox(height: 36),
      error: (_, __) => const SizedBox(height: 0),
      data: (loans) {
        if (loans.length <= 1) return const SizedBox.shrink();
        final visible = loans.take(3).toList(growable: false);
        final extra = loans.length - visible.length;
        return Wrap(
          alignment: WrapAlignment.center,
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final l in visible)
              _LoanPill(
                code: (l['loanCode'] as String?) ?? '',
                status: (l['status'] as String?) ?? 'active',
                active: (l['id'] as String?) == loan.id,
                onTap: () {
                  final id = l['id'] as String?;
                  if (id != null && id != loan.id) {
                    context.go('/loans/$id');
                  }
                },
              ),
            if (extra > 0)
              _LoanPillMore(
                count: extra,
                onTap: () => context.push('/customers/${loan.customerId}'),
              ),
          ],
        );
      },
    );
  }
}

class _LoanPill extends StatelessWidget {
  const _LoanPill({
    required this.code,
    required this.status,
    required this.active,
    required this.onTap,
  });
  final String code;
  final String status;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final dot = switch (status) {
      'overdue' => AppColors.danger,
      'closed' => AppColors.textLight,
      'pending_review' || 'pending' => AppColors.warning,
      _ => AppColors.success,
    };
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: active
              ? AppColors.primary.withValues(alpha: 0.10)
              : AppColors.surface,
          border: Border.all(
            color: active ? AppColors.primary : AppColors.border,
            width: 1.5,
          ),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: dot, shape: BoxShape.circle),
            ),
            const SizedBox(width: 6),
            Text(
              code.isEmpty ? '—' : code,
              style: AppTypography.caption.copyWith(
                fontWeight: FontWeight.w700,
                color: active ? AppColors.primary : AppColors.textPrimary,
                fontFamily: 'monospace',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LoanPillMore extends StatelessWidget {
  const _LoanPillMore({required this.count, required this.onTap});
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: AppColors.background,
          border: Border.all(color: AppColors.border, width: 1.5),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '+$count more',
              style: AppTypography.caption.copyWith(
                fontWeight: FontWeight.w700,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.chevron_right,
                size: 14, color: AppColors.textLight),
          ],
        ),
      ),
    );
  }
}

class _LoanBottomBar extends ConsumerWidget {
  const _LoanBottomBar({required this.loan});
  final Loan loan;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isClosed = loan.status == 'closed';
    final t = T.of(ref);

    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(top: BorderSide(color: AppColors.border)),
          boxShadow: AppTokens.shadowLg,
        ),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _exportStatement(context, ref),
                icon: const Icon(Icons.picture_as_pdf_outlined),
                label: Text(t.x('loan.statement')),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                  ),
                ),
              ),
            ),
            // LD-04: Close / Renew / Preclose are admin actions (web parity).
            if (!isClosed && _isAdminRole(ref)) ...[
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => _showActionSheet(context, ref),
                  icon: const Icon(Icons.tune_outlined),
                  label: Text(t.x('loan.actions')),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                    ),
                  ),
                ),
              ),
            ] else if (!isClosed && loan.agentPreclose?['enabled'] == true) ...[
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed: loan.agentPreclose?['status'] == 'pending'
                      ? null
                      : () => _requestPreclose(context, ref),
                  icon: const Icon(Icons.offline_pin_outlined),
                  label: Text(loan.agentPreclose?['status'] == 'pending'
                      ? t.x('preclose.request_pending')
                      : t.x('preclose.request')),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.warning,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// LD-06: agent files a loan_preclose request (lib/loanPrecloseRequests.ts),
  /// same as the web LoanPrecloseRequest form. Amount = server figure.
  Future<void> _requestPreclose(BuildContext context, WidgetRef ref) async {
    final t = T.of(ref);
    final fmt = ref.read(currencyFmtProvider);
    // DEC-01: amount and penalty from the server quote.
    Map<String, dynamic> quote;
    try {
      quote = await ref.read(loanServiceProvider).foreclosureQuote(loan.id);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
      return;
    }
    if (!context.mounted) return;
    final amount = double.tryParse('${quote['totalSettlementAmount'] ?? 0}') ?? 0;
    final penaltyDue = double.tryParse('${quote['penaltyDue'] ?? 0}') ?? 0;
    final reasonCtrl = TextEditingController();
    final remarksCtrl = TextEditingController();
    var mode = 'cash';
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: Text(t.x('preclose.request')),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(t.x('preclose.request_hint'), style: AppTypography.caption),
                const SizedBox(height: 10),
                Text('${t.x('preclose.settlement_amount')}: ${fmt.format(amount)}',
                    style: AppTypography.bodyLarge),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: mode,
                  decoration: InputDecoration(labelText: t.x('loan.payment_mode')),
                  items: [
                    DropdownMenuItem(value: 'cash', child: Text(t.x('coll.cash'))),
                    DropdownMenuItem(value: 'upi', child: Text(t.x('coll.upi'))),
                    DropdownMenuItem(value: 'cheque', child: Text(t.x('mode.cheque'))),
                    DropdownMenuItem(value: 'bank_transfer', child: Text(t.x('loan.bank_transfer'))),
                  ],
                  onChanged: (v) => setState(() => mode = v ?? 'cash'),
                ),
                TextField(
                  controller: remarksCtrl,
                  decoration: InputDecoration(labelText: t.x('loan.remarks')),
                ),
                TextField(
                  controller: reasonCtrl,
                  decoration: InputDecoration(labelText: '${t.x('preclose.reason')} *'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(t.x('common.cancel'))),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(t.x('preclose.send'))),
          ],
        ),
      ),
    );
    if (ok != true) return;
    final reason = reasonCtrl.text.trim();
    if (reason.isEmpty) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t.x('preclose.reason_required'))),
        );
      }
      return;
    }
    Map<String, dynamic>? resolution;
    if (penaltyDue > 0) {
      resolution = await _penaltyResolutionSheet(context, ref, penaltyDue,
          (double.tryParse('${quote['penaltyMissedDays'] ?? 0}') ?? 0).toInt());
      if (resolution == null || !context.mounted) return;
    }
    try {
      await ref.read(approvalServiceProvider).request(
            requestType: 'loan_preclose',
            entityType: 'loan',
            entityId: loan.id,
            requestedChanges: {
              'amount': amount,
              'paymentMode': mode,
              'remarks': remarksCtrl.text.trim(),
              if (resolution != null) 'penaltyResolution': resolution,
            },
            reason: reason,
          );
      ref.invalidate(loanDetailProvider(loan.id));
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t.x('preclose.request_pending'))),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  Future<void> _exportStatement(BuildContext context, WidgetRef ref) async {
    final messenger = ScaffoldMessenger.of(context);
    messenger.showSnackBar(
      SnackBar(
        content: Text('Downloading Loan Statement PDF...'),
        backgroundColor: AppColors.primary,
      ),
    );
    try {
      final bytes = await ref.read(loanServiceProvider).statementPdf(loan.id);
      if (bytes.isEmpty) throw Exception('Empty document');
      await Printing.layoutPdf(
        onLayout: (_) async => Uint8List.fromList(bytes),
        name: 'statement-${loan.loanCode}.pdf',
      );
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(
          content: Text('Failed to download statement: $e'),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  bool _isAdminRole(WidgetRef ref) {
    final role = ref.read(authControllerProvider).user?.role;
    return role == UserRole.admin ||
        role == UserRole.superadmin ||
        role == UserRole.developer;
  }

  void _showActionSheet(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    // Same predicate as web: preclose needs the add-on and is hidden for
    // interest-only loans (they use full closure).
    final canPreclose =
        (ref.read(authControllerProvider).user?.foreclosureEnabled ?? false) &&
            loan.deductionType != 'interest_only';
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              ListTile(
                leading: const Icon(Icons.check_circle_outline,
                    color: AppColors.success),
                title: Text(t.x('loan.mark_closed')),
                subtitle: const Text('Settle all dues and close this loan'),
                onTap: () {
                  Navigator.pop(ctx);
                  _confirmAction(context, ref, 'close');
                },
              ),
              ListTile(
                leading:
                    Icon(Icons.autorenew_outlined, color: AppColors.primary),
                title: Text(t.x('loan.renew')),
                subtitle:
                    const Text('Create a renewal package for the customer'),
                onTap: () {
                  Navigator.pop(ctx);
                  _confirmAction(context, ref, 'renew');
                },
              ),
              if (canPreclose)
                ListTile(
                  leading: const Icon(Icons.offline_pin_outlined,
                      color: AppColors.warning),
                  title: Text(t.x('loan.preclose')),
                  subtitle:
                      const Text('Calculate pre-closure charges and settle'),
                  onTap: () {
                    Navigator.pop(ctx);
                    _confirmAction(context, ref, 'preclose');
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  /// DEC-01: admin preclose from the server quote (GET .../foreclosure-calc) —
  /// line items, discount, minimum amount and the penalty popup, as on web.
  Future<void> _precloseWithQuote(BuildContext context, WidgetRef ref) async {
    final t = T.of(ref);
    final fmt = ref.read(currencyFmtProvider);
    final svc = ref.read(loanServiceProvider);
    Map<String, dynamic> quote;
    try {
      quote = await svc.foreclosureQuote(loan.id);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
      return;
    }
    if (!context.mounted) return;
    double n(Object? v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
    var paymentMode = 'cash';
    var discount = 0.0;
    final amountCtrl = TextEditingController(text: n(quote['totalSettlementAmount']).toStringAsFixed(2));
    final discountCtrl = TextEditingController();
    final remarksCtrl = TextEditingController(text: 'Preclosure Full Settlement');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) {
          final items = (quote['lineItems'] as List<dynamic>? ?? const [])
              .map((dynamic e) => Map<String, dynamic>.from(e as Map));
          return AlertDialog(
            title: Text(t.x('loan.preclose')),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final item in items)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: Row(
                        children: [
                          Expanded(child: Text('${item['label']}', style: AppTypography.caption)),
                          Text(
                            '${n(item['amount']) < 0 ? '− ' : ''}${fmt.format(n(item['amount']).abs())}',
                            style: TextStyle(fontWeight: item['highlight'] == true ? FontWeight.w700 : FontWeight.w400),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: discountCtrl,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: InputDecoration(labelText: t.x('prc.settlement_discount')),
                        ),
                      ),
                      TextButton(
                        onPressed: () async {
                          final d = double.tryParse(discountCtrl.text.trim()) ?? 0;
                          try {
                            final q = await svc.foreclosureQuote(loan.id, discount: d);
                            setLocal(() {
                              quote = q;
                              discount = n(q['discount']);
                              amountCtrl.text = n(q['totalSettlementAmount']).toStringAsFixed(2);
                            });
                          } catch (_) {}
                        },
                        child: Text(t.x('prc.apply')),
                      ),
                    ],
                  ),
                  TextField(
                    controller: amountCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(labelText: t.x('preclose.settlement_amount')),
                  ),
                  DropdownButtonFormField<String>(
                    initialValue: paymentMode,
                    decoration: InputDecoration(labelText: t.x('loan.payment_mode')),
                    items: [
                      DropdownMenuItem(value: 'cash', child: Text(t.x('coll.cash'))),
                      DropdownMenuItem(value: 'upi', child: Text(t.x('coll.upi'))),
                      DropdownMenuItem(value: 'bank_transfer', child: Text(t.x('loan.bank_transfer'))),
                      DropdownMenuItem(value: 'cheque', child: Text(t.x('mode.cheque'))),
                    ],
                    onChanged: (v) => paymentMode = v ?? 'cash',
                  ),
                  TextField(
                    controller: remarksCtrl,
                    decoration: InputDecoration(labelText: t.x('loan.remarks')),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(t.x('common.cancel'))),
              FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(t.x('coll.confirm'))),
            ],
          );
        },
      ),
    );
    final amount = double.tryParse(amountCtrl.text.trim()) ?? 0;
    final remarks = remarksCtrl.text;
    amountCtrl.dispose();
    discountCtrl.dispose();
    remarksCtrl.dispose();
    if (ok != true || !context.mounted) return;
    final required = n(quote['totalSettlementAmount']);
    if (amount < required - 0.005) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(t.x('prc.below_settlement').replaceAll('{required}', fmt.format(required)))));
      return;
    }
    Map<String, dynamic>? resolution;
    final penaltyDue = n(quote['penaltyDue']);
    if (penaltyDue > 0) {
      resolution = await _penaltyResolutionSheet(
          context, ref, penaltyDue, n(quote['penaltyMissedDays']).toInt());
      if (resolution == null || !context.mounted) return;
    }
    try {
      final res = await svc.preclose(loan.id, {
        'amount': amount,
        'discount': discount,
        'paymentMode': paymentMode,
        'remarks': remarks,
        if (resolution != null) 'penaltyResolution': resolution,
      });
      ref.invalidate(loanDetailProvider(loan.id));
      if (!context.mounted) return;
      final outcome = res?['penaltyOutcome'];
      if (outcome is Map) {
        await showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Text(t.x('prc.outcome_title')),
            content: Text(_penaltyOutcomeText(t, fmt, Map<String, dynamic>.from(outcome))),
            actions: [
              FilledButton(onPressed: () => Navigator.pop(ctx), child: Text(t.x('prc.continue'))),
            ],
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(t.x('prc.preclosed')), backgroundColor: AppColors.success));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('$e'), backgroundColor: AppColors.danger));
      }
    }
  }

  void _confirmAction(BuildContext context, WidgetRef ref, String action) {
    final t = T.of(ref);

    if (action == 'close') {
      final hasActiveCheques =
          loan.customer?.securityCheques.any((c) => c.status == 'active') ??
              false;

      showDialog<void>(
        context: context,
        builder: (ctx) {
          bool markChequesReturned = false;
          return StatefulBuilder(
            builder: (context, setState) {
              return AlertDialog(
                title: Text(t.x('loan.close_loan')),
                content: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                        'Are you sure you want to close this loan? All pending balances must be settled.'),
                    if (hasActiveCheques) ...[
                      const SizedBox(height: 16),
                      CheckboxListTile(
                        title: const Text(
                            'Mark active security cheques as returned'),
                        value: markChequesReturned,
                        onChanged: (val) {
                          setState(() {
                            markChequesReturned = val ?? false;
                          });
                        },
                        contentPadding: EdgeInsets.zero,
                        controlAffinity: ListTileControlAffinity.leading,
                      ),
                    ],
                  ],
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: Text(t.x('common.cancel')),
                  ),
                  FilledButton(
                    style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primary),
                    onPressed: () async {
                      Navigator.pop(ctx);
                      try {
                        await ref.read(loanServiceProvider).performAction(
                          loan.id,
                          'close',
                          data: {'markChequesReturned': markChequesReturned},
                        );
                        ref.invalidate(loanDetailProvider(loan.id));
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content: Text('Loan closed successfully'),
                                backgroundColor: AppColors.success),
                          );
                        }
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                                content: Text('Failed: $e'),
                                backgroundColor: AppColors.danger),
                          );
                        }
                      }
                    },
                    child: Text(t.x('coll.confirm')),
                  ),
                ],
              );
            },
          );
        },
      );
    } else if (action == 'preclose') {
      _precloseWithQuote(context, ref);
    } else {
      final title = action == 'renew' ? 'Renew Loan' : 'Confirm Action';
      final desc = action == 'renew'
          ? 'This will close the current loan and create a renewal package with the same terms starting today. Continue?'
          : 'Are you sure you want to perform this action?';

      showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(title),
          content: Text(desc),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(t.x('common.cancel')),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
              onPressed: () async {
                Navigator.pop(ctx);
                try {
                  await ref
                      .read(loanServiceProvider)
                      .performAction(loan.id, action);
                  ref.invalidate(loanDetailProvider(loan.id));
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                          content:
                              Text('Action "$title" processed successfully'),
                          backgroundColor: AppColors.success),
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                          content: Text('Failed: $e'),
                          backgroundColor: AppColors.danger),
                    );
                  }
                }
              },
              child: Text(t.x('coll.confirm')),
            ),
          ],
        ),
      );
    }
  }
}

/// Period unit for counts on this loan (LD-04): days / weeks / months.
String _periodUnit(Loan loan, T t) => switch (loan.frequency) {
      'weekly' || 'biweekly' => t.x('loan.val_weeks'),
      'monthly' => t.x('loan.val_months'),
      _ => t.x('loan.val_days'),
    };
