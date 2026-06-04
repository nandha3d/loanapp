import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/services/admin_service.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class AdminRequestsScreen extends ConsumerStatefulWidget {
  const AdminRequestsScreen({
    super.key,
    this.isModuleOnly = false,
    this.canReview = false,
  });

  final bool isModuleOnly;
  final bool canReview;

  @override
  ConsumerState<AdminRequestsScreen> createState() =>
      _AdminRequestsScreenState();
}

class _AdminRequestsScreenState extends ConsumerState<AdminRequestsScreen> {
  bool _isLoading = true;
  String _error = '';
  List<Map<String, dynamic>> _requests = [];

  @override
  void initState() {
    super.initState();
    _fetchRequests();
  }

  Future<void> _fetchRequests() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });
    try {
      final res = await ref.read(adminServiceProvider).getRequests();
      final List<dynamic> list = widget.isModuleOnly
          ? (res['moduleRequests'] as List<dynamic>? ?? [])
          : (res['branchRequests'] as List<dynamic>? ?? []);
      setState(() {
        _requests = list
            .map((dynamic e) => Map<String, dynamic>.from(e as Map))
            .toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _reviewRequest(
    String id,
    String decision, [
    String? note,
  ]) async {
    if (!widget.canReview) return;

    setState(() => _isLoading = true);
    try {
      await ref.read(adminServiceProvider).reviewRequest(
            requestType: widget.isModuleOnly ? 'module' : 'branch',
            requestId: id,
            decision: decision,
            reviewNote: note ??
                (decision == 'approved'
                    ? 'Approved via mobile'
                    : 'Rejected via mobile'),
          );
      await _fetchRequests();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Request $decision successfully')),
      );
    } catch (e) {
      setState(() => _isLoading = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Action failed: $e')),
      );
    }
  }

  void _promptRejectDialog(String id) {
    final noteController = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Reject Request'),
          content: TextField(
            controller: noteController,
            decoration: const InputDecoration(
              labelText: 'Rejection Reason / Note *',
              border: OutlineInputBorder(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () {
                final reason = noteController.text.trim();
                if (reason.isEmpty) return;
                Navigator.pop(context);
                _reviewRequest(id, 'rejected', reason);
              },
              child: const Text(
                'Reject',
                style: TextStyle(color: AppColors.danger),
              ),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          widget.canReview
              ? (widget.isModuleOnly
                  ? 'Review Module Requests'
                  : 'Review Branch Requests')
              : (widget.isModuleOnly ? 'Module Requests' : 'Branch Requests'),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchRequests,
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
                          Text(
                            'Error loading requests: $_error',
                            style: const TextStyle(color: AppColors.danger),
                          ),
                          const SizedBox(height: 16),
                          AppButton(label: 'Retry', onPressed: _fetchRequests),
                        ],
                      ),
                    ),
                  )
                : _requests.isEmpty
                    ? const Center(child: Text('No requests found.'))
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _requests.length,
                        itemBuilder: (context, index) {
                          final req = _requests[index];
                          final id = req['id'] as String;
                          final status = req['status'] as String? ?? 'pending';
                          final date = req['createdAt'] as String? ?? '';
                          final displayDate =
                              date.isNotEmpty ? date.split('T')[0] : '';
                          final isPending = status == 'pending';

                          String title = '';
                          String description = '';
                          if (widget.isModuleOnly) {
                            final module = req['appType'] as String? ?? 'N/A';
                            title =
                                'Module Request: ${module.replaceAll('_', ' ').toUpperCase()}';
                            description = req['reason'] as String? ??
                                'No reason provided';
                          } else {
                            final branchName =
                                req['branchName'] as String? ?? 'New Branch';
                            title = 'Branch Expansion: $branchName';
                            description =
                                'Requested modules: ${req['requestedModules']}\nReason: ${req['reason'] ?? 'None'}';
                          }

                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            padding: const EdgeInsets.all(18),
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius:
                                  BorderRadius.circular(AppTokens.radius),
                              boxShadow: AppTokens.shadow,
                              border:
                                  Border.all(color: AppColors.border, width: 1),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        title,
                                        style: AppTypography.nameLg
                                            .copyWith(fontSize: 16),
                                      ),
                                    ),
                                    Text(
                                      displayDate,
                                      style: AppTypography.caption,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Tenant: ${req['tenantName'] ?? 'N/A'} (By ${req['requestedBy'] ?? 'Superadmin'})',
                                  style: AppTypography.caption.copyWith(
                                    color: AppColors.primary,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const Divider(height: 24),
                                Text(description, style: AppTypography.body),
                                if (!isPending) ...[
                                  const SizedBox(height: 8),
                                  Text(
                                    'Status: ${status.toUpperCase()} · Note: ${req['reviewNote'] ?? 'None'}',
                                    style: AppTypography.caption.copyWith(
                                      color: status == 'approved'
                                          ? AppColors.success
                                          : AppColors.danger,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                                if (isPending && widget.canReview) ...[
                                  const SizedBox(height: 16),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.end,
                                    children: [
                                      TextButton(
                                        onPressed: () =>
                                            _promptRejectDialog(id),
                                        child: const Text(
                                          'Reject',
                                          style: TextStyle(
                                            color: AppColors.danger,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      AppButton(
                                        size: AppButtonSize.small,
                                        label: 'Approve',
                                        onPressed: () =>
                                            _reviewRequest(id, 'approved'),
                                      ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
