import 'dart:async';

import '../data/app_failure.dart';
import 'app_clock.dart';

class MockDataStore {
  MockDataStore({
    required Map<String, Object?> profile,
    required Map<String, Object?> wallet,
    required List<Map<String, Object?>> deposits,
    AppClock? clock,
  }) : _profile = Map<String, Object?>.from(profile),
       _wallet = Map<String, Object?>.from(wallet),
       _deposits = deposits.map(Map<String, Object?>.from).toList(),
       clock = clock ?? AppClock();

  final AppClock clock;
  Map<String, Object?> _profile;
  Map<String, Object?> _wallet;
  List<Map<String, Object?>> _deposits;
  final _profileChanges = StreamController<Map<String, Object?>>.broadcast();
  final _walletChanges = StreamController<Map<String, Object?>>.broadcast();
  final _depositChanges =
      StreamController<List<Map<String, Object?>>>.broadcast();

  Map<String, Object?> get profile => Map<String, Object?>.from(_profile);
  Map<String, Object?> get wallet => Map<String, Object?>.from(_wallet);
  List<Map<String, Object?>> get deposits =>
      _deposits.map(Map<String, Object?>.from).toList(growable: false);

  Stream<Map<String, Object?>> watchProfile() =>
      _profileChanges.stream.map(Map<String, Object?>.from);
  Stream<Map<String, Object?>> watchWallet() =>
      _walletChanges.stream.map(Map<String, Object?>.from);
  Stream<List<Map<String, Object?>>> watchDeposits() => _depositChanges.stream
      .map((items) => items.map(Map<String, Object?>.from).toList());

  void updateProfile(Map<String, Object?> value) {
    _profile = Map<String, Object?>.from(value);
    _profileChanges.add(profile);
  }

  void updateWallet(Map<String, Object?> value) {
    _wallet = Map<String, Object?>.from(value);
    _walletChanges.add(wallet);
  }

  void replaceDeposits(List<Map<String, Object?>> value) {
    _deposits = value.map(Map<String, Object?>.from).toList();
    _depositChanges.add(deposits);
  }

  Future<T> transaction<T>(
    T Function(
      Map<String, Object?> profile,
      Map<String, Object?> wallet,
      List<Map<String, Object?>> deposits,
    )
    action,
  ) async {
    final oldProfile = profile;
    final oldWallet = wallet;
    final oldDeposits = deposits;
    try {
      final workingProfile = Map<String, Object?>.from(_profile);
      final workingWallet = Map<String, Object?>.from(_wallet);
      final workingDeposits = _deposits.map(Map<String, Object?>.from).toList();
      final result = action(workingProfile, workingWallet, workingDeposits);
      _profile = workingProfile;
      _wallet = workingWallet;
      _deposits = workingDeposits;
      _profileChanges.add(profile);
      _walletChanges.add(wallet);
      _depositChanges.add(deposits);
      return result;
    } on Object {
      _profile = oldProfile;
      _wallet = oldWallet;
      _deposits = oldDeposits;
      rethrow;
    }
  }

  void dispose() {
    _profileChanges.close();
    _walletChanges.close();
    _depositChanges.close();
  }

  static AppFailure notFound(String entity) => AppFailure(
    code: AppFailureCodes.notFound,
    messageKey: 'mock.$entity.notFound',
    retryable: false,
  );
}
