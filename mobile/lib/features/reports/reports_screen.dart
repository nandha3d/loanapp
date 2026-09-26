import 'dart:io';

import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';

import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/reports.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/data/models/customer.dart';
import 'package:zolofund/data/services/customer_service.dart';
import 'package:zolofund/data/services/accounting_service.dart';
import 'package:zolofund/data/services/reports_service.dart';
import 'package:zolofund/features/billing/widgets/addon_purchase_sheet.dart';
import 'package:zolofund/shared/widgets/empty_state.dart';
import 'package:zolofund/shared/widgets/skeleton.dart';

// ── Providers ────────────────────────────────────────────────────────────────

final _overdueProvider =
    FutureProvider.autoDispose<List<OverdueItem>>((ref) async {
  final items = await ref.watch(reportsServiceProvider).fetchOverdueReport();
  // Sort descending by outstanding amount.
  final sorted = [...items]
    ..sort((a, b) => b.outstanding.compareTo(a.outstanding));
  return sorted;
});

// Date-range state for the agent tab.
class _DateRange {
  const _DateRange({required this.from, required this.to});
  final DateTime from;
  final DateTime to;
}

final _dateRangeProvider = StateProvider.autoDispose<_DateRange>((ref) {
  final now = DateTime.now();
  return _DateRange(
    from: now.subtract(const Duration(days: 30)),
    to: now,
  );
});

final _agentPerfProvider = FutureProvider.autoDispose<List<AgentPerf>>((ref) {
  final range = ref.watch(_dateRangeProvider);
  return ref
      .watch(reportsServiceProvider)
      .fetchAgentPerformance(range.from, range.to);
});

// ── Screen ────────────────────────────────────────────────────────────────────

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  late final bool _canViewCatalog;

  @override
  void initState() {
    super.initState();
    final role = ref.read(authControllerProvider).user?.role;
    _canViewCatalog = role == UserRole.admin ||
        role == UserRole.superadmin ||
        role == UserRole.developer;
    _tabs = TabController(length: _canViewCatalog ? 3 : 2, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('rep.title')),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/dashboard'),
        ),
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          labelStyle: AppTypography.label,
          unselectedLabelStyle: AppTypography.label,
          tabs: [
            Tab(text: t.x('rep.overdueTab')),
            Tab(text: t.x('rep.agentPerfTab')),
            if (_canViewCatalog) Tab(text: t.x('rep.catalogTab')),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          const _OverdueTab(),
          const _AgentPerfTab(),
          if (_canViewCatalog) const _CatalogTab(),
        ],
      ),
    );
  }
}

// ── Overdue tab ───────────────────────────────────────────────────────────────

class _OverdueTab extends ConsumerWidget {
  const _OverdueTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final async = ref.watch(_overdueProvider);

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async => ref.invalidate(_overdueProvider),
      child: async.when(
        loading: () => _ListSkeleton(),
        error: (e, _) => _ErrorView(message: e.toString()),
        data: (items) {
          if (items.isEmpty) {
            return ListView(
              children: [
                const SizedBox(height: 80),
                EmptyState(
                  icon: Icons.check_circle_outline,
                  title: t.x('rep.noData'),
                ),
              ],
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) => _OverdueCard(item: items[i]),
          );
        },
      ),
    );
  }
}

class _OverdueCard extends ConsumerWidget {
  const _OverdueCard({required this.item});
  final OverdueItem item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Red dot indicator
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: AppColors.danger,
                shape: BoxShape.circle,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.customerName, style: AppTypography.bodyLarge),
                const SizedBox(height: 2),
                Text(
                  item.customerCode,
                  style: AppTypography.caption,
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                fmt.format(item.outstanding),
                style: AppTypography.label.copyWith(color: AppColors.danger),
              ),
              const SizedBox(height: 3),
              Text(
                '${item.missedInstalments} ${t.x('rep.missed')}',
                style: AppTypography.caption,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Agent performance tab ─────────────────────────────────────────────────────

class _AgentPerfTab extends ConsumerStatefulWidget {
  const _AgentPerfTab();

  @override
  ConsumerState<_AgentPerfTab> createState() => _AgentPerfTabState();
}

class _AgentPerfTabState extends ConsumerState<_AgentPerfTab> {
  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final range = ref.watch(_dateRangeProvider);
    final async = ref.watch(_agentPerfProvider);
    final dateFmt = DateFormat('dd MMM yyyy');

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async => ref.invalidate(_agentPerfProvider),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Date range picker card
          _DateRangeCard(
            from: range.from,
            to: range.to,
            dateFmt: dateFmt,
            onApply: (from, to) {
              ref.read(_dateRangeProvider.notifier).state =
                  _DateRange(from: from, to: to);
            },
          ),
          const SizedBox(height: 16),
          // Results
          async.when(
            loading: () => _ListSkeleton(),
            error: (e, _) => _ErrorView(message: e.toString()),
            data: (agents) {
              if (agents.isEmpty) {
                return SizedBox(
                  height: 200,
                  child: EmptyState(
                    icon: Icons.group_outlined,
                    title: t.x('rep.noData'),
                  ),
                );
              }
              return _AgentTable(agents: agents);
            },
          ),
        ],
      ),
    );
  }
}

class _DateRangeCard extends ConsumerWidget {
  const _DateRangeCard({
    required this.from,
    required this.to,
    required this.dateFmt,
    required this.onApply,
  });

  final DateTime from;
  final DateTime to;
  final DateFormat dateFmt;
  final void Function(DateTime from, DateTime to) onApply;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Row(
        children: [
          Expanded(
            child: _DateChip(
              label: t.x('rep.from'),
              value: dateFmt.format(from),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: from,
                  firstDate: DateTime(2020),
                  lastDate: to,
                );
                if (picked != null) onApply(picked, to);
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text('–', style: AppTypography.body),
          ),
          Expanded(
            child: _DateChip(
              label: t.x('rep.to'),
              value: dateFmt.format(to),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: to,
                  firstDate: from,
                  lastDate: DateTime.now(),
                );
                if (picked != null) onApply(from, picked);
              },
            ),
          ),
          const SizedBox(width: 10),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              textStyle: AppTypography.label,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            onPressed: () => onApply(from, to),
            child: Text(t.x('rep.apply')),
          ),
        ],
      ),
    );
  }
}

class _DateChip extends StatelessWidget {
  const _DateChip({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: AppTypography.extraTiny),
            const SizedBox(height: 2),
            Text(value, style: AppTypography.label),
          ],
        ),
      ),
    );
  }
}

class _AgentTable extends ConsumerWidget {
  const _AgentTable({required this.agents});
  final List<AgentPerf> agents;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header row
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: const BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.vertical(
                top: Radius.circular(AppTokens.radius),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: Text(
                    t.x('rep.agent'),
                    style: AppTypography.label,
                  ),
                ),
                Expanded(
                  flex: 2,
                  child: Text(
                    t.x('rep.expected'),
                    style: AppTypography.label,
                    textAlign: TextAlign.right,
                  ),
                ),
                Expanded(
                  flex: 2,
                  child: Text(
                    t.x('rep.collected'),
                    style: AppTypography.label,
                    textAlign: TextAlign.right,
                  ),
                ),
                Expanded(
                  flex: 2,
                  child: Text(
                    t.x('rep.hitRate'),
                    style: AppTypography.label,
                    textAlign: TextAlign.right,
                  ),
                ),
              ],
            ),
          ),
          // Data rows
          ...agents.asMap().entries.map(
                (e) => _AgentRow(
                  agent: e.value,
                  fmt: fmt,
                  isLast: e.key == agents.length - 1,
                ),
              ),
        ],
      ),
    );
  }
}

class _AgentRow extends StatelessWidget {
  const _AgentRow({
    required this.agent,
    required this.fmt,
    required this.isLast,
  });

  final AgentPerf agent;
  final NumberFormat fmt;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final hitPct = agent.hitRate.clamp(0, 100);
    final hitColor = hitPct >= 80
        ? AppColors.success
        : hitPct >= 50
            ? AppColors.warning
            : AppColors.danger;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : const Border(
                bottom: BorderSide(color: AppColors.border, width: 0.5),
              ),
      ),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(
              agent.name.isEmpty ? agent.agentId : agent.name,
              style: AppTypography.bodyLarge,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              fmt.format(agent.expected),
              style:
                  AppTypography.body.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.right,
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              fmt.format(agent.collected),
              style: AppTypography.label.copyWith(color: AppColors.success),
              textAlign: TextAlign.right,
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              '$hitPct%',
              style: AppTypography.label.copyWith(color: hitColor),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

final _catalogProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(reportsServiceProvider).fetchCatalog();
});

class _CatalogTab extends ConsumerStatefulWidget {
  const _CatalogTab();

  @override
  ConsumerState<_CatalogTab> createState() => _CatalogTabState();
}

class _CatalogTabState extends ConsumerState<_CatalogTab> {
  Map<String, dynamic>? _selected;
  Future<Map<String, dynamic>>? _report;
  Customer? _customer;
  Map<String, dynamic>? _account;
  bool _exporting = false;

  Future<void> _export(String format) async {
    final selected = _selected;
    if (selected == null || _exporting) return;
    final range = ref.read(_dateRangeProvider);
    final slug = selected['slug'] as String;
    setState(() => _exporting = true);
    try {
      final bytes = await ref.read(reportsServiceProvider).exportReport(
        slug: slug,
        format: format,
        filters: {
          'from': DateFormat('yyyy-MM-dd').format(range.from),
          'to': DateFormat('yyyy-MM-dd').format(range.to),
          'lang': ref.read(languageProvider).name,
          if (_customer != null) 'customerId': _customer!.id,
          if (_account != null) 'loanId': _account!['id'],
        },
      );
      if (format == 'pdf') {
        await Printing.sharePdf(bytes: bytes, filename: '$slug.pdf');
      } else {
        final extension = format == 'excel' ? 'xlsx' : 'csv';
        final safeSlug = slug.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
        final folder = await getTemporaryDirectory();
        final file = File('${folder.path}/$safeSlug.$extension');
        await file.writeAsBytes(bytes, flush: true);
        await Share.shareXFiles([XFile(file.path)]);
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  bool _needsCustomer(Map<String, dynamic> item) => const {
        'customer-loan-history',
        'customer-collection-history',
        'customer-visit-history',
      }.contains(item['slug']);

  bool _needsAccount(Map<String, dynamic> item) => item['slug'] == 'ledger-report';

  Future<Map<String, dynamic>> _fetch(Map<String, dynamic> item, DateTime from, DateTime to) =>
      ref.read(reportsServiceProvider).fetchReport(
            item['slug'] as String,
            from,
            to,
            ref.read(languageProvider).name,
            _customer?.id,
            _account?['id'] as String?,
          );

  void _open(Map<String, dynamic> item) {
    if (item['locked'] == true) {
      showAddonPurchaseSheet(
        context,
        ref,
        addonKey: 'premium_accounting',
        onActivated: () => ref.invalidate(_catalogProvider),
      );
      return;
    }
    final range = ref.read(_dateRangeProvider);
    setState(() {
      _selected = item;
      _customer = null;
      _account = null;
      _report = _needsCustomer(item) || _needsAccount(item)
          ? null
          : _fetch(item, range.from, range.to);
    });
  }

  Future<void> _pickCustomer() async {
    final selected = await showSearch<Customer?>(
      context: context,
      delegate: _CustomerSearch(
        ref.read(customerServiceProvider),
        T.of(ref).x('rep.customer'),
      ),
    );
    if (!mounted || selected == null || _selected == null) return;
    final range = ref.read(_dateRangeProvider);
    setState(() {
      _customer = selected;
      _report = _fetch(_selected!, range.from, range.to);
    });
  }

  Future<void> _pickAccount() async {
    final accounts = ref.read(accountingServiceProvider).listCoA();
    final selected = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: FutureBuilder<List<Map<String, dynamic>>>(
          future: accounts,
          builder: (context, snapshot) {
            if (snapshot.hasError) return Center(child: Text(snapshot.error.toString()));
            if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
            return ListView.builder(
              itemCount: snapshot.data!.length,
              itemBuilder: (context, index) {
                final account = snapshot.data![index];
                return ListTile(
                  title: Text(account['name']?.toString() ?? ''),
                  subtitle: Text(account['code']?.toString() ?? ''),
                  onTap: () => Navigator.pop(sheetContext, account),
                );
              },
            );
          },
        ),
      ),
    );
    if (!mounted || selected == null || _selected == null) return;
    final range = ref.read(_dateRangeProvider);
    setState(() {
      _account = selected;
      _report = _fetch(_selected!, range.from, range.to);
    });
  }

  void _reload(DateTime from, DateTime to) {
    ref.read(_dateRangeProvider.notifier).state =
        _DateRange(from: from, to: to);
    final item = _selected;
    if (item != null &&
        (!_needsCustomer(item) || _customer != null) &&
        (!_needsAccount(item) || _account != null)) {
      setState(() {
        _report = _fetch(item, from, to);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final selected = _selected;
    if (selected != null) {
      final range = ref.watch(_dateRangeProvider);
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextButton.icon(
            onPressed: () => setState(() => _selected = null),
            icon: const Icon(Icons.arrow_back),
            label: Text(t.x('rep.title')),
          ),
          Text(selected['name']?.toString() ?? '',
              style: AppTypography.sectionTitle),
          if (_report != null) ...[
            const SizedBox(height: 8),
            PopupMenuButton<String>(
              enabled: !_exporting,
              onSelected: _export,
              itemBuilder: (_) => [
                PopupMenuItem(value: 'pdf', child: Text(t.x('rep.export_pdf'))),
                PopupMenuItem(value: 'excel', child: Text(t.x('rep.export_excel'))),
                PopupMenuItem(value: 'csv', child: Text(t.x('rep.export_csv'))),
              ],
              child: ListTile(
                leading: _exporting
                    ? const CircularProgressIndicator()
                    : const Icon(Icons.ios_share_outlined),
                title: Text(t.x('rep.export')),
              ),
            ),
          ],
          const SizedBox(height: 12),
          if (_needsCustomer(selected)) ...[
            OutlinedButton.icon(
              onPressed: _pickCustomer,
              icon: const Icon(Icons.person_search_outlined),
              label: Text(_customer == null
                  ? t.x('rep.customer')
                  : '${_customer!.name} (${_customer!.customerCode})'),
            ),
            const SizedBox(height: 12),
          ],
          if (_needsAccount(selected)) ...[
            OutlinedButton.icon(
              onPressed: _pickAccount,
              icon: const Icon(Icons.account_tree_outlined),
              label: Text(_account == null
                  ? t.x('accounting.chart_of_accounts')
                  : '${_account!['code']} ${_account!['name']}'),
            ),
            const SizedBox(height: 12),
          ],
          _DateRangeCard(
            from: range.from,
            to: range.to,
            dateFmt: DateFormat('dd MMM yyyy'),
            onApply: _reload,
          ),
          const SizedBox(height: 12),
          if (_report == null)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                t.x(_needsAccount(selected)
                    ? 'accounting.chart_of_accounts'
                    : 'rep.customer'),
                textAlign: TextAlign.center,
              ),
            )
          else FutureBuilder<Map<String, dynamic>>(
            future: _report,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return _ErrorView(message: snapshot.error.toString());
              }
              if (!snapshot.hasData) return const Skeleton(height: 160);
              return _ReportData(data: snapshot.data!);
            },
          ),
        ],
      );
    }

    final catalog = ref.watch(_catalogProvider);
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(_catalogProvider);
        await ref.read(_catalogProvider.future);
      },
      child: catalog.when(
        loading: () => _ListSkeleton(),
        error: (error, _) =>
            ListView(children: [_ErrorView(message: error.toString())]),
        data: (items) {
          if (items.isEmpty) {
            return ListView(children: [
              const SizedBox(height: 80),
              EmptyState(
                  icon: Icons.description_outlined, title: t.x('rep.noData')),
            ]);
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final item = items[index];
              final locked = item['locked'] == true;
              return Card(
                child: ListTile(
                  title: Text(item['name']?.toString() ?? ''),
                  subtitle: Text(item['category']?.toString() ?? ''),
                  trailing:
                      Icon(locked ? Icons.lock_outline : Icons.chevron_right),
                  onTap: () => _open(item),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _CustomerSearch extends SearchDelegate<Customer?> {
  _CustomerSearch(this.service, String label) : super(searchFieldLabel: label);

  final CustomerService service;
  String? _lastQuery;
  Future<List<Customer>>? _results;

  @override
  List<Widget> buildActions(BuildContext context) => [
        IconButton(
          icon: const Icon(Icons.clear),
          onPressed: () => query = '',
        ),
      ];

  @override
  Widget buildLeading(BuildContext context) => IconButton(
        icon: const Icon(Icons.arrow_back),
        onPressed: () => close(context, null),
      );

  @override
  Widget buildResults(BuildContext context) => buildSuggestions(context);

  @override
  Widget buildSuggestions(BuildContext context) {
    final search = query.trim();
    if (search.length < 2) return const SizedBox.shrink();
    if (_lastQuery != search) {
      _lastQuery = search;
      _results = service.list(query: search);
    }
    return FutureBuilder<List<Customer>>(
      future: _results,
      builder: (context, snapshot) {
        if (snapshot.hasError) return Center(child: Text(snapshot.error.toString()));
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        return ListView.builder(
          itemCount: snapshot.data!.length,
          itemBuilder: (context, index) {
            final customer = snapshot.data![index];
            return ListTile(
              title: Text(customer.name),
              subtitle: Text(customer.customerCode),
              onTap: () => close(context, customer),
            );
          },
        );
      },
    );
  }
}

class _ReportData extends ConsumerWidget {
  const _ReportData({required this.data});
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final columns = (data['columns'] as List<dynamic>? ?? const [])
        .map((dynamic value) => Map<String, dynamic>.from(value as Map))
        .toList();
    final rows = (data['rows'] as List<dynamic>? ?? const [])
        .map((dynamic value) => Map<String, dynamic>.from(value as Map))
        .toList();
    final kpis = (data['kpis'] as List<dynamic>? ?? const [])
        .map((dynamic value) => Map<String, dynamic>.from(value as Map));
    final totals =
        Map<String, dynamic>.from(data['totals'] as Map? ?? const {});
    final fmt = ref.watch(currencyFmtProvider);

    String label(dynamic raw) {
      final key = raw?.toString() ?? '';
      final translated = t.x(key);
      if (translated != key) return translated;
      final plain = key.split('.').last.replaceAllMapped(
          RegExp(r'([a-z])([A-Z])'), (match) => '${match[1]} ${match[2]}');
      return plain.replaceAll(RegExp(r'[-_]'), ' ');
    }

    String display(dynamic value, String? type) {
      if (value == null) return '—';
      if (type == 'currency' && value is num) return fmt.format(value);
      return value.toString();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ...kpis.map((kpi) => Card(
                child: ListTile(
              title: Text(label(kpi['label'])),
              trailing:
                  Text(display(kpi['value'], null), style: AppTypography.label),
            ))),
        if (rows.isEmpty)
          Padding(
            padding: const EdgeInsets.all(24),
            child: Text(t.x('rep.noData'), textAlign: TextAlign.center),
          ),
        ...rows.map((row) => Card(
                child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(children: [
                for (final column in columns)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(children: [
                      Expanded(
                          child: Text(label(column['label'] ?? column['key']),
                              style: AppTypography.caption)),
                      Flexible(
                          child: Text(
                              display(row[column['key']],
                                  column['type'] as String?),
                              textAlign: TextAlign.right)),
                    ]),
                  ),
              ]),
            ))),
        if (totals.isNotEmpty)
          Card(
              child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(children: [
              for (final column in columns)
                if (totals.containsKey(column['key']))
                  Row(children: [
                    Expanded(
                        child: Text(label(column['label'] ?? column['key']),
                            style: AppTypography.label)),
                    Flexible(
                        child: Text(
                            display(totals[column['key']],
                                column['type'] as String?),
                            textAlign: TextAlign.right)),
                  ]),
            ]),
          )),
      ],
    );
  }
}

class _ListSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      physics: const NeverScrollableScrollPhysics(),
      itemCount: 6,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, __) => const Skeleton(
        height: 64,
        borderRadius: AppTokens.radius,
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.dangerBg,
          borderRadius: BorderRadius.circular(AppTokens.radius),
        ),
        child: Text(
          message,
          style: AppTypography.body.copyWith(color: AppColors.danger),
        ),
      ),
    );
  }
}
