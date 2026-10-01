import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/data/models/wallet.dart';
import 'package:zolofund/shared/constants/endpoints.dart';

class WalletService {
  WalletService(this._dio);
  final Dio _dio;

  Future<WalletMe> me() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.walletMe);
    return unwrapEnvelope(
      res,
      (dynamic d) => WalletMe.fromJson(d as Map<String, dynamic>),
    );
  }

  Future<List<AgentWallet>> agents() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.walletAgents);
    return unwrapEnvelope(
      res,
      (dynamic d) => (d as List<dynamic>)
          .map((dynamic e) => AgentWallet.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
    );
  }

  Future<void> release({
    required String agentId,
    required double amount,
    String? note,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.walletRelease,
      data: {
        'agentId': agentId,
        'amount': amount,
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
    unwrapEnvelope(res, (_) => null);
  }

  Future<List<BranchPool>> branches() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.walletBranch);
    return unwrapEnvelope(
      res,
      (dynamic d) => (d as List<dynamic>)
          .map((dynamic e) => BranchPool.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
    );
  }

  Future<void> injectBranch({
    required String branchId,
    required double amount,
    String? note,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.walletBranch,
      data: {
        'branchId': branchId,
        'amount': amount,
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
    unwrapEnvelope(res, (_) => null);
  }

  Future<WalletSummary> summary() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.walletSummary);
    return unwrapEnvelope(res, (dynamic d) => WalletSummary.fromJson(d as Map<String, dynamic>));
  }

  Future<List<CashHandover>> handovers({String? status}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.walletHandovers,
      queryParameters: {if (status != null) 'status': status},
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => (d as List<dynamic>)
          .map((dynamic e) => CashHandover.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
    );
  }

  /// [action] = collect | reject.
  Future<void> handoverAction(String id, String action) async {
    final res = await _dio.post<Map<String, dynamic>>(Endpoints.walletHandoverAction(id, action));
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> collectFromAgent({required String agentId, required double amount, String? note}) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.walletCollect,
      data: {'agentId': agentId, 'amount': amount, if (note != null && note.isNotEmpty) 'note': note},
    );
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> deposit({required double amount, String? note}) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.walletDeposit,
      data: {
        'amount': amount,
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
    unwrapEnvelope(res, (_) => null);
  }
}

final walletServiceProvider =
    Provider<WalletService>((ref) => WalletService(ref.watch(dioProvider)));

final walletMeProvider = FutureProvider.autoDispose<WalletMe>(
  (ref) => ref.watch(walletServiceProvider).me(),
);

final walletAgentsProvider = FutureProvider.autoDispose<List<AgentWallet>>(
  (ref) => ref.watch(walletServiceProvider).agents(),
);

final walletSummaryProvider = FutureProvider.autoDispose<WalletSummary>(
  (ref) => ref.watch(walletServiceProvider).summary(),
);

/// Staff: pending queue. Agents: own history (server decides by role).
final walletHandoversProvider = FutureProvider.autoDispose.family<List<CashHandover>, String?>(
  (ref, status) => ref.watch(walletServiceProvider).handovers(status: status),
);

final walletBranchesProvider = FutureProvider.autoDispose<List<BranchPool>>(
  (ref) => ref.watch(walletServiceProvider).branches(),
);
