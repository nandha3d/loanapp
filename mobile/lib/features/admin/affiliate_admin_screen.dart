import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/services/admin_service.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class AffiliateAdminScreen extends ConsumerStatefulWidget {
  const AffiliateAdminScreen({super.key});

  @override
  ConsumerState<AffiliateAdminScreen> createState() => _AffiliateAdminScreenState();
}

class _AffiliateAdminScreenState extends ConsumerState<AffiliateAdminScreen> with SingleTickerProviderStateMixin {
  bool _isLoading = true;
  String _error = '';
  Map<String, dynamic> _affiliateData = {};
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _fetchAffiliateData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchAffiliateData() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });
    try {
      final data = await ref.read(adminServiceProvider).getAffiliates();
      setState(() {
        _affiliateData = data;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _triggerSync() async {
    setState(() => _isLoading = true);
    try {
      final res = await ref.read(adminServiceProvider).syncAffiliates();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Sync complete: ${res['conversionsDetected']} conversions, ${res['rewardsGenerated']} rewards generated.')),
      );
      await _fetchAffiliateData();
    } catch (e) {
      setState(() => _isLoading = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Sync failed: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final affiliates = _affiliateData['affiliates'] as List<dynamic>? ?? [];
    final referrals = _affiliateData['referrals'] as List<dynamic>? ?? [];
    final rewards = _affiliateData['rewards'] as List<dynamic>? ?? [];
    final config = _affiliateData['config'] as Map<String, dynamic>? ?? {};

    final totalReferrals = referrals.length;
    final totalConversions = referrals.where((r) => r['status'] == 'subscribed').length;
    final pendingRewards = rewards.where((rw) => rw['status'] == 'pending');
    final pendingPayout = pendingRewards.fold<double>(0, (sum, rw) => sum + (rw['amount'] as num? ?? 0));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Affiliate Management'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.sync_outlined),
            onPressed: _triggerSync,
            tooltip: 'Sync conversions & rewards',
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchAffiliateData,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Partners'),
            Tab(text: 'Referrals'),
            Tab(text: 'Rewards'),
          ],
        ),
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
                          Text('Error loading affiliate info: $_error', style: const TextStyle(color: AppColors.danger)),
                          const SizedBox(height: 16),
                          AppButton(label: 'Retry', onPressed: _fetchAffiliateData),
                        ],
                      ),
                    ),
                  )
                : Column(
                    children: [
                      // Overview / Config header
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Container(
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
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text('Affiliate Settings', style: AppTypography.nameLg.copyWith(fontSize: 16)),
                                  IconButton(
                                    icon: Icon(Icons.edit_outlined, color: AppColors.primary, size: 20),
                                    onPressed: () => _showConfigSheet(context, config),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  _Stat(label: 'Referred Tenants', value: '$totalReferrals'),
                                  _Stat(label: 'Subscribed (Paid)', value: '$totalConversions'),
                                  _Stat(label: 'Pending Payout', value: '₹${pendingPayout.toStringAsFixed(0)}'),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),

                      // Tabs view
                      Expanded(
                        child: TabBarView(
                          controller: _tabController,
                          children: [
                            // Partners tab
                            _buildPartnersList(affiliates),
                            // Referrals tab
                            _buildReferralsList(referrals, affiliates),
                            // Rewards tab
                            _buildRewardsList(rewards, affiliates),
                          ],
                        ),
                      ),
                    ],
                  ),
      ),
    );
  }

  Widget _buildPartnersList(List<dynamic> partners) {
    if (partners.isEmpty) {
      return const Center(child: Text('No affiliate partners registered yet.'));
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: partners.length,
      itemBuilder: (context, index) {
        final p = partners[index];
        final status = p['status'] as String? ?? 'active';
        final isActive = status == 'active';
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppTokens.radius),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(p['name'] as String? ?? 'Affiliate Partner', style: AppTypography.nameLg.copyWith(fontSize: 14)),
                    const SizedBox(height: 2),
                    Text('Code: ${p['code']} · Phone: ${p['phone']}', style: AppTypography.caption),
                    Text('Email: ${p['email']}', style: AppTypography.caption),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isActive ? AppColors.successBg : AppColors.border,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  status.toUpperCase(),
                  style: AppTypography.tiny.copyWith(
                    color: isActive ? AppColors.success : AppColors.textSecondary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildReferralsList(List<dynamic> referrals, List<dynamic> partners) {
    if (referrals.isEmpty) {
      return const Center(child: Text('No referrals tracked yet.'));
    }
    final partnerMap = {for (var p in partners) p['id'] as String: p['name'] as String};
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: referrals.length,
      itemBuilder: (context, index) {
        final r = referrals[index];
        final partnerName = partnerMap[r['affiliateId']] ?? 'Unknown Partner';
        final status = r['status'] as String? ?? 'signup';
        final isSub = status == 'subscribed';

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppTokens.radius),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Referred: ${r['referredEmail']}', style: AppTypography.nameLg.copyWith(fontSize: 14)),
                    const SizedBox(height: 2),
                    Text('Affiliate: $partnerName', style: AppTypography.caption),
                    if (isSub) ...[
                      Text('Subscribed Plan: ${r['planTerm']} (₹${r['monthlyPrice']}/mo)', style: AppTypography.caption),
                      if (r['subscribedAt'] != null) Text('Date: ${r['subscribedAt'].split('T')[0]}', style: AppTypography.caption),
                    ],
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isSub ? AppColors.successBg : AppColors.warningBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  status.toUpperCase(),
                  style: AppTypography.tiny.copyWith(
                    color: isSub ? AppColors.success : AppColors.warning,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildRewardsList(List<dynamic> rewards, List<dynamic> partners) {
    if (rewards.isEmpty) {
      return const Center(child: Text('No rewards generated yet.'));
    }
    final partnerMap = {for (var p in partners) p['id'] as String: p['name'] as String};
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: rewards.length,
      itemBuilder: (context, index) {
        final rw = Map<String, dynamic>.from(rewards[index] as Map);
        final partnerName = partnerMap[rw['affiliateId']] ?? 'Unknown Partner';
        final type = rw['type'] as String? ?? 'commission_5mo';
        final status = rw['status'] as String? ?? 'pending';
        final isPaid = status == 'paid';

        return InkWell(
          onTap: isPaid ? null : () => _showRewardPayoutSheet(context, rw, partnerName),
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppTokens.radius),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(partnerName, style: AppTypography.nameLg.copyWith(fontSize: 14)),
                      const SizedBox(height: 2),
                      Text('Type: ${type == 'free_year' ? 'Free Year Subscription' : '5-Month Commission'}', style: AppTypography.caption),
                      Text('Reward Amount: ₹${rw['amount']}', style: AppTypography.caption.copyWith(fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isPaid ? AppColors.successBg : AppColors.warningBg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    status.toUpperCase(),
                    style: AppTypography.tiny.copyWith(
                      color: isPaid ? AppColors.success : AppColors.warning,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showRewardPayoutSheet(BuildContext context, Map<String, dynamic> reward, String partnerName) {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Process Reward Payout', style: AppTypography.sectionTitle),
              const SizedBox(height: 8),
              Text('Partner: $partnerName · Amount: ₹${reward['amount']}', style: AppTypography.caption),
              const SizedBox(height: 20),
              ListTile(
                leading: const Icon(Icons.check_circle_outline, color: AppColors.success),
                title: const Text('Mark as PAID'),
                onTap: () async {
                  final messenger = ScaffoldMessenger.of(this.context);
                  Navigator.pop(context);
                  setState(() => _isLoading = true);
                  try {
                    await ref.read(adminServiceProvider).updateAffiliateReward(
                          reward['id'] as String,
                          'paid',
                        );
                    await _fetchAffiliateData();
                  } catch (e) {
                    setState(() => _isLoading = false);
                    if (!mounted) return;
                    messenger.showSnackBar(
                      SnackBar(content: Text('Failed: $e')),
                    );
                  }
                },
              ),
              ListTile(
                leading: Icon(Icons.done_all, color: AppColors.primary),
                title: const Text('Mark as GRANTED'),
                onTap: () async {
                  final messenger = ScaffoldMessenger.of(this.context);
                  Navigator.pop(context);
                  setState(() => _isLoading = true);
                  try {
                    await ref.read(adminServiceProvider).updateAffiliateReward(
                          reward['id'] as String,
                          'granted',
                        );
                    await _fetchAffiliateData();
                  } catch (e) {
                    setState(() => _isLoading = false);
                    if (!mounted) return;
                    messenger.showSnackBar(
                      SnackBar(content: Text('Failed: $e')),
                    );
                  }
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showConfigSheet(BuildContext context, Map<String, dynamic> config) {
    final thresholdCtrl = TextEditingController(text: (config['threshold'] ?? 10).toString());
    final rateCtrl = TextEditingController(text: (config['monthlyCommissionRate'] ?? 0.3).toString());
    final commissionCtrl = TextEditingController(text: (config['monthlyCommissionMonths'] ?? 5).toString());
    final freeCtrl = TextEditingController(text: (config['yearlyRewardFreeMonths'] ?? 12).toString());

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Update Global Affiliate Rules', style: AppTypography.sectionTitle),
              const SizedBox(height: 16),
              TextField(
                controller: thresholdCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Threshold (Paid Signups to Unlock Cohort) *', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: rateCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Monthly Commission Rate (e.g. 0.30 for 30%) *', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: commissionCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Commission Payout Duration (Months) *', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: freeCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Yearly Free Benefit Duration (Months) *', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 16),
              AppButton(
                label: 'Save Configuration Settings',
                onPressed: () async {
                  final th = double.tryParse(thresholdCtrl.text) ?? 10;
                  final rt = double.tryParse(rateCtrl.text) ?? 0.3;
                  final cm = double.tryParse(commissionCtrl.text) ?? 5;
                  final fr = double.tryParse(freeCtrl.text) ?? 12;

                  final messenger = ScaffoldMessenger.of(this.context);
                  Navigator.pop(context);
                  setState(() => _isLoading = true);

                  try {
                    await ref.read(adminServiceProvider).saveAffiliateConfig(
                          threshold: th,
                          monthlyCommissionRate: rt,
                          monthlyCommissionMonths: cm,
                          yearlyRewardFreeMonths: fr,
                        );
                    await _fetchAffiliateData();
                  } catch (e) {
                    setState(() => _isLoading = false);
                    if (!mounted) return;
                    messenger.showSnackBar(
                      SnackBar(content: Text('Failed: $e')),
                    );
                  }
                },
              ),
            ],
          ),
        );
      },
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value, style: AppTypography.nameLg.copyWith(fontSize: 18, color: AppColors.primary)),
        const SizedBox(height: 2),
        Text(label, style: AppTypography.caption),
      ],
    );
  }
}
