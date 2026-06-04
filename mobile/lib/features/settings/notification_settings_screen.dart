import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/services/settings_service.dart';

final _notifSettingsProvider =
    FutureProvider.autoDispose<Map<String, String>>((ref) async {
  final rows = await ref.read(settingsServiceProvider).all();
  return {
    for (final r in rows)
      if (r['key'] is String) r['key'] as String: (r['value'] ?? '').toString(),
  };
});

class NotificationSettingsScreen extends ConsumerStatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  ConsumerState<NotificationSettingsScreen> createState() =>
      _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState
    extends ConsumerState<NotificationSettingsScreen> {
  bool _masterSwitch = true;
  bool _channelSms = false;
  bool _channelWhatsapp = false;
  bool _channelEmail = false;
  bool _eventPaymentReceived = true;
  bool _eventDueReminder = true;
  bool _eventLoanDisbursed = true;
  bool _eventLoanOverdue = true;
  bool _eventLoanClosed = true;
  bool _eventPenaltyAccrued = true;

  bool _seeded = false;
  bool _saving = false;

  void _seed(Map<String, String> m) {
    if (_seeded) return;
    _seeded = true;
    _masterSwitch = m['whatsapp_sms_active'] != 'false';
    _channelSms = m['notify_channel_sms'] == 'true';
    _channelWhatsapp = m['notify_channel_whatsapp'] == 'true';
    _channelEmail = m['notify_channel_email'] == 'true';
    _eventPaymentReceived = m['notify_event_payment_received'] != 'false';
    _eventDueReminder = m['notify_event_due_reminder'] != 'false';
    _eventLoanDisbursed = m['notify_event_loan_disbursed'] != 'false';
    _eventLoanOverdue = m['notify_event_loan_overdue'] != 'false';
    _eventLoanClosed = m['notify_event_loan_closed'] != 'false';
    _eventPenaltyAccrued = m['notify_event_penalty_accrued'] != 'false';
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref.read(settingsServiceProvider).save({
        'whatsapp_sms_active': _masterSwitch ? 'true' : 'false',
        'notify_channel_sms': _channelSms ? 'true' : 'false',
        'notify_channel_whatsapp': _channelWhatsapp ? 'true' : 'false',
        'notify_channel_email': _channelEmail ? 'true' : 'false',
        'notify_event_payment_received':
            _eventPaymentReceived ? 'true' : 'false',
        'notify_event_due_reminder': _eventDueReminder ? 'true' : 'false',
        'notify_event_loan_disbursed': _eventLoanDisbursed ? 'true' : 'false',
        'notify_event_loan_overdue': _eventLoanOverdue ? 'true' : 'false',
        'notify_event_loan_closed': _eventLoanClosed ? 'true' : 'false',
        'notify_event_penalty_accrued':
            _eventPenaltyAccrued ? 'true' : 'false',
      });
      if (mounted) {
        final t = T.of(ref);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(t.x('set.notif_saved')),
            backgroundColor: AppColors.success,
          ),
        );
        ref.invalidate(_notifSettingsProvider);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final async = ref.watch(_notifSettingsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('set.notifications')),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text(e.toString(),
              style: AppTypography.body.copyWith(color: AppColors.danger),),
        ),
        data: (m) {
          _seed(m);
          return _buildForm(t);
        },
      ),
    );
  }

  Widget _buildForm(T t) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Master switch
        _SectionCard(
          icon: Icons.notifications_active_outlined,
          title: t.x('set.notifications'),
          child: Column(
            children: [
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                title: Text(t.x('set.notif_enable'), style: AppTypography.body),
                subtitle: Text(
                  t.x('set.notif_enable_hint'),
                  style: AppTypography.caption,
                ),
                value: _masterSwitch,
                activeThumbColor: AppColors.primary,
                onChanged: (v) => setState(() => _masterSwitch = v),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Channels
        _SectionCard(
          icon: Icons.send_outlined,
          title: t.x('set.notif_channels'),
          child: Column(
            children: [
              _SwitchRow(
                label: t.x('set.notif_sms'),
                value: _channelSms,
                onChanged: (v) => setState(() => _channelSms = v),
              ),
              const Divider(height: 1, color: AppColors.border),
              _SwitchRow(
                label: t.x('set.notif_whatsapp'),
                value: _channelWhatsapp,
                onChanged: (v) => setState(() => _channelWhatsapp = v),
              ),
              const Divider(height: 1, color: AppColors.border),
              _SwitchRow(
                label: t.x('set.notif_email'),
                value: _channelEmail,
                onChanged: (v) => setState(() => _channelEmail = v),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Event triggers
        _SectionCard(
          icon: Icons.bolt_outlined,
          title: t.x('set.notif_triggers'),
          child: Column(
            children: [
              _SwitchRow(
                label: t.x('set.notif_payment_received'),
                value: _eventPaymentReceived,
                onChanged: (v) => setState(() => _eventPaymentReceived = v),
              ),
              const Divider(height: 1, color: AppColors.border),
              _SwitchRow(
                label: t.x('set.notif_due_reminder'),
                value: _eventDueReminder,
                onChanged: (v) => setState(() => _eventDueReminder = v),
              ),
              const Divider(height: 1, color: AppColors.border),
              _SwitchRow(
                label: t.x('set.notif_loan_disbursed'),
                value: _eventLoanDisbursed,
                onChanged: (v) => setState(() => _eventLoanDisbursed = v),
              ),
              const Divider(height: 1, color: AppColors.border),
              _SwitchRow(
                label: t.x('set.notif_loan_overdue'),
                value: _eventLoanOverdue,
                onChanged: (v) => setState(() => _eventLoanOverdue = v),
              ),
              const Divider(height: 1, color: AppColors.border),
              _SwitchRow(
                label: t.x('set.notif_loan_closed'),
                value: _eventLoanClosed,
                onChanged: (v) => setState(() => _eventLoanClosed = v),
              ),
              const Divider(height: 1, color: AppColors.border),
              _SwitchRow(
                label: t.x('set.notif_penalty_accrued'),
                value: _eventPenaltyAccrued,
                onChanged: (v) => setState(() => _eventPenaltyAccrued = v),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // View logs link
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.primaryLight,
            borderRadius: BorderRadius.circular(AppTokens.radius),
            border: Border.all(color: AppColors.border),
          ),
          child: InkWell(
            onTap: () => context.push('/notifications'),
            child: Row(
              children: [
                const Icon(Icons.history, color: AppColors.primary, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t.x('set.notif_logs'),
                          style: AppTypography.bodyLarge
                              .copyWith(color: AppColors.primaryDark),),
                      const SizedBox(height: 2),
                      Text(t.x('set.notif_logs_hint'),
                          style: AppTypography.caption,),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: AppColors.primary),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),

        FilledButton(
          onPressed: _saving ? null : _save,
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.primary,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppTokens.radiusSm),
            ),
          ),
          child: _saving
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white,),
                )
              : Text(t.x('common.save'),
                  style: const TextStyle(color: Colors.white),),
        ),
        const SizedBox(height: 24),
      ],
    );
  }
}

class _SwitchRow extends StatelessWidget {
  const _SwitchRow({
    required this.label,
    required this.value,
    required this.onChanged,
  });
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return SwitchListTile.adaptive(
      contentPadding: EdgeInsets.zero,
      title: Text(label, style: AppTypography.body),
      value: value,
      activeThumbColor: AppColors.primary,
      onChanged: onChanged,
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.icon,
    required this.title,
    required this.child,
  });
  final IconData icon;
  final String title;
  final Widget child;

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
          Row(
            children: [
              Icon(icon, color: AppColors.primary, size: 18),
              const SizedBox(width: 8),
              Text(title, style: AppTypography.sectionTitle),
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}
