import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:loantrack/core/theme/app_colors.dart';

/// In-app contextual help (U5): a bottom sheet with 3–5 illustrated steps
/// per screen plus a contact-support action. Static content — works offline.
///
/// Usage:
///   IconButton(
///     icon: const Icon(Icons.help_outline),
///     onPressed: () => showHelpSheet(context, HelpTopics.collection),
///   )
class HelpStep {
  const HelpStep(this.icon, this.title, this.body);
  final IconData icon;
  final String title;
  final String body;
}

class HelpTopic {
  const HelpTopic(this.title, this.steps);
  final String title;
  final List<HelpStep> steps;
}

abstract final class HelpTopics {
  static const collection = HelpTopic('How to collect', [
    HelpStep(
      Icons.search,
      'Find the customer',
      'Search by name or scan their QR card from the Collection tab.',
    ),
    HelpStep(
      Icons.payments_outlined,
      'Enter the amount',
      'Tap the due instalment, confirm or edit the amount, choose cash or UPI.',
    ),
    HelpStep(
      Icons.location_on_outlined,
      'GPS is automatic',
      'Your location is stamped on the entry. Stand near the customer when collecting.',
    ),
    HelpStep(
      Icons.cloud_done_outlined,
      'Sync',
      'Entries upload instantly online. Offline entries queue and sync later — check Sync Status under More.',
    ),
  ]);

  static const loans = HelpTopic('Loans', [
    HelpStep(
      Icons.add_circle_outline,
      'New loan',
      'Tap + on the Loans tab. Pick customer, amount, tenure — the schedule previews instantly.',
    ),
    HelpStep(
      Icons.visibility_outlined,
      'Loan detail',
      'Tap any loan to see the schedule, penalties, statement PDF and actions.',
    ),
    HelpStep(
      Icons.offline_pin_outlined,
      'Close / pre-close',
      'Use the action menu on a loan to close, renew or foreclose with calculated charges.',
    ),
  ]);

  static const statuses = HelpTopic('What statuses mean', [
    HelpStep(
      Icons.check_circle_outline,
      'Verified',
      'GPS confirmed you were near the customer when collecting.',
    ),
    HelpStep(
      Icons.error_outline,
      'Mismatch',
      'Collection was recorded far from the customer\'s location — admin may review.',
    ),
    HelpStep(
      Icons.hourglass_empty,
      'Pending',
      'Entry is saved and waiting for sync or verification.',
    ),
    HelpStep(
      Icons.block_outlined,
      'Bounced',
      'An auto-debit (e-NACH) attempt failed at the bank. It retries automatically.',
    ),
  ]);
}

Future<void> showHelpSheet(
  BuildContext context,
  HelpTopic topic, {
  String? supportPhone,
}) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              topic.title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 14),
            ...topic.steps.map(
              (s) => Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(s.icon, size: 22, color: AppColors.primary),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            s.title,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            s.body,
                            style: TextStyle(
                              fontSize: 13,
                              height: 1.35,
                              color: Colors.grey.shade600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (supportPhone != null && supportPhone.isNotEmpty) ...[
              const Divider(),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading:
                    Icon(Icons.support_agent, color: AppColors.primary),
                title: const Text('Contact support'),
                subtitle: Text(supportPhone),
                onTap: () => launchUrl(Uri.parse('tel:$supportPhone')),
              ),
            ],
          ],
        ),
      ),
    ),
  );
}
