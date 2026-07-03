import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:printing/printing.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/analytics.dart';
import 'package:loantrack/data/services/analytics_service.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

final _rangeFilterProvider = StateProvider.autoDispose<int>((ref) => 30);

final _fullAnalyticsProvider =
    FutureProvider.autoDispose.family<FullAnalytics, int>((ref, range) {
  return ref.watch(analyticsServiceProvider).fullAnalytics(range: range);
});

class AnalyticsScreen extends ConsumerWidget {
  const AnalyticsScreen({super.key});

  Future<void> _exportReport(BuildContext context, FullAnalytics data, NumberFormat fmt) async {
    final pdf = pw.Document();
    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        build: (pw.Context ctx) {
          return pw.Padding(
            padding: const pw.EdgeInsets.all(32),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text('LoanTrack Analytics Report',
                    style: pw.TextStyle(fontSize: 24, fontWeight: pw.FontWeight.bold)),
                pw.SizedBox(height: 8),
                pw.Text('Generated on ${DateFormat('dd MMM yyyy HH:mm').format(DateTime.now())}',
                    style: const pw.TextStyle(fontSize: 10)),
                pw.Divider(height: 20),
                pw.Text('Portfolio Summary',
                    style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
                pw.SizedBox(height: 8),
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text('Total Disbursed: ${fmt.format(data.portfolio.totalDisbursed)}'),
                    pw.Text('Active Principal: ${fmt.format(data.portfolio.activePrincipal)}'),
                  ],
                ),
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text('Total Recovered: ${fmt.format(data.portfolio.totalRecovered)}'),
                    pw.Text('NPA Amount: ${fmt.format(data.portfolio.npaAmount)}'),
                  ],
                ),
                pw.SizedBox(height: 16),
                pw.Text('Collection Efficiency: ${data.collectionEfficiency.pct.toStringAsFixed(1)}%'),
                pw.Text('Risk Score: ${data.riskScore.label} (${data.riskScore.score}/100)'),
                pw.Divider(height: 20),
                pw.Text('Smart Insights',
                    style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
                ...data.insights.map((ins) => pw.Bullet(text: ins.text)),
              ],
            ),
          );
        },
      ),
    );

    await Printing.sharePdf(
      bytes: await pdf.save(),
      filename: 'loantrack_analytics_${DateTime.now().millisecondsSinceEpoch}.pdf',
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final range = ref.watch(_rangeFilterProvider);
    final async = ref.watch(_fullAnalyticsProvider(range));
    final fmt = ref.watch(currencyFmtProvider);
    final t = T.of(ref);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('title.analytics')),
        centerTitle: true,
        actions: [
          async.when(
            data: (data) => IconButton(
              icon: const Icon(Icons.share_rounded),
              onPressed: () => _exportReport(context, data, fmt),
              tooltip: 'Export PDF Report',
            ),
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          ref.invalidate(_fullAnalyticsProvider(range));
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Date Filter Pills
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _FilterPill(label: '7 Days', val: 7, current: range),
                const SizedBox(width: 8),
                _FilterPill(label: '14 Days', val: 14, current: range),
                const SizedBox(width: 8),
                _FilterPill(label: '30 Days', val: 30, current: range),
              ],
            ),
            const SizedBox(height: 16),

            async.when(
              loading: () => const Column(
                children: [
                  Skeleton(height: 120, borderRadius: AppTokens.radius),
                  SizedBox(height: 16),
                  Skeleton(height: 200, borderRadius: AppTokens.radius),
                  SizedBox(height: 16),
                  Skeleton(height: 150, borderRadius: AppTokens.radius),
                ],
              ),
              error: (e, _) => SizedBox(
                height: 300,
                child: EmptyState(
                  icon: Icons.error_outline,
                  title: 'Could not load analytics',
                  subtitle: e.toString(),
                ),
              ),
              data: (data) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Collection Efficiency Gauge
                    _EfficiencyGauge(eff: data.collectionEfficiency),
                    const SizedBox(height: 16),

                    // Portfolio Summary KPI grid
                    _PortfolioGrid(p: data.portfolio, fmt: fmt),
                    const SizedBox(height: 16),

                    // Risk Score Badge
                    _RiskScoreCard(risk: data.riskScore),
                    const SizedBox(height: 16),

                    // Smart Insights Feed
                    if (data.insights.isNotEmpty) ...[
                      _InsightsCard(insights: data.insights),
                      const SizedBox(height: 16),
                    ],

                    // Aging Buckets chart
                    if (data.agingBuckets.isNotEmpty) ...[
                      _AgingBucketsCard(buckets: data.agingBuckets, fmt: fmt),
                      const SizedBox(height: 16),
                    ],

                    // Borrower segments
                    if (data.borrowerSegments.isNotEmpty) ...[
                      _SegmentsCard(segments: data.borrowerSegments),
                      const SizedBox(height: 16),
                    ],

                    // Cashflow forecast chart
                    if (data.cashflowForecast7d.isNotEmpty) ...[
                      _ForecastChart(forecast: data.cashflowForecast7d, fmt: fmt),
                      const SizedBox(height: 16),
                    ],

                    // Agent Leaderboard
                    if (data.agentLeaderboard.isNotEmpty) ...[
                      _AgentLeaderboard(agents: data.agentLeaderboard, fmt: fmt),
                      const SizedBox(height: 16),
                    ],
                  ],
                );
              },
            ),
          ],
        ),
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/analytics'),
    );
  }
}

// ─── Sub-widgets ─────────────────────────────────────

class _FilterPill extends ConsumerWidget {
  const _FilterPill({required this.label, required this.val, required this.current});
  final String label;
  final int val;
  final int current;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final active = val == current;
    return GestureDetector(
      onTap: () => ref.read(_rangeFilterProvider.notifier).state = val,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: active ? AppColors.primary : AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: active ? AppColors.primary : AppColors.border),
        ),
        child: Text(
          label,
          style: AppTypography.label.copyWith(
            color: active ? Colors.white : AppColors.textSecondary,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}

class _EfficiencyGauge extends StatelessWidget {
  const _EfficiencyGauge({required this.eff});
  final CollectionEfficiency eff;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Row(
        children: [
          SizedBox(
            width: 80,
            height: 80,
            child: Stack(
              alignment: Alignment.center,
              children: [
                CircularProgressIndicator(
                  value: eff.pct / 100,
                  strokeWidth: 8,
                  backgroundColor: AppColors.border,
                  valueColor: AlwaysStoppedAnimation(
                    eff.pct >= 90
                        ? AppColors.success
                        : eff.pct >= 75
                            ? AppColors.warning
                            : AppColors.danger,
                  ),
                ),
                Text(
                  '${eff.pct.toStringAsFixed(0)}%',
                  style: AppTypography.sectionTitle.copyWith(fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Collection Efficiency', style: AppTypography.sectionTitle),
                const SizedBox(height: 4),
                Text(eff.label, style: AppTypography.caption),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PortfolioGrid extends StatelessWidget {
  const _PortfolioGrid({required this.p, required this.fmt});
  final PortfolioSummary p;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _KpiCard(
                label: 'Total Disbursed',
                value: fmt.format(p.totalDisbursed),
                color: AppColors.primary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _KpiCard(
                label: 'Active Principal',
                value: fmt.format(p.activePrincipal),
                color: AppColors.info,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _KpiCard(
                label: 'Recovery Ratio',
                value: '${p.recoveryRatio.toStringAsFixed(1)}%',
                color: AppColors.success,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _KpiCard(
                label: 'Avg Loan Size',
                value: fmt.format(p.avgLoanSize),
                color: AppColors.warning,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({required this.label, required this.value, required this.color});
  final String label, value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: AppTypography.sectionTitle.copyWith(color: color, fontSize: 18)),
          const SizedBox(height: 2),
          Text(label, style: AppTypography.caption),
        ],
      ),
    );
  }
}

class _RiskScoreCard extends StatelessWidget {
  const _RiskScoreCard({required this.risk});
  final RiskScore risk;

  @override
  Widget build(BuildContext context) {
    // Determine risk color dynamically
    Color color = AppColors.success;
    if (risk.score >= 70) {
      color = AppColors.danger;
    } else if (risk.score >= 40) {
      color = AppColors.warning;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Portfolio Risk Score', style: AppTypography.sectionTitle),
              const SizedBox(height: 4),
              Text('Overall threat assessment based on ageing', style: AppTypography.caption),
            ],
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: color),
            ),
            child: Text(
              '${risk.label} (${risk.score})',
              style: AppTypography.body.copyWith(color: color, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }
}

class _InsightsCard extends StatelessWidget {
  const _InsightsCard({required this.insights});
  final List<SmartInsight> insights;

  @override
  Widget build(BuildContext context) {
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
          Text('Smart Insights', style: AppTypography.sectionTitle),
          const SizedBox(height: 12),
          ...insights.map((ins) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(ins.icon, style: const TextStyle(fontSize: 16)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(ins.text, style: AppTypography.body),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _AgingBucketsCard extends StatelessWidget {
  const _AgingBucketsCard({required this.buckets, required this.fmt});
  final List<AgingBucket> buckets;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    final maxAmount = buckets.fold<double>(1, (m, b) => b.amount > m ? b.amount : m);

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
          Text('Aging Buckets', style: AppTypography.sectionTitle),
          const SizedBox(height: 12),
          ...buckets.map((b) {
            final pct = b.amount / maxAmount;
            // Parse color string
            Color barColor = AppColors.primary;
            try {
              final hex = b.color.replaceFirst('#', '');
              barColor = Color(int.parse('FF$hex', radix: 16));
            } catch (_) {}

            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(b.label, style: AppTypography.body.copyWith(fontWeight: FontWeight.bold)),
                      Text('${b.count} cases · ${fmt.format(b.amount)}', style: AppTypography.caption),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Stack(
                    children: [
                      Container(
                        height: 8,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: AppColors.border,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      FractionallySizedBox(
                        widthFactor: pct.clamp(0.01, 1.0),
                        child: Container(
                          height: 8,
                          decoration: BoxDecoration(
                            color: barColor,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _SegmentsCard extends StatelessWidget {
  const _SegmentsCard({required this.segments});
  final List<BorrowerSegment> segments;

  @override
  Widget build(BuildContext context) {
    final total = segments.fold<int>(0, (s, e) => s + e.count);

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
          Text('Borrower Segments', style: AppTypography.sectionTitle),
          const SizedBox(height: 12),
          ...segments.map((seg) {
            final pct = total > 0 ? (seg.count / total * 100).toStringAsFixed(0) : '0';
            Color color = AppColors.textSecondary;
            try {
              final hex = seg.color.replaceFirst('#', '');
              color = Color(int.parse('FF$hex', radix: 16));
            } catch (_) {}

            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(seg.label, style: AppTypography.body),
                  ),
                  Text('${seg.count} ($pct%)', style: AppTypography.body.copyWith(fontWeight: FontWeight.bold)),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _ForecastChart extends StatelessWidget {
  const _ForecastChart({required this.forecast, required this.fmt});
  final List<ForecastDay> forecast;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    final spots = <FlSpot>[];
    for (int i = 0; i < forecast.length; i++) {
      spots.add(FlSpot(i.toDouble(), forecast[i].cumulative));
    }
    final maxVal = forecast.isEmpty
        ? 1.0
        : forecast.fold<double>(1.0, (m, e) => e.cumulative > m ? e.cumulative : m);

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
          Text('7-Day Cashflow Forecast', style: AppTypography.sectionTitle),
          const SizedBox(height: 16),
          SizedBox(
            height: 140,
            child: LineChart(
              LineChartData(
                maxY: maxVal * 1.15,
                minY: 0,
                gridData: const FlGridData(show: false),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      getTitlesWidget: (value, _) {
                        final idx = value.toInt();
                        if (idx < 0 || idx >= forecast.length) return const SizedBox.shrink();
                        return Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(forecast[idx].label, style: AppTypography.extraTiny),
                        );
                      },
                    ),
                  ),
                ),
                lineBarsData: [
                  LineChartBarData(
                    spots: spots,
                    isCurved: true,
                    color: AppColors.primary,
                    barWidth: 3,
                    belowBarData: BarAreaData(
                      show: true,
                      color: AppColors.primary.withValues(alpha: 0.1),
                    ),
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

class _AgentLeaderboard extends StatelessWidget {
  const _AgentLeaderboard({required this.agents, required this.fmt});
  final List<AgentPerformance> agents;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
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
          Text('Agent Performance', style: AppTypography.sectionTitle),
          const SizedBox(height: 12),
          ...agents.map((a) {
            return ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(
                backgroundColor: AppColors.primaryLight,
                child: Text(a.name.isNotEmpty ? a.name[0].toUpperCase() : 'A',
                    style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
              ),
              title: Text(a.name, style: AppTypography.body.copyWith(fontWeight: FontWeight.bold)),
              subtitle: Text('Collected: ${fmt.format(a.collected)}', style: AppTypography.caption),
              trailing: Text('${a.hitRate}% efficiency',
                  style: AppTypography.body.copyWith(
                      color: a.hitRate >= 90
                          ? AppColors.success
                          : a.hitRate >= 75
                              ? AppColors.warning
                              : AppColors.danger,
                      fontWeight: FontWeight.bold)),
            );
          }),
        ],
      ),
    );
  }
}
