import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'package:zolofund/core/theme/app_colors.dart';

const _kPrefsBox = 'prefs';
const _kSeenKey = 'onboarding_seen_v1';

/// First-run onboarding (U1): role-aware 3–4 page intro shown once after
/// first login. Trigger with [maybeShowOnboarding] from the dashboard's
/// first frame — it no-ops when already seen, so it is safe to call every
/// time the dashboard mounts.
Future<void> maybeShowOnboarding(
  BuildContext context, {
  required String role,
}) async {
  final box = Hive.isBoxOpen(_kPrefsBox)
      ? Hive.box<dynamic>(_kPrefsBox)
      : await Hive.openBox<dynamic>(_kPrefsBox);
  final seen = (box.get(_kSeenKey) as bool?) ?? false;
  if (seen) return;
  if (!context.mounted) return;

  await showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _OnboardingDialog(role: role),
  );
  await box.put(_kSeenKey, true);
}

/// Re-show the tour on demand (e.g. from a Help menu entry).
Future<void> showOnboardingAgain(
  BuildContext context, {
  required String role,
}) async {
  await showDialog<void>(
    context: context,
    builder: (_) => _OnboardingDialog(role: role),
  );
}

class _Page {
  const _Page(this.icon, this.title, this.body);
  final IconData icon;
  final String title;
  final String body;
}

class _OnboardingDialog extends ConsumerStatefulWidget {
  const _OnboardingDialog({required this.role});
  final String role;

  @override
  ConsumerState<_OnboardingDialog> createState() => _OnboardingDialogState();
}

class _OnboardingDialogState extends ConsumerState<_OnboardingDialog> {
  final _controller = PageController();
  int _page = 0;

  List<_Page> get _pages {
    final isAgent = widget.role == 'agent';
    if (isAgent) {
      return const [
        _Page(
          Icons.qr_code_scanner,
          'Find the customer fast',
          'Scan the customer QR card, or search by name on the Customers tab.',
        ),
        _Page(
          Icons.payments_outlined,
          'Collect in 3 taps',
          'Open Collection, tap the due row, confirm the amount. GPS is stamped automatically.',
        ),
        _Page(
          Icons.cloud_off_outlined,
          'Works without network',
          'No signal? Entries queue on your phone and sync automatically when you are back online. Check Sync Status anytime.',
        ),
        _Page(
          Icons.record_voice_over_outlined,
          'Voice guidance',
          'Turn on Voice Assist in Settings to hear confirmations read aloud in your language.',
        ),
      ];
    }
    return const [
      _Page(
        Icons.dashboard_outlined,
        'Your day at a glance',
        'The dashboard shows today\'s collections, disbursals and pending approvals.',
      ),
      _Page(
        Icons.fact_check_outlined,
        'Approve on the go',
        'Approvals and KYC reviews are under More. Pending counts appear as badges.',
      ),
      _Page(
        Icons.map_outlined,
        'Track your field team',
        'Live Tracking under More shows every agent on the map with today\'s collections.',
      ),
      _Page(
        Icons.grid_view_rounded,
        'Everything else lives in More',
        'Reports, accounting, NPA monitoring, penalties and settings are grouped in the More tab.',
      ),
    ];
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pages = _pages;
    final last = _page == pages.length - 1;
    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: SizedBox(
        height: 380,
        child: Column(
          children: [
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: pages.length,
                onPageChanged: (i) => setState(() => _page = i),
                itemBuilder: (_, i) {
                  final p = pages[i];
                  return Padding(
                    padding: const EdgeInsets.all(28),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(p.icon, size: 64, color: AppColors.primary),
                        const SizedBox(height: 20),
                        Text(
                          p.title,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          p.body,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey.shade600,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(pages.length, (i) {
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: i == _page ? 18 : 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color:
                        i == _page ? AppColors.primary : Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(4),
                  ),
                );
              }),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Skip'),
                  ),
                  const Spacer(),
                  FilledButton(
                    onPressed: () {
                      if (last) {
                        Navigator.of(context).pop();
                      } else {
                        _controller.nextPage(
                          duration: const Duration(milliseconds: 250),
                          curve: Curves.easeOut,
                        );
                      }
                    },
                    child: Text(last ? 'Get started' : 'Next'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
