import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/core/network/authed_image.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/services/loan_service.dart';
import 'package:zolofund/shared/widgets/app_badge.dart';
import 'package:zolofund/shared/widgets/bottom_nav.dart';
import 'package:zolofund/shared/widgets/empty_state.dart';
import 'package:zolofund/shared/widgets/fab_extended.dart';
import 'package:zolofund/shared/widgets/skeleton.dart';
import 'package:zolofund/shared/widgets/module_app_bar_title.dart';

/// LOAN-01: list filters, all applied by the server (same params as web).
class LoanListFilter {
  const LoanListFilter({
    this.hideClosed = true,
    this.q = '',
    this.status,
    this.frequency,
  });
  final bool hideClosed; // D4: default on
  final String q;
  final String? status;
  final String? frequency;

  LoanListFilter copyWith({
    bool? hideClosed,
    String? q,
    String? status,
    bool clearStatus = false,
    String? frequency,
    bool clearFrequency = false,
  }) =>
      LoanListFilter(
        hideClosed: hideClosed ?? this.hideClosed,
        q: q ?? this.q,
        status: clearStatus ? null : (status ?? this.status),
        frequency: clearFrequency ? null : (frequency ?? this.frequency),
      );
}

final loanListFilterProvider =
    StateProvider<LoanListFilter>((ref) => const LoanListFilter());

final loansProvider = FutureProvider<List<Map<String, dynamic>>>((ref) {
  final f = ref.watch(loanListFilterProvider);
  return ref.watch(loanServiceProvider).list(
        q: f.q,
        status: f.status,
        frequency: f.frequency,
        hideClosed: f.hideClosed,
      );
});

const _loanStatuses = ['active', 'overdue', 'pending_review', 'settled', 'closed'];
const _loanFrequencies = ['daily', 'weekly', 'biweekly', 'monthly'];

class LoansScreen extends ConsumerStatefulWidget {
  const LoansScreen({super.key});

  @override
  ConsumerState<LoansScreen> createState() => _LoansScreenState();
}

class _LoansScreenState extends ConsumerState<LoansScreen> {
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(loansProvider);
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    final isMicrolending =
        ref.watch(authControllerProvider).user?.appType == AppType.microlending;

    return Scaffold(
      appBar: AppBar(
        title: ModuleAppBarTitle(
          subtitle: t.x('title.loans'),
        ),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/dashboard'),
        ),
        actions: [
          // Auto Finance agents work a geographical beat, so give them a
          // direct jump into the route/area manager.
          if (ref.watch(authControllerProvider).user?.appType ==
              AppType.autofinance)
            IconButton(
              tooltip: 'Routes',
              icon: const Icon(Icons.map_outlined),
              onPressed: () => context.push('/loans/routes'),
            ),
        ],
      ),
      body: async.when(
        loading: () => ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: 5,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, __) => const Skeleton(height: 84, borderRadius: 12),
        ),
        error: (e, _) => EmptyState(
          icon: Icons.cloud_off,
          title: t.x('err.failed_to_load'),
          subtitle: e.toString(),
        ),
        data: (loans) {
          final filter = ref.watch(loanListFilterProvider);
          final notifier = ref.read(loanListFilterProvider.notifier);
          // Server already applied every filter; the count is of status 'active'.
          final visible = loans;
          final activeCount =
              loans.where((l) => (l['status'] as String?) == 'active').length;
          final closedCount =
              loans.where((l) => (l['status'] as String?) == 'closed').length;

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _searchCtrl,
                        textInputAction: TextInputAction.search,
                        onSubmitted: (v) => notifier
                            .update((s) => s.copyWith(q: v.trim())),
                        decoration: InputDecoration(
                          hintText: t.x('common.search'),
                          prefixIcon: const Icon(Icons.search, size: 18),
                          isDense: true,
                        ),
                      ),
                    ),
                    PopupMenuButton<String>(
                      tooltip: t.x('loan.lbl_status'),
                      icon: Icon(Icons.filter_list,
                          color: filter.status != null
                              ? AppColors.primary
                              : AppColors.textSecondary),
                      onSelected: (v) => notifier.update((s) => v == 'all'
                          ? s.copyWith(clearStatus: true)
                          : s.copyWith(status: v)),
                      itemBuilder: (_) => [
                        PopupMenuItem(value: 'all', child: Text(t.x('status.all'))),
                        for (final st in _loanStatuses)
                          PopupMenuItem(value: st, child: Text(t.x('status.$st'))),
                      ],
                    ),
                    PopupMenuButton<String>(
                      tooltip: t.x('loan.lbl_frequency'),
                      icon: Icon(Icons.event_repeat,
                          color: filter.frequency != null
                              ? AppColors.primary
                              : AppColors.textSecondary),
                      onSelected: (v) => notifier.update((s) => v == 'all'
                          ? s.copyWith(clearFrequency: true)
                          : s.copyWith(frequency: v)),
                      itemBuilder: (_) => [
                        PopupMenuItem(value: 'all', child: Text(t.x('status.all'))),
                        for (final fr in _loanFrequencies)
                          PopupMenuItem(value: fr, child: Text(t.x('plan.$fr'))),
                      ],
                    ),
                  ],
                ),
              ),
              _ClosedToggle(
                value: !filter.hideClosed,
                closedCount: closedCount,
                activeCount: activeCount,
                onChanged: (v) =>
                    notifier.update((s) => s.copyWith(hideClosed: !v)),
                t: t,
              ),
              Expanded(
                child: RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: () async => ref.refresh(loansProvider.future),
                  child: visible.isEmpty
                      ? ListView(
                          // Keep it scrollable so pull-to-refresh still works.
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            const SizedBox(height: 80),
                            EmptyState(
                              icon: Icons.account_balance_wallet_outlined,
                              title: t.x('title.loans'),
                              subtitle: t.x('empty.tap_new'),
                            ),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                          physics: const AlwaysScrollableScrollPhysics(),
                          itemCount: visible.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 10),
                          itemBuilder: (_, i) => _LoanTile(
                            loan: visible[i],
                            fmt: fmt,
                            responsive: isMicrolending,
                            onTap: () =>
                                context.push('/loans/${visible[i]['id']}'),
                          ),
                        ),
                ),
              ),
            ],
          );
        },
      ),
      floatingActionButton: FabExtended(
        icon: Icons.add,
        label: (ref.watch(authControllerProvider).user?.bypassLoanApproval ??
                false)
            ? t.x('title.new_loan')
            : t.x('title.request_loan'),
        onPressed: () => context.push('/loans/new'),
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/loans'),
    );
  }
}

/// Header strip with the "show closed loans" toggle + live counts.
class _ClosedToggle extends StatelessWidget {
  const _ClosedToggle({
    required this.value,
    required this.closedCount,
    required this.activeCount,
    required this.onChanged,
    required this.t,
  });
  final bool value;
  final int closedCount;
  final int activeCount;
  final ValueChanged<bool> onChanged;
  final T t;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Row(
        children: [
          Icon(
            Icons.check_circle_outline,
            size: 18,
            color: AppColors.textSecondary,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  t.x('loans.show_closed'),
                  style: AppTypography.bodyLarge.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                Text(
                  value
                      ? '$activeCount ${t.x('loans.active_suffix')} \u00b7 $closedCount ${t.x('loans.closed_suffix')}'
                      : '$activeCount ${t.x('loans.active_suffix')}',
                  style: AppTypography.caption,
                ),
              ],
            ),
          ),
          Switch.adaptive(
            value: value,
            activeThumbColor: AppColors.primary,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}

class _LoanTile extends ConsumerWidget {
  const _LoanTile({
    required this.loan,
    required this.fmt,
    required this.onTap,
    this.responsive = false,
  });
  final Map<String, dynamic> loan;
  final NumberFormat fmt;
  final VoidCallback onTap;
  final bool responsive;

  double _toDouble(dynamic v) =>
      v is num ? v.toDouble() : double.tryParse(v?.toString() ?? '') ?? 0;

  Future<void> _openLocation(
    BuildContext context,
    String name,
    String? route,
    double? lat,
    double? lng,
  ) async {
    if (lat != null && lng != null && lat != 0 && lng != 0) {
      final uri = Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving',
      );
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        return;
      }
    }
    final query =
        [name, if (route != null && route.isNotEmpty) route].join(', ');
    final uri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=${Uri.encodeQueryComponent(query)}',
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _callPhone(String phone) async {
    if (phone.isEmpty) return;
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final customer = (loan['customer'] as Map<String, dynamic>?) ?? const {};
    final customerName = customer['name']?.toString() ?? '-';
    final customerPhoto = customer['profilePhoto']?.toString();
    final customerPhone = customer['phone']?.toString() ?? '';
    final lat = customer['lat'] == null
        ? null
        : (customer['lat'] is num
            ? (customer['lat'] as num).toDouble()
            : double.tryParse(customer['lat'].toString()));
    final lng = customer['lng'] == null
        ? null
        : (customer['lng'] is num
            ? (customer['lng'] as num).toDouble()
            : double.tryParse(customer['lng'].toString()));
    final route = customer['route'];
    final routeName = route is Map<String, dynamic>
        ? route['name']?.toString()
        : route?.toString();

    final principal = _toDouble(loan['principal']);
    final status = (loan['status'] as String?) ?? 'pending_review';

    final paid = (loan['paidCount'] as num?)?.toInt() ?? 0;
    final total = (loan['totalInstalments'] as num?)?.toInt() ?? 0;
    // DEC-03 (B): server figure (GET /loans progressPct).
    final pct = (_toDouble(loan['progressPct'])).clamp(0.0, 1.0);

    final BadgeKind kind = switch (status) {
      'active' => BadgeKind.active,
      'overdue' => BadgeKind.overdue,
      'closed' => BadgeKind.closed,
      'pending_review' || 'pending' => BadgeKind.pending,
      _ => BadgeKind.info,
    };
    final Color progressColor = status == 'overdue'
        ? AppColors.danger
        : pct >= 1.0
            ? AppColors.success
            : AppColors.primary;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(8),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
          BoxShadow(
            color: AppColors.primary.withAlpha(15),
            blurRadius: 12,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: AppColors.border,
                width: 1.0,
              ),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            _Avatar(
                              name: customerName,
                              size: 42,
                              image: customerPhoto != null &&
                                      customerPhoto.isNotEmpty
                                  ? authedImage(ref, customerPhoto)
                                  : null,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    loan['loanCode']?.toString() ?? '-',
                                    style: AppTypography.bodyLarge.copyWith(
                                      fontFamily: 'monospace',
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    customerName,
                                    style: AppTypography.caption
                                        .copyWith(fontSize: 12),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  if (total > 0) ...[
                                    const SizedBox(height: 3),
                                    Text(
                                      '$paid / $total · ${(pct * 100).round()}%',
                                      style: AppTypography.extraTiny.copyWith(
                                        color: AppColors.textLight,
                                        fontFeatures: const [
                                          FontFeature.tabularFigures(),
                                        ],
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            if (lat != null || customerPhone.isNotEmpty) ...[
                              if (lat != null) ...[
                                InkWell(
                                  borderRadius: BorderRadius.circular(8),
                                  onTap: () => _openLocation(
                                    context,
                                    customerName,
                                    routeName,
                                    lat,
                                    lng,
                                  ),
                                  child: Container(
                                    width: 32,
                                    height: 32,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFEFF6FF),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: const Color(0xFF2563EB)
                                            .withAlpha(40),
                                      ),
                                    ),
                                    child: const Icon(
                                      Icons.near_me_rounded,
                                      size: 15,
                                      color: Color(0xFF2563EB),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 6),
                              ],
                              if (customerPhone.isNotEmpty) ...[
                                InkWell(
                                  borderRadius: BorderRadius.circular(8),
                                  onTap: () => _callPhone(customerPhone),
                                  child: Container(
                                    width: 32,
                                    height: 32,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFECFDF5),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: AppColors.success.withAlpha(40),
                                      ),
                                    ),
                                    child: const Icon(
                                      Icons.call_rounded,
                                      size: 15,
                                      color: AppColors.success,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                              ],
                            ],
                            if (!responsive) ...[
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    fmt.format(principal),
                                    style: AppTypography.bodyLarge.copyWith(
                                      color: AppColors.primaryDark,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 15,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  AppBadge(label: t.x('status.$status'), kind: kind),
                                ],
                              ),
                            ],
                          ],
                        ),
                        if (responsive) ...[
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: SizedBox(
                                  width: double.infinity,
                                  child: FittedBox(
                                    fit: BoxFit.scaleDown,
                                    alignment: Alignment.centerLeft,
                                    child: Text(
                                      fmt.format(principal),
                                      style: AppTypography.moneyLg.copyWith(
                                        color: AppColors.primaryDark,
                                        fontSize: 18,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              AppBadge(label: t.x('status.$status'), kind: kind),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  LinearProgressIndicator(
                    value: pct,
                    minHeight: 4,
                    backgroundColor: AppColors.border.withAlpha(90),
                    valueColor: AlwaysStoppedAnimation<Color>(progressColor),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Customer avatar — profile photo when available (fetched with the Bearer
/// token via [authedImage]), colored initials otherwise.
class _Avatar extends StatelessWidget {
  const _Avatar({required this.name, this.size = 40, this.image});
  final String name;
  final double size;
  final ImageProvider? image;

  Color _color() {
    final palette = [
      AppColors.primary,
      AppColors.info,
      AppColors.purple,
      AppColors.success,
      AppColors.warning,
    ];
    if (name.isEmpty) return AppColors.textLight;
    final h = name.codeUnits.fold<int>(0, (a, b) => (a + b) & 0xFF);
    return palette[h % palette.length];
  }

  String _initials() {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '-';
    return parts.take(2).map((p) => p.isEmpty ? '' : p[0].toUpperCase()).join();
  }

  @override
  Widget build(BuildContext context) {
    final c = _color();
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: c.withAlpha(40),
        borderRadius: BorderRadius.circular(size / 2),
        image: image != null
            ? DecorationImage(image: image!, fit: BoxFit.cover)
            : null,
      ),
      alignment: Alignment.center,
      child: image != null
          ? null
          : Text(
              _initials(),
              style: TextStyle(
                color: c,
                fontWeight: FontWeight.w800,
                fontSize: size * 0.34,
              ),
            ),
    );
  }
}
