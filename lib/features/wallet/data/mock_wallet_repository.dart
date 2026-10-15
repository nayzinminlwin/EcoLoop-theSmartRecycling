// ignore_for_file: prefer_initializing_formals

import 'dart:async';

import 'package:eco_loop/core/data/json_readers.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_data_store.dart';
import 'package:eco_loop/core/mock/mock_seed_loader.dart';

import '../domain/models/wallet_snapshot.dart';
import '../domain/repositories/wallet_repository.dart';

class MockWalletRepository implements WalletRepository {
  MockWalletRepository({
    MockDataStore? store,
    MockApi? api,
    MockSeedLoader? loader,
  }) : _store = store,
       _api = api ?? MockApi(),
       _loader = loader ?? const MockSeedLoader();

  final MockDataStore? _store;
  final MockApi _api;
  final MockSeedLoader _loader;

  Future<WalletSnapshot> _readWallet() async {
    final envelope = _store == null
        ? await _loader.loadMap('assets/mock/wallet/wallet.json')
        : _store.wallet.containsKey('wallet')
            ? _store.wallet
            : {
                'wallet': _store.wallet,
                'rewardCosts': const [100, 200, 350, 500],
              };
    final document = WalletDocument.fromJson(
      JsonReaders.map(envelope['wallet'], 'wallet'),
    );
    final costs = (envelope['rewardCosts'] as List).whereType<num>().map(
      (e) => e.toInt(),
    );
    int? next;
    for (final cost in costs) {
      if (cost > document.balance) {
        next = cost;
        break;
      }
    }
    return WalletSnapshot(
      residentId: document.residentId,
      balance: document.balance,
      nextRewardCost: next,
      updatedAt: document.updatedAt,
      version: document.version,
    );
  }

  @override
  Future<WalletSnapshot> getWallet() =>
      _api.read('wallet.getWallet', _readWallet);

  @override
  Stream<WalletSnapshot?> watchWallet() async* {
    await Future<void>.delayed(_api.readDelay);
    yield await getWallet();
    if (_store != null) {
      await for (final _ in _store.watchWallet()) {
        yield await getWallet();
      }
    }
  }
}
