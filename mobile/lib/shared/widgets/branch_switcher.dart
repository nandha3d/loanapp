import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/shared/constants/endpoints.dart';

/// Superadmin branch switcher — mobile twin of the web header dropdown.
/// The list and the active branch come from `GET /auth/me/branches`, which
/// resolves `X-Branch-Id` exactly as every other v1 route does.
class BranchOption {
  const BranchOption(this.id, this.name);
  final String id; // `all` = All Branches
  final String name;
}

class MyBranches {
  const MyBranches({required this.canSwitch, required this.activeBranchId, required this.branches});
  const MyBranches.none() : this(canSwitch: false, activeBranchId: null, branches: const []);

  final bool canSwitch;
  final String? activeBranchId;
  final List<BranchOption> branches;

  factory MyBranches.fromJson(Map<String, dynamic> json) => MyBranches(
        canSwitch: json['canSwitch'] == true,
        activeBranchId: json['activeBranchId'] as String?,
        branches: [
          for (final b in (json['branches'] as List<dynamic>? ?? const []))
            BranchOption((b as Map<String, dynamic>)['id'] as String, b['name'] as String),
        ],
      );
}

/// Rebuilds on every auth state change, so a switch refetches the active branch.
final myBranchesProvider = FutureProvider<MyBranches>((ref) async {
  final user = ref.watch(authControllerProvider).user;
  if (user == null || user.role != UserRole.superadmin) return const MyBranches.none();
  final res = await ref.watch(dioProvider).get<dynamic>(Endpoints.myBranches);
  return unwrapEnvelope(res, (d) => MyBranches.fromJson(d as Map<String, dynamic>));
});

/// " · Erode ▾" — shown after the screen subtitle for a superadmin with two
/// or more branches; renders nothing for everyone else (or on a fetch error,
/// so the app bar never breaks).
class BranchSwitcherLabel extends ConsumerWidget {
  const BranchSwitcherLabel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(myBranchesProvider).valueOrNull;
    if (data == null || !data.canSwitch) return const SizedBox.shrink();
    final t = T.of(ref);
    final active = data.branches.where((b) => b.id == data.activeBranchId).firstOrNull;

    return InkWell(
      onTap: () => _pick(context, ref, data),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(
            child: Text(
              ' · ${active == null ? t.x('branch.switch') : _label(t, active)}',
              overflow: TextOverflow.ellipsis,
              style: AppTypography.caption.copyWith(color: AppColors.primary, height: 1.1),
            ),
          ),
          Icon(Icons.arrow_drop_down, size: 16, color: AppColors.primary),
        ],
      ),
    );
  }

  static String _label(T t, BranchOption b) => b.id == 'all' ? t.x('branch.all') : b.name;

  Future<void> _pick(BuildContext context, WidgetRef ref, MyBranches data) async {
    final t = T.of(ref);
    final picked = await showModalBottomSheet<BranchOption>(
      context: context,
      builder: (ctx) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            ListTile(title: Text(t.x('branch.switch'), style: AppTypography.sectionTitle)),
            for (final b in data.branches)
              ListTile(
                leading: Icon(b.id == 'all' ? Icons.apartment : Icons.store_outlined),
                title: Text(_label(t, b)),
                trailing: b.id == data.activeBranchId
                    ? Icon(Icons.check, color: AppColors.primary)
                    : null,
                onTap: () => Navigator.pop(ctx, b),
              ),
          ],
        ),
      ),
    );
    if (picked == null || picked.id == data.activeBranchId) return;

    await ref.read(authControllerProvider.notifier).setActiveBranch(picked.id);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${t.x('branch.switched')}: ${_label(t, picked)}')),
    );
    final appType = ref.read(authControllerProvider).user?.appType ?? AppType.microlending;
    context.go(AppType.landingRoute(appType));
  }
}
