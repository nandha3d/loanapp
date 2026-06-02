import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/wallet.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

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
}

final walletServiceProvider =
    Provider<WalletService>((ref) => WalletService(ref.watch(dioProvider)));

final walletMeProvider = FutureProvider.autoDispose<WalletMe>(
  (ref) => ref.watch(walletServiceProvider).me(),
);

final walletAgentsProvider = FutureProvider.autoDispose<List<AgentWallet>>(
  (ref) => ref.watch(walletServiceProvider).agents(),
);
