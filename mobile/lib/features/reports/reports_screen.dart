import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  String _type = 'daily';
  DateTime _from = DateTime.now().subtract(const Duration(days: 7));
  DateTime _to = DateTime.now();

  @override
  Widget build(BuildContext context) {
    final df = DateFormat('MMM d, y');
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Reports'), centerTitle: true),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Report Type', style: AppTypography.label),
                const SizedBox(height: 8),
                _radio('daily', 'Daily Collection'),
                _radio('agent', 'Agent-wise'),
                _radio('overdue', 'Overdue'),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (_type != 'overdue')
            _card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Date Range', style: AppTypography.label),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _dateBtn(
                          label: 'From',
                          value: df.format(_from),
                          onTap: () => _pickDate(true),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _dateBtn(
                          label: 'To',
                          value: df.format(_to),
                          onTap: () => _pickDate(false),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          const SizedBox(height: 16),
          AppButton(
            label: 'Generate Report',
            expand: true,
            onPressed: () => context.push(
              '/reports/preview',
              extra: {'type': _type, 'from': _from, 'to': _to},
            ),
          ),
        ],
      ),
    );
  }

  Widget _radio(String value, String label) {
    return RadioListTile<String>(
      value: value,
      groupValue: _type,
      onChanged: (v) => setState(() => _type = v!),
      title: Text(label, style: AppTypography.body),
      contentPadding: EdgeInsets.zero,
      dense: true,
      activeColor: AppColors.primary,
    );
  }

  Widget _dateBtn({required String label, required String value, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: AppTypography.caption),
            const SizedBox(height: 4),
            Text(value, style: AppTypography.body),
          ],
        ),
      ),
    );
  }

  Widget _card({required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: child,
    );
  }

  Future<void> _pickDate(bool isFrom) async {
    final init = isFrom ? _from : _to;
    final picked = await showDatePicker(
      context: context,
      initialDate: init,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() {
        if (isFrom) {
          _from = picked;
        } else {
          _to = picked;
        }
      });
    }
  }
}
