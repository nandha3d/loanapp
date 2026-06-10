import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:go_router/go_router.dart';

import 'package:loantrack/core/a11y/ui_prefs.dart';
import 'package:loantrack/core/a11y/voice_assist.dart';
import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/l10n/app_strings.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/route_model.dart';
import 'package:loantrack/data/models/user.dart';
import 'package:loantrack/data/services/settings_service.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

final _routesProvider = FutureProvider.autoDispose<List<AppRoute>>((ref) {
  return ref.watch(settingsServiceProvider).routes();
});

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final t = T.of(ref);
    final lang = ref.watch(languageProvider);
    final voiceOn = ref.watch(voiceAssistProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text(t.x('set.title')), centerTitle: true),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _ProfileCard(
            name: user?.name ?? '—',
            email: user?.email ?? '',
            role: user?.role.name ?? '',
          ),
          const SizedBox(height: 16),
          _Section(
            title: t.x('set.preferences'),
            child: Column(
              children: [
                _PrefRow(
                  icon: Icons.translate_rounded,
                  iconColor: AppColors.info,
                  iconBg: AppColors.infoBg,
                  label: t.x('set.language'),
                  trailing: Text(
                    lang.nativeName,
                    style: AppTypography.bodyLarge.copyWith(
                      color: AppColors.primary,
                    ),
                  ),
                  onTap: () => _pickLanguage(context, ref, lang),
                ),
                const Divider(height: 1, color: AppColors.border),
                _PrefSwitchRow(
                  icon: Icons.record_voice_over_rounded,
                  iconColor: AppColors.purple,
                  iconBg: AppColors.purpleBg,
                  label: t.x('set.voice_assist'),
                  subtitle: t.x('set.voice_assist_hint'),
                  value: voiceOn,
                  onChanged: (bool v) =>
                      ref.read(voiceAssistProvider.notifier).setEnabled(v),
                ),
                const Divider(height: 1, color: AppColors.border),
                // Text size (U6) - app-wide scaler, persisted.
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.format_size,
                        size: 20, color: AppColors.primary,),
                  ),
                  title: const Text('Text size'),
                  trailing: Consumer(builder: (context, ref, _) {
                    final scale = ref.watch(textScaleProvider);
                    return DropdownButton<double>(
                      value: scale,
                      underline: const SizedBox.shrink(),
                      items: const [
                        DropdownMenuItem(value: 0.9, child: Text('Small')),
                        DropdownMenuItem(value: 1.0, child: Text('Normal')),
                        DropdownMenuItem(value: 1.15, child: Text('Large')),
                        DropdownMenuItem(value: 1.3, child: Text('Extra large')),
                      ],
                      onChanged: (v) {
                        if (v != null) {
                          ref.read(textScaleProvider.notifier).set(v);
                        }
                      },
                    );
                  },),
                ),
                const Divider(height: 1, color: AppColors.border),
                // Simple mode (U4) - reduced More menu for daily field work.
                Consumer(builder: (context, ref, _) {
                  final simple = ref.watch(simpleModeProvider);
                  return _PrefSwitchRow(
                    icon: Icons.dashboard_customize_outlined,
                    iconColor: AppColors.primary,
                    iconBg: AppColors.primaryLight,
                    label: 'Simple mode',
                    subtitle: 'Show only daily-work items in the More menu',
                    value: simple,
                    onChanged: (bool v) =>
                        ref.read(simpleModeProvider.notifier).set(v),
                  );
                },),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _Section(
            title: t.x('set.routes'),
            trailing: TextButton.icon(
              icon: const Icon(Icons.add, size: 16),
              label: Text(t.x('set.add_route')),
              onPressed: () => _showAddRoute(context, ref),
            ),
            child: ref.watch(_routesProvider).when(
                  loading: () => const Skeleton(
                    height: 80,
                    borderRadius: AppTokens.radiusSm,
                  ),
                  error: (e, _) => Text(
                    e.toString(),
                    style: AppTypography.body.copyWith(color: AppColors.danger),
                  ),
                  data: (routes) => routes.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Text(
                            t.x('set.no_routes'),
                            style: AppTypography.body
                                .copyWith(color: AppColors.textSecondary),
                          ),
                        )
                      : Column(
                          children: routes
                              .map((r) => _RouteRow(route: r, t: t))
                              .toList(),
                        ),
                ),
          ),
          const SizedBox(height: 16),
          _Section(
            title: t.x('set.account'),
            child: Column(
              children: [
                if (user?.role == UserRole.admin ||
                    user?.role == UserRole.superadmin ||
                    user?.role == UserRole.developer) ...[
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(
                      Icons.bolt_outlined,
                      color: AppColors.primary,
                    ),
                    title: Text(
                      t.x('set.penalty'),
                      style: AppTypography.bodyLarge,
                    ),
                    subtitle: Text(
                      t.x('set.penalty_subtitle'),
                      style: AppTypography.caption,
                    ),
                    trailing: const Icon(
                      Icons.chevron_right,
                      color: AppColors.textLight,
                    ),
                    onTap: () => context.push('/settings/penalty'),
                  ),
                  const Divider(height: 1, color: AppColors.border),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(
                      Icons.account_balance_wallet_outlined,
                      color: AppColors.primary,
                    ),
                    title: Text(
                      t.x('set.payment'),
                      style: AppTypography.bodyLarge,
                    ),
                    subtitle: Text(
                      t.x('set.payment_subtitle'),
                      style: AppTypography.caption,
                    ),
                    trailing: const Icon(
                      Icons.chevron_right,
                      color: AppColors.textLight,
                    ),
                    onTap: () => context.push('/settings/payment'),
                  ),
                  const Divider(height: 1, color: AppColors.border),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(
                      Icons.notifications_active_outlined,
                      color: AppColors.primary,
                    ),
                    title: Text(
                      t.x('set.notifications'),
                      style: AppTypography.bodyLarge,
                    ),
                    subtitle: Text(
                      t.x('set.notif_subtitle'),
                      style: AppTypography.caption,
                    ),
                    trailing: const Icon(
                      Icons.chevron_right,
                      color: AppColors.textLight,
                    ),
                    onTap: () => context.push('/settings/notifications'),
                  ),
                  const Divider(height: 1, color: AppColors.border),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(
                      Icons.folder_open_outlined,
                      color: AppColors.primary,
                    ),
                    title:
                        Text('Loan Packages', style: AppTypography.bodyLarge),
                    subtitle: Text(
                      'Configure product interest rates and terms',
                      style: AppTypography.caption,
                    ),
                    trailing: const Icon(
                      Icons.chevron_right,
                      color: AppColors.textLight,
                    ),
                    onTap: () => context.push('/settings/packages'),
                  ),
                  const Divider(height: 1, color: AppColors.border),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(
                      Icons.apps_outage_outlined,
                      color: AppColors.primary,
                    ),
                    title: Text(
                      'Bulk Collection Settings',
                      style: AppTypography.bodyLarge,
                    ),
                    subtitle: Text(
                      'Configure batch collection runs and sheet limits',
                      style: AppTypography.caption,
                    ),
                    trailing: const Icon(
                      Icons.chevron_right,
                      color: AppColors.textLight,
                    ),
                    onTap: () => context.push('/settings/bulk'),
                  ),
                  const Divider(height: 1, color: AppColors.border),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(
                      Icons.assignment_ind_outlined,
                      color: AppColors.primary,
                    ),
                    title: Text(
                      'Bureau Pull Configuration',
                      style: AppTypography.bodyLarge,
                    ),
                    subtitle: Text(
                      'Configure CRIF bureau pull API credentials',
                      style: AppTypography.caption,
                    ),
                    trailing: const Icon(
                      Icons.chevron_right,
                      color: AppColors.textLight,
                    ),
                    onTap: () => context.push('/settings/bureau'),
                  ),
                  const Divider(height: 1, color: AppColors.border),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(
                      Icons.warning_amber_outlined,
                      color: AppColors.primary,
                    ),
                    title: Text(
                      'NPA Status Rules',
                      style: AppTypography.bodyLarge,
                    ),
                    subtitle: Text(
                      'Configure overdue days and automated penalties',
                      style: AppTypography.caption,
                    ),
                    trailing: const Icon(
                      Icons.chevron_right,
                      color: AppColors.textLight,
                    ),
                    onTap: () => context.push('/settings/npa'),
                  ),
                  const Divider(height: 1, color: AppColors.border),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(
                      Icons.security_outlined,
                      color: AppColors.primary,
                    ),
                    title: Text(
                      'Security & Inactivity Locks',
                      style: AppTypography.bodyLarge,
                    ),
                    subtitle: Text(
                      'Configure biometric authentication and session timeout',
                      style: AppTypography.caption,
                    ),
                    trailing: const Icon(
                      Icons.chevron_right,
                      color: AppColors.textLight,
                    ),
                    onTap: () => context.push('/settings/security'),
                  ),
                  const Divider(height: 1, color: AppColors.border),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(
                      Icons.branding_watermark_outlined,
                      color: AppColors.primary,
                    ),
                    title: Text(
                      'Branding & Doc Configuration',
                      style: AppTypography.bodyLarge,
                    ),
                    subtitle: Text(
                      'Configure branding, document prefixes, and counters',
                      style: AppTypography.caption,
                    ),
                    trailing: const Icon(
                      Icons.chevron_right,
                      color: AppColors.textLight,
                    ),
                    onTap: () => context.push('/settings/branding'),
                  ),
                  const Divider(height: 1, color: AppColors.border),
                ],
                if (user?.role == UserRole.developer) ...[
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.tune, color: AppColors.primary),
                    title:
                        Text(t.x('sys.title'), style: AppTypography.bodyLarge),
                    subtitle:
                        Text(t.x('sys.subtitle'), style: AppTypography.caption),
                    trailing: const Icon(
                      Icons.chevron_right,
                      color: AppColors.textLight,
                    ),
                    onTap: () => context.push('/settings/system'),
                  ),
                  const Divider(height: 1, color: AppColors.border),
                ],
                _ActionRow(
                  icon: Icons.logout_rounded,
                  label: t.x('set.logout'),
                  color: AppColors.danger,
                  onTap: () => _confirmLogout(context, ref),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Center(
            child: Text('LoanTrack v0.1.0', style: AppTypography.caption),
          ),
          const SizedBox(height: 16),
        ],
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/settings'),
    );
  }

  Future<void> _showAddRoute(BuildContext context, WidgetRef ref) async {
    final t = T.of(ref);
    final ctrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTokens.radius),
        ),
        title: Text(t.x('set.add_route')),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: InputDecoration(
            labelText: t.x('set.route_name'),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppTokens.radiusSm),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(t.x('common.cancel')),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppTokens.radiusSm),
              ),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(
              t.x('btn.create'),
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );
    if (ok == true && ctrl.text.trim().isNotEmpty && context.mounted) {
      await ref
          .read(settingsServiceProvider)
          .createRoute(name: ctrl.text.trim());
      ref.invalidate(_routesProvider);
    }
  }

  Future<void> _pickLanguage(
    BuildContext context,
    WidgetRef ref,
    AppLang current,
  ) async {
    final picked = await showModalBottomSheet<AppLang>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                T.of(ref).x('set.choose_language'),
                style: AppTypography.sectionTitle,
              ),
              const SizedBox(height: 12),
              for (final lang in AppLang.values)
                _LangTile(
                  lang: lang,
                  selected: lang == current,
                  onTap: () => Navigator.of(ctx).pop(lang),
                ),
              const SizedBox(height: 6),
            ],
          ),
        ),
      ),
    );
    if (picked != null && picked != current) {
      await ref.read(languageProvider.notifier).set(picked);
    }
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final t = T.of(ref);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTokens.radius),
        ),
        title: Text(t.x('set.logout')),
        content: Text(t.x('set.logout_confirm')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(t.x('common.cancel')),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppTokens.radiusSm),
              ),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(
              t.x('set.logout'),
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );
    if (ok == true) {
      ref.read(authControllerProvider.notifier).logout();
    }
  }
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({
    required this.name,
    required this.email,
    required this.role,
  });
  final String name, email, role;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadowPrimaryHover,
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: Colors.white24,
            child: Text(
              name.isNotEmpty ? name[0].toUpperCase() : '?',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style:
                      AppTypography.sectionTitle.copyWith(color: Colors.white),
                ),
                if (email.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    email,
                    style: AppTypography.body.copyWith(color: Colors.white70),
                  ),
                ],
                const SizedBox(height: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(AppTokens.radiusBadge),
                  ),
                  child: Text(
                    role.toUpperCase(),
                    style: AppTypography.tiny.copyWith(color: Colors.white),
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

class _RouteRow extends StatelessWidget {
  const _RouteRow({required this.route, required this.t});
  final AppRoute route;
  final T t;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.infoBg,
              borderRadius: BorderRadius.circular(AppTokens.radiusSm),
            ),
            child: const Icon(
              Icons.route_outlined,
              color: AppColors.info,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(route.name, style: AppTypography.bodyLarge),
                if (route.agentName != null)
                  Text(route.agentName!, style: AppTypography.caption),
              ],
            ),
          ),
          Text(
            '${route.customerCount} ${t.x('set.customers_suffix')}',
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: AppTypography.bodyLarge.copyWith(color: color),
              ),
            ),
            Icon(Icons.chevron_right, color: color.withAlpha(120), size: 18),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child, this.trailing});
  final String title;
  final Widget child;
  final Widget? trailing;

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
              Text(title, style: AppTypography.sectionTitle),
              const Spacer(),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _PrefRow extends StatelessWidget {
  const _PrefRow({
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.label,
    required this.onTap,
    this.trailing,
  });
  final IconData icon;
  final Color iconColor, iconBg;
  final String label;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(AppTokens.radiusSm),
              ),
              child: Icon(icon, color: iconColor, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(label, style: AppTypography.bodyLarge),
            ),
            if (trailing != null) ...[
              trailing!,
              const SizedBox(width: 6),
            ],
            const Icon(
              Icons.chevron_right,
              color: AppColors.textLight,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}

class _PrefSwitchRow extends StatelessWidget {
  const _PrefSwitchRow({
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.label,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });
  final IconData icon;
  final Color iconColor, iconBg;
  final String label, subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => onChanged(!value),
      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(AppTokens.radiusSm),
              ),
              child: Icon(icon, color: iconColor, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: AppTypography.bodyLarge),
                  const SizedBox(height: 2),
                  Text(subtitle, style: AppTypography.caption),
                ],
              ),
            ),
            Switch.adaptive(
              value: value,
              // ignore: deprecated_member_use
              activeColor: AppColors.primary,
              onChanged: onChanged,
            ),
          ],
        ),
      ),
    );
  }
}

class _LangTile extends StatelessWidget {
  const _LangTile({
    required this.lang,
    required this.selected,
    required this.onTap,
  });
  final AppLang lang;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.primaryLight : AppColors.surface,
      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.only(bottom: 6),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTokens.radiusSm),
            border: Border.all(
              color: selected ? AppColors.primary : AppColors.border,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: selected ? AppColors.primary : AppColors.background,
                  borderRadius: BorderRadius.circular(8),
                ),
                alignment: Alignment.center,
                child: Text(
                  lang.code.toUpperCase(),
                  style: AppTypography.tiny.copyWith(
                    color: selected ? Colors.white : AppColors.textSecondary,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(lang.nativeName, style: AppTypography.bodyLarge),
              ),
              if (selected)
                const Icon(
                  Icons.check_circle_rounded,
                  color: AppColors.primary,
                  size: 20,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
