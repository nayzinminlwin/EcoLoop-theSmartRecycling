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

  @override
  Future<AuthState> getAuthState() => _api.read(
    'account.getAuthState',
    () => const AuthState(
      uid: 'RES-000842',
      role: AppRole.user,
      isSignedIn: true,
    ),
  );

  @override
  Stream<AuthState> watchAuthState() async* {
    await Future<void>.delayed(_api.readDelay);
    yield await getAuthState();
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
    await Future<void>.delayed(_api.readDelay);
    yield await getProfile();
    if (_store != null) {
      await for (final json in _store.watchProfile()) {
        yield ResidentProfile.fromJson(json);
      }
    }
  }
}
