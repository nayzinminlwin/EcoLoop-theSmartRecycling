// ignore_for_file: prefer_initializing_formals

import 'dart:async';

import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_data_store.dart';
import 'package:eco_loop/core/mock/mock_seed_loader.dart';

import '../domain/models/auth_state.dart';
import '../domain/models/resident_profile.dart';
import '../domain/repositories/account_repository.dart';

class MockAccountRepository implements AccountRepository {
  MockAccountRepository({
    MockDataStore? store,
    MockApi? api,
    MockSeedLoader? loader,
  }) : _store = store,
       _api = api ?? MockApi(),
       _loader = loader ?? const MockSeedLoader();

  final MockDataStore? _store;
  final MockApi _api;
  final MockSeedLoader _loader;

  AuthState _readAuthState() =>
      const AuthState(uid: 'RES-000842', role: AppRole.user, isSignedIn: true);

  @override
  Future<AuthState> getAuthState() =>
      _api.read('account.getAuthState', _readAuthState);

  @override
  Stream<AuthState> watchAuthState() async* {
    yield await _api.read('account.watchAuthState', _readAuthState);
  }

  Future<ResidentProfile> _readProfile() async {
    final json =
        _store?.profile ??
        await _loader.loadMap('assets/mock/account/profile.json');
    return ResidentProfile.fromJson(json);
  }

  @override
  Future<ResidentProfile> getProfile() =>
      _api.read('account.getProfile', _readProfile);

  @override
  Stream<ResidentProfile?> watchProfile() async* {
    yield await _api.read('account.watchProfile', _readProfile);
    if (_store != null) {
      await for (final json in _store.watchProfile()) {
        yield ResidentProfile.fromJson(json);
      }
    }
  }
}
