import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/data/models/customer.dart';
import 'package:loantrack/data/services/customer_service.dart';

class CustomerRepository {
  CustomerRepository(this._service);
  final CustomerService _service;

  Future<List<Customer>> list({String? query}) => _service.list(query: query);
  Future<Customer> getById(String id) => _service.getById(id);
  Future<Customer> create({
    required String name,
    required String phone,
    String? address,
    String? aadharNumber,
    String? routeId,
    String? agentId,
    String? photoUrl,
    List<KycDocInput> kycDocs = const [],
    Map<String, dynamic> extra = const {},
  }) =>
      _service.create(
        name: name,
        phone: phone,
        address: address,
        aadharNumber: aadharNumber,
        routeId: routeId,
        agentId: agentId,
        photoUrl: photoUrl,
        kycDocs: kycDocs,
        extra: extra,
      );
  Future<Customer> update(String id, Map<String, dynamic> patch) =>
      _service.update(id, patch);
  Future<List<int>> collectionReceiptPdf(String id) =>
      _service.collectionReceiptPdf(id);
}

final customerRepositoryProvider = Provider<CustomerRepository>(
  (ref) => CustomerRepository(ref.watch(customerServiceProvider)),
);

/// Filter state for the customer list screen.
class CustomerListFilter {
  const CustomerListFilter({this.query = '', this.status = 'all'});
  final String query;
  final String status; // all | active | pending_review | suspended

  CustomerListFilter copyWith({String? query, String? status}) =>
      CustomerListFilter(
        query: query ?? this.query,
        status: status ?? this.status,
      );
}

final customerFilterProvider =
    StateProvider<CustomerListFilter>((ref) => const CustomerListFilter());

final customerListProvider =
    FutureProvider.autoDispose<List<Customer>>((ref) async {
  final filter = ref.watch(customerFilterProvider);
  final all = await ref.watch(customerRepositoryProvider).list(
        query: filter.query.isEmpty ? null : filter.query,
      );
  if (filter.status == 'all') return all;
  return all.where((c) => c.status == filter.status).toList(growable: false);
});

final customerDetailProvider =
    FutureProvider.autoDispose.family<Customer, String>((ref, id) {
  return ref.watch(customerRepositoryProvider).getById(id);
});
