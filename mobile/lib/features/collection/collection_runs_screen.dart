import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/route_model.dart';
import 'package:zolofund/data/services/collection_run_service.dart';
import 'package:zolofund/data/services/settings_service.dart';
import 'package:zolofund/shared/widgets/bottom_nav.dart';
import 'package:zolofund/shared/widgets/empty_state.dart';
import 'package:zolofund/shared/widgets/skeleton.dart';

final _routesProvider = FutureProvider.autoDispose<List<AppRoute>>((ref) {
  return ref.watch(settingsServiceProvider).routes();
});

/// mCollect-A — pick a route and open a batch collection run.
class CollectionRunsScreen extends ConsumerStatefulWidget {
  const CollectionRunsScreen({super.key});

  @override
  ConsumerState<CollectionRunsScreen> createState() =>
      _CollectionRunsScreenState();
}

class _CollectionRunsScreenState extends ConsumerState<CollectionRunsScreen> {
  String? _openingRouteId;

  Future<void> _start(AppRoute route) async {
    setState(() => _openingRouteId = route.id);
    try {
      final run = await ref
          .read(collectionRunServiceProvider)
          .openRun(routeId: route.id);
      if (!mounted) return;
      context.push('/collection/runs/${run.id}');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(e.toString()), backgroundColor: AppColors.danger,),
      );
    } finally {
      if (mounted) setState(() => _openingRouteId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final routesAsync = ref.watch(_routesProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Collection Runs'), centerTitle: true),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          ref.invalidate(_routesProvider);
          await ref.read(_routesProvider.future);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(AppTokens.radius),
              ),
              child: Text(
                'Open a run for your route, collect every due customer on one sheet, then deposit the day’s cash.',
                style:
                    AppTypography.body.copyWith(color: AppColors.textSecondary),
              ),
            ),
            const SizedBox(height: 16),
            Text('Your routes', style: AppTypography.sectionTitle),
            const SizedBox(height: 8),
            routesAsync.when(
              loading: () => const Skeleton(height: 160),
              error: (e, _) => Text(e.toString(),
                  style: AppTypography.body.copyWith(color: AppColors.danger),),
              data: (routes) => routes.isEmpty
                  ? const EmptyState(
                      icon: Icons.route_outlined, title: 'No routes assigned',)
                  : Column(
                      children: routes
                          .map((r) => _RouteTile(
                                route: r,
                                busy: _openingRouteId == r.id,
                                onTap: () => _start(r),
                              ),)
                          .toList(),
                    ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/collection'),
    );
  }
}

class _RouteTile extends StatelessWidget {
  const _RouteTile(
      {required this.route, required this.busy, required this.onTap,});
  final AppRoute route;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        leading: CircleAvatar(
          backgroundColor: AppColors.primaryLight,
          child: Icon(Icons.route_rounded, color: AppColors.primary),
        ),
        title: Text(route.name, style: AppTypography.bodyLarge),
        subtitle: Text('${route.customerCount} customers',
            style: AppTypography.caption,),
        trailing: busy
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),)
            : Icon(Icons.play_circle_fill_rounded,
                color: AppColors.primary, size: 30,),
        onTap: busy ? null : onTap,
      ),
    );
  }
}
