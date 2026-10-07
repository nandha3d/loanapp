import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';

import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/services/admin_service.dart';
import 'package:zolofund/shared/widgets/app_button.dart';

/// The owner's own referral dashboard (mobile twin of the web Affiliate page).
/// The developer's all-partners view is [AffiliateAdminScreen]. Every figure,
/// the progress percentage and the referral path come from
/// `GET /api/v1/affiliate/me` — nothing is derived here (STABLE-8).
class AffiliatePartnerScreen extends ConsumerStatefulWidget {
  const AffiliatePartnerScreen({super.key});

  @override
  ConsumerState<AffiliatePartnerScreen> createState() => _AffiliatePartnerScreenState();
}

class _AffiliatePartnerScreenState extends ConsumerState<AffiliatePartnerScreen> {
  bool _loading = true;
  String _error = '';
  Map<String, dynamic> _data = {};

  static final _money = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final data = await ref.read(adminServiceProvider).getMyAffiliate();
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Map<String, dynamic> _map(Object? v) =>
      v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};

  List<Map<String, dynamic>> _list(Object? v) =>
      v is List ? [for (final e in v) _map(e)] : const [];

  String _date(Object? iso) {
    final d = DateTime.tryParse('${iso ?? ''}');
    return d == null ? '—' : DateFormat('dd MMM yyyy').format(d.toLocal());
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('set.affiliate')),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error.isNotEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '${t.x('err.could_not_load')}\n$_error',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: AppColors.danger),
                          ),
                          const SizedBox(height: 16),
                          AppButton(label: t.x('common.retry'), onPressed: _load),
                        ],
                      ),
                    ),
                  )
                : RefreshIndicator(onRefresh: _load, child: _body(t)),
      ),
    );
  }

  Widget _body(T t) {
    final affiliate = _map(_data['affiliate']);
    final stats = _map(_data['stats']);
    final config = _map(_data['config']);
    final rewards = _map(_data['rewards']);
    final current = _map(rewards['current']);
    final granted = _list(rewards['granted']);
    final referrals = _list(_data['referrals']);

    final threshold = (config['threshold'] as num?)?.toInt() ?? 0;
    final paid = (stats['referredPaidCount'] as num?)?.toInt() ?? 0;
    final percent = (stats['progressPercent'] as num?)?.toInt() ?? 0;
    final unlocked = stats['unlocked'] == true;
    final remaining = (stats['remainingToUnlock'] as num?)?.toInt() ?? 0;
    final url = '${ref.read(mediaBaseUrlProvider)}${_data['referralPath'] ?? ''}';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _card(
          title: t.x('aff.link_title'),
          children: [
            Text(t.x('aff.link_desc'), style: AppTypography.caption),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                border: Border.all(color: AppColors.border),
              ),
              child: SelectableText(
                url,
                style: AppTypography.bodySmall.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: AppButton(
                    label: t.x('aff.copy'),
                    leading: const Icon(Icons.copy_rounded),
                    variant: AppButtonVariant.secondary,
                    onPressed: () async {
                      final messenger = ScaffoldMessenger.of(context);
                      await Clipboard.setData(ClipboardData(text: url));
                      messenger.showSnackBar(SnackBar(content: Text(t.x('aff.copied'))));
                    },
                    expand: true,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: AppButton(
                    label: t.x('aff.share'),
                    leading: const Icon(Icons.share_outlined),
                    onPressed: () => Share.share(url),
                    expand: true,
                  ),
                ),
              ],
            ),
            if ((affiliate['code'] as String?)?.isNotEmpty == true) ...[
              const SizedBox(height: 10),
              Text('${t.x('aff.code')}: ${affiliate['code']}', style: AppTypography.caption),
            ],
          ],
        ),
        const SizedBox(height: 14),
        _card(
          title: t.x('aff.progress_title'),
          children: [
            Text(
              t
                  .x('aff.progress_count')
                  .replaceAll('{paid}', '$paid')
                  .replaceAll('{total}', '$threshold'),
              style: AppTypography.bodyLarge,
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: percent / 100,
                minHeight: 8,
                backgroundColor: AppColors.border,
                color: unlocked ? AppColors.success : AppColors.primary,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              unlocked
                  ? t.x('aff.unlocked')
                  : t.x('aff.need_more').replaceAll('{n}', '$remaining'),
              style: AppTypography.caption.copyWith(
                color: unlocked ? AppColors.successText : AppColors.textSecondary,
                fontWeight: unlocked ? FontWeight.w700 : FontWeight.w400,
              ),
            ),
            if (unlocked) ...[
              const SizedBox(height: 12),
              Text(t.x('aff.your_reward'), style: AppTypography.caption),
              const SizedBox(height: 2),
              Text(
                _money.format((current['affiliateValue'] as num?) ?? 0),
                style: AppTypography.nameLg.copyWith(fontSize: 22),
              ),
              Text(_rewardType(t, '${current['type']}'), style: AppTypography.caption),
            ],
          ],
        ),
        const SizedBox(height: 14),
        _card(
          title: t.x('aff.referrals_title'),
          children: [
            if (referrals.isEmpty)
              Text(t.x('aff.no_referrals'), style: AppTypography.caption)
            else
              for (final r in referrals)
                _row(
                  title: (r['referredEmail'] as String?) ?? '—',
                  subtitle: _date(r['subscribedAt'] ?? r['createdAt']),
                  trailing: _status(t, '${r['status']}'),
                  amount: (r['monthlyPrice'] as num?) != null && (r['monthlyPrice'] as num) > 0
                      ? _money.format(r['monthlyPrice'])
                      : null,
                ),
          ],
        ),
        const SizedBox(height: 14),
        _card(
          title: t.x('aff.rewards_title'),
          children: [
            if (granted.isEmpty)
              Text(t.x('aff.no_rewards'), style: AppTypography.caption)
            else
              for (final r in granted)
                _row(
                  title: _rewardType(t, '${r['type']}'),
                  subtitle: t.x('aff.generated_on').replaceAll('{date}', _date(r['createdAt'])),
                  trailing: _status(t, '${r['status']}'),
                  amount: _money.format((r['amount'] as num?) ?? 0),
                ),
          ],
        ),
      ],
    );
  }

  String _rewardType(T t, String type) => switch (type) {
        'free_year' => t.x('aff.reward_free_year'),
        'commission_5mo' => t.x('aff.reward_commission'),
        _ => type,
      };

  /// Known statuses are translated; anything new from the server shows as sent.
  String _status(T t, String status) {
    final key = 'aff.status.$status';
    final label = t.x(key);
    return label == key ? status : label;
  }

  Widget _card({required String title, required List<Widget> children}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppTokens.radius),
          boxShadow: AppTokens.shadow,
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: AppTypography.sectionTitle),
            const SizedBox(height: 10),
            ...children,
          ],
        ),
      );

  Widget _row({
    required String title,
    required String subtitle,
    required String trailing,
    String? amount,
  }) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w700)),
                  Text(subtitle, style: AppTypography.caption),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (amount != null)
                  Text(amount, style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w700)),
                Text(trailing.toUpperCase(), style: AppTypography.tiny),
              ],
            ),
          ],
        ),
      );
}
