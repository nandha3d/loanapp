import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/services/reports_service.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class ReportPreviewScreen extends ConsumerWidget {
  const ReportPreviewScreen({
    super.key,
    required this.type,
    required this.from,
    required this.to,
  });

  final String type;
  final DateTime from;
  final DateTime to;

  Future<Map<String, dynamic>> _load(WidgetRef ref) async {
    final svc = ref.read(reportsServiceProvider);
    if (type == 'daily') return svc.daily(date: to);
    if (type == 'agent') return svc.agent(from: from, to: to);
    final overdue = await svc.overdue();
    return {'rows': overdue};
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text(_title()), centerTitle: true),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _load(ref),
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(child: Text('${snap.error}'));
          }
          final data = snap.data ?? {};
          return Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(AppTokens.radius),
                        boxShadow: AppTokens.shadow,
                      ),
                      child: Text(
                        const JsonEncoder.withIndent('  ').convert(data),
                        style: AppTypography.bodySmall.copyWith(fontFamily: 'monospace'),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: AppButton(
                  label: 'Export PDF',
                  expand: true,
                  onPressed: () => _exportPdf(data),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  String _title() {
    return switch (type) {
      'daily' => 'Daily Report',
      'agent' => 'Agent Report',
      _ => 'Overdue Report',
    };
  }

  Future<void> _exportPdf(Map<String, dynamic> data) async {
    final doc = pw.Document();
    final df = DateFormat('MMM d, y');
    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        build: (_) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text(
              _title(),
              style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold),
            ),
            pw.SizedBox(height: 4),
            pw.Text('${df.format(from)} – ${df.format(to)}'),
            pw.SizedBox(height: 12),
            pw.Text(
              const JsonEncoder.withIndent('  ').convert(data),
              style: const pw.TextStyle(fontSize: 9),
            ),
          ],
        ),
      ),
    );
    final bytes = await doc.save();
    await Printing.layoutPdf(onLayout: (_) async => Uint8List.fromList(bytes));
  }
}
