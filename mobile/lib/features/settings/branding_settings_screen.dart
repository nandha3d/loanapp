import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/network/api_exception.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/core/theme/theme_controller.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/data/services/settings_service.dart';
import 'package:zolofund/features/billing/widgets/plan_upgrade_sheet.dart';

/// What the business owner decides about how the app and its paperwork look:
/// the app colour (picked from the presets the server offers) and whether
/// receipt / statement PDFs are available to staff. Prefixes, counters and
/// other system values are not here — those belong to the platform.
class BrandingSettingsScreen extends ConsumerStatefulWidget {
  const BrandingSettingsScreen({super.key});

  @override
  ConsumerState<BrandingSettingsScreen> createState() =>
      _BrandingSettingsScreenState();
}

class _BrandingSettingsScreenState
    extends ConsumerState<BrandingSettingsScreen> {
  bool _loading = true;
  bool _busy = false;
  String _error = '';
  String _preset = 'default';
  bool _canEdit = false;
  bool _receiptPdf = false;
  List<Map<String, dynamic>> _presets = const [];

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
      final service = ref.read(settingsServiceProvider);
      final results = await Future.wait<Object>([service.theme(), service.all()]);
      final theme = results[0] as Map<String, dynamic>;
      final rows = results[1] as List<Map<String, dynamic>>;
      _preset = (theme['preset'] as String?) ?? 'default';
      _canEdit = theme['canEdit'] == true;
      _presets = [
        for (final p in (theme['presets'] as List<dynamic>? ?? const []))
          Map<String, dynamic>.from(p as Map),
      ];
      _receiptPdf = rows.any(
        (r) => r['key'] == 'receipt_pdf_active' && '${r['value']}' == 'true',
      );
    } catch (e) {
      _error = e is ApiException ? e.message : e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _snack(String message, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? AppColors.danger : null,
      ),
    );
  }

  Future<void> _pickTheme(String key) async {
    if (_busy || key == _preset) return;
    final t = T.of(ref);
    setState(() => _busy = true);
    try {
      await ref.read(settingsServiceProvider).applyTheme(key);
      _preset = key;
      // Re-read so this device recolours immediately.
      await ref.read(themeControllerProvider.notifier).refresh();
      _snack(t.x('brand.saved'));
    } catch (e) {
      _snack(e is ApiException ? e.message : e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _setReceiptPdf(bool value) async {
    final t = T.of(ref);
    setState(() => _busy = true);
    try {
      await ref
          .read(settingsServiceProvider)
          .save({'receipt_pdf_active': value.toString()});
      _receiptPdf = value;
      _snack(t.x('brand.saved'));
    } catch (e) {
      _snack(e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  static Color _hex(Object? v) {
    final cleaned = '$v'.replaceFirst('#', '');
    return Color(0xFF000000 | (int.tryParse(cleaned, radix: 16) ?? 0x888888));
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final user = ref.watch(authControllerProvider).user;
    final pdfAllowed =
        user?.receiptPdfAllowed == true || user?.role == UserRole.developer;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('brand.title')),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/settings'),
        ),
      ),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error.isNotEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        _error,
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.danger),
                      ),
                    ),
                  )
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _card(
                        title: t.x('brand.colour_title'),
                        children: [
                          Text(t.x('brand.colour_hint'),
                              style: AppTypography.caption,),
                          const SizedBox(height: 14),
                          Wrap(
                            spacing: 14,
                            runSpacing: 14,
                            children: [
                              _swatch(
                                key: 'default',
                                name: t.x('brand.default'),
                                color: AppColors.defaultPrimary,
                              ),
                              for (final p in _presets)
                                _swatch(
                                  key: '${p['key']}',
                                  name: '${p['name']}',
                                  color: _hex(p['primary']),
                                ),
                            ],
                          ),
                          if (!_canEdit) ...[
                            const SizedBox(height: 12),
                            Text(t.x('sec.owner_only'),
                                style: AppTypography.caption,),
                          ],
                        ],
                      ),
                      const SizedBox(height: 16),
                      _card(
                        title: t.x('brand.docs_title'),
                        children: [
                          SwitchListTile.adaptive(
                            contentPadding: EdgeInsets.zero,
                            secondary: pdfAllowed
                                ? null
                                : const Icon(Icons.lock_rounded,
                                    color: AppColors.warning,),
                            title: Text(t.x('brand.receipt_switch')),
                            subtitle: Text(
                              t.x('brand.receipt_hint'),
                              style: AppTypography.caption,
                            ),
                            value: pdfAllowed && _receiptPdf,
                            onChanged: _busy
                                ? null
                                : pdfAllowed
                                    ? _setReceiptPdf
                                    : (_) => showPlanUpgradeSheet(
                                          context,
                                          ref,
                                          featureKey: 'receipt_pdf',
                                        ),
                          ),
                        ],
                      ),
                    ],
                  ),
      ),
    );
  }

  Widget _swatch({
    required String key,
    required String name,
    required Color color,
  }) {
    final selected = key == _preset;
    return InkWell(
      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
      onTap: (!_canEdit || _busy) ? null : () => _pickTheme(key),
      child: SizedBox(
        width: 64,
        child: Column(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
                border: Border.all(
                  color: selected ? AppColors.textPrimary : AppColors.border,
                  width: selected ? 3 : 1,
                ),
              ),
              child: selected
                  ? const Icon(Icons.check, color: Colors.white, size: 22)
                  : null,
            ),
            const SizedBox(height: 4),
            Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.tiny,
            ),
          ],
        ),
      ),
    );
  }

  Widget _card({required String title, required List<Widget> children}) =>
      Container(
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
            const SizedBox(height: 8),
            ...children,
          ],
        ),
      );
}
