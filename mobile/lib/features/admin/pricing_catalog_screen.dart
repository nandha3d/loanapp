import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/services/pricing_service.dart';
import 'package:zolofund/data/models/pricing.dart';

class PricingCatalogScreen extends ConsumerStatefulWidget {
  const PricingCatalogScreen({super.key});

  @override
  ConsumerState<PricingCatalogScreen> createState() => _PricingCatalogScreenState();
}

class _PricingCatalogScreenState extends ConsumerState<PricingCatalogScreen> {
  bool _isLoading = true;
  String _error = '';
  PricingCatalog? _catalog;

  @override
  void initState() {
    super.initState();
    _fetchCatalog();
  }

  Future<void> _fetchCatalog() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });
    try {
      final data = await ref.read(pricingServiceProvider).fetchPricingCatalog();
      setState(() {
        _catalog = data;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Pricing Catalog'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchCatalog,
          ),
        ],
      ),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _error.isNotEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('Error loading catalog: $_error', style: const TextStyle(color: AppColors.danger)),
                          const SizedBox(height: 16),
                          TextButton(onPressed: _fetchCatalog, child: const Text('Retry')),
                        ],
                      ),
                    ),
                  )
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_catalog != null && _catalog!.plans.isNotEmpty) ...[
                        Text('Subscription Plans', style: AppTypography.sectionTitle),
                        const SizedBox(height: 12),
                        ..._catalog!.plans.map((p) => Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: _PlanCard(
                                name: p.displayName,
                                price: '₹${p.monthlyPrice}/mo',
                                features: [
                                  'Max Branches: ${p.maxBranches}',
                                  'Max Agents: ${p.maxAgents}',
                                  'Max Active Loans: ${p.maxActiveLoans}',
                                  ...p.features,
                                ],
                              ),
                            ),),
                      ],
                      if (_catalog != null && _catalog!.modules.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Text('Add-on Modules', style: AppTypography.sectionTitle),
                        const SizedBox(height: 12),
                        ..._catalog!.modules.map((m) => _CatalogItemTile(
                              title: m.displayName,
                              subtitle: m.description ?? '',
                              price: '₹${m.monthlyPrice}/mo',
                              icon: Icons.view_module,
                            ),),
                      ],
                      if (_catalog != null && _catalog!.addons.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Text('System Add-ons', style: AppTypography.sectionTitle),
                        const SizedBox(height: 12),
                        ..._catalog!.addons.map((a) => _CatalogItemTile(
                              title: a.displayName,
                              subtitle: a.description ?? '',
                              price: '₹${a.monthlyPrice}/mo',
                              icon: Icons.add_circle_outline,
                            ),),
                      ],
                    ],
                  ),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.name, required this.price, required this.features});
  final String name;
  final String price;
  final List<String> features;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(name, style: AppTypography.nameLg.copyWith(fontSize: 18, color: AppColors.primary)),
              Text(price, style: AppTypography.nameLg.copyWith(fontSize: 16, fontWeight: FontWeight.bold)),
            ],
          ),
          const Divider(height: 24),
          for (final f in features)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  const Icon(Icons.check, color: AppColors.success, size: 16),
                  const SizedBox(width: 8),
                  Expanded(child: Text(f, style: AppTypography.body)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _CatalogItemTile extends StatelessWidget {
  const _CatalogItemTile({required this.title, required this.subtitle, required this.price, required this.icon});
  final String title;
  final String subtitle;
  final String price;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.primary, size: 24),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppTypography.nameLg.copyWith(fontSize: 14)),
                if (subtitle.isNotEmpty) Text(subtitle, style: AppTypography.caption),
              ],
            ),
          ),
          Text(price, style: AppTypography.nameLg.copyWith(fontSize: 14, color: AppColors.textPrimary)),
        ],
      ),
    );
  }
}
