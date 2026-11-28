import 'package:flutter/material.dart';
import 'package:flutter_contacts/flutter_contacts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/services/chit_service.dart';

String normalizeIndianPhoneNumber(String raw) {
  final digits = raw.replaceAll(RegExp(r'\D'), '');
  if (digits.length == 12 && digits.startsWith('91')) {
    return digits.substring(2);
  }
  if (digits.length == 11 && digits.startsWith('0')) {
    return digits.substring(1);
  }
  if (digits.length > 10) {
    return digits.substring(digits.length - 10);
  }
  return digits;
}

class ContactQuickAddSheet extends ConsumerStatefulWidget {
  const ContactQuickAddSheet({
    super.key,
    required this.groupId,
    required this.onAdded,
  });

  final String groupId;
  final VoidCallback onAdded;

  @override
  ConsumerState<ContactQuickAddSheet> createState() =>
      _ContactQuickAddSheetState();
}

class _ContactQuickAddSheetState extends ConsumerState<ContactQuickAddSheet> {
  bool _loadingContacts = false;
  bool _permissionDenied = false;
  bool _saving = false;
  String? _error;
  String _search = '';
  List<Contact> _contacts = const [];
  final Map<String, ({String name, String phone})> _selected = {};

  final _manualNameCtrl = TextEditingController();
  final _manualPhoneCtrl = TextEditingController();
  final _manualTicketCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadContacts();
  }

  @override
  void dispose() {
    _manualNameCtrl.dispose();
    _manualPhoneCtrl.dispose();
    _manualTicketCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadContacts() async {
    setState(() {
      _loadingContacts = true;
      _permissionDenied = false;
    });
    try {
      final granted = await FlutterContacts.requestPermission(readonly: true);
      if (!granted) {
        if (mounted) {
          setState(() {
            _permissionDenied = true;
            _loadingContacts = false;
          });
        }
        return;
      }
      final list = await FlutterContacts.getContacts(withProperties: true);
      final withPhones = list.where((c) => c.phones.isNotEmpty).toList();
      if (mounted) {
        setState(() {
          _contacts = withPhones;
          _loadingContacts = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _permissionDenied = true;
          _loadingContacts = false;
        });
      }
    }
  }

  Future<void> _submitSelected() async {
    if (_selected.isEmpty) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final entries = _selected.values
          .map((e) => <String, dynamic>{
                'fullName': e.name,
                'phone': normalizeIndianPhoneNumber(e.phone),
              })
          .toList(growable: false);
      await ref
          .read(chitServiceProvider)
          .quickAddMembers(widget.groupId, entries);
      if (mounted) {
        Navigator.pop(context);
        widget.onAdded();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _saving = false;
        });
      }
    }
  }

  Future<void> _submitManual() async {
    final name = _manualNameCtrl.text.trim();
    final phone = normalizeIndianPhoneNumber(_manualPhoneCtrl.text.trim());
    if (name.isEmpty || phone.length < 10) {
      setState(() => _error = 'Enter full name and valid 10-digit phone.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(chitServiceProvider).quickAddMembers(widget.groupId, [
        <String, dynamic>{
          'fullName': name,
          'phone': phone,
          if (_manualTicketCtrl.text.trim().isNotEmpty)
            'ticketNo': _manualTicketCtrl.text.trim(),
        }
      ]);
      if (mounted) {
        Navigator.pop(context);
        widget.onAdded();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _saving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = _search.trim().toLowerCase();
    final filtered = q.isEmpty
        ? _contacts
        : _contacts.where((c) {
            final phone = c.phones.isNotEmpty ? c.phones.first.number : '';
            return c.displayName.toLowerCase().contains(q) ||
                phone.contains(q);
          }).toList(growable: false);

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          16,
          16,
          16,
          MediaQuery.of(context).viewInsets.bottom + 16,
        ),
        child: SizedBox(
          height: MediaQuery.of(context).size.height * 0.78,
          child: DefaultTabController(
            length: 2,
            initialIndex: _permissionDenied ? 1 : 0,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Quick-Add Members',
                        style: AppTypography.sectionTitle,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
                const TabBar(
                  tabs: [
                    Tab(text: 'Phone Contacts'),
                    Tab(text: 'Manual Quick-Add'),
                  ],
                ),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    _error!,
                    style: AppTypography.caption.copyWith(color: AppColors.danger),
                  ),
                ],
                const SizedBox(height: 10),
                Expanded(
                  child: TabBarView(
                    children: [
                      // Tab 1: Phonebook multi-select
                      Column(
                        children: [
                          if (_permissionDenied)
                            Container(
                              padding: const EdgeInsets.all(12),
                              margin: const EdgeInsets.only(bottom: 10),
                              decoration: BoxDecoration(
                                color: AppColors.dangerBg,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.contacts_outlined,
                                      color: AppColors.danger,),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      'Contacts permission was denied. Enable Contacts access in Settings or use Manual Quick-Add.',
                                      style: AppTypography.caption,
                                    ),
                                  ),
                                  TextButton(
                                    onPressed: _loadContacts,
                                    child: const Text('Retry'),
                                  ),
                                ],
                              ),
                            )
                          else ...[
                            TextField(
                              decoration: const InputDecoration(
                                prefixIcon: Icon(Icons.search),
                                labelText: 'Search contacts by name or phone',
                                isDense: true,
                                border: OutlineInputBorder(),
                              ),
                              onChanged: (v) => setState(() => _search = v),
                            ),
                            const SizedBox(height: 8),
                          ],
                          Expanded(
                            child: _loadingContacts
                                ? const Center(child: CircularProgressIndicator())
                                : filtered.isEmpty
                                    ? Center(
                                        child: Text(
                                          'No phone contacts found',
                                          style: AppTypography.caption,
                                        ),
                                      )
                                    : ListView.builder(
                                        itemCount: filtered.length,
                                        itemBuilder: (_, idx) {
                                          final c = filtered[idx];
                                          final rawPhone = c.phones.first.number;
                                          final norm =
                                              normalizeIndianPhoneNumber(rawPhone);
                                          final checked =
                                              _selected.containsKey(c.id);
                                          return CheckboxListTile(
                                            value: checked,
                                            dense: true,
                                            title: Text(c.displayName),
                                            subtitle: Text(
                                                '$rawPhone  ->  +91 $norm',),
                                            onChanged: (val) {
                                              setState(() {
                                                if (val == true) {
                                                  _selected[c.id] = (
                                                    name: c.displayName,
                                                    phone: norm,
                                                  );
                                                } else {
                                                  _selected.remove(c.id);
                                                }
                                              });
                                            },
                                          );
                                        },
                                      ),
                          ),
                          const SizedBox(height: 8),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: (_selected.isEmpty || _saving)
                                  ? null
                                  : _submitSelected,
                              child: Text(
                                _saving
                                    ? 'Adding...'
                                    : 'Add ${_selected.length} Selected Contact(s)',
                              ),
                            ),
                          ),
                        ],
                      ),
                      // Tab 2: Manual Name + Phone
                      SingleChildScrollView(
                        child: Column(
                          children: [
                            TextField(
                              controller: _manualNameCtrl,
                              decoration: const InputDecoration(
                                labelText: 'Full Name *',
                                border: OutlineInputBorder(),
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: _manualPhoneCtrl,
                              keyboardType: TextInputType.phone,
                              decoration: const InputDecoration(
                                labelText: 'Phone Number (+91) *',
                                border: OutlineInputBorder(),
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: _manualTicketCtrl,
                              decoration: const InputDecoration(
                                labelText: 'Ticket No (Optional)',
                                border: OutlineInputBorder(),
                              ),
                            ),
                            const SizedBox(height: 16),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                onPressed: _saving ? null : _submitManual,
                                child: Text(
                                  _saving ? 'Adding...' : 'Quick-Add Member',
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
