import 'dart:async';

import '../data/app_failure.dart';
import 'app_clock.dart';

class MockDataStore {
  MockDataStore({
    required Map<String, Object?> profile,
    required Map<String, Object?> wallet,
    required List<Map<String, Object?>> deposits,
    AppClock? clock,
  }) : _profile = _copyMap(profile),
       _wallet = _copyMap(wallet),
       _deposits = deposits.map(_copyMap).toList(),
       clock = clock ?? AppClock();

  final AppClock clock;
  Map<String, Object?> _profile;
  Map<String, Object?> _wallet;
  List<Map<String, Object?>> _deposits;
  final _profileChanges = StreamController<Map<String, Object?>>.broadcast();
  final _walletChanges = StreamController<Map<String, Object?>>.broadcast();
  final _depositChanges =
      StreamController<List<Map<String, Object?>>>.broadcast();

  Map<String, Object?> get profile => _copyMap(_profile);
  Map<String, Object?> get wallet => _copyMap(_wallet);
  List<Map<String, Object?>> get deposits =>
      _deposits.map(_copyMap).toList(growable: false);

  Stream<Map<String, Object?>> watchProfile() =>
      _profileChanges.stream.map(_copyMap);
  Stream<Map<String, Object?>> watchWallet() =>
      _walletChanges.stream.map(_copyMap);
  Stream<List<Map<String, Object?>>> watchDeposits() => _depositChanges.stream
      .map((items) => items.map(_copyMap).toList(growable: false));

  void updateProfile(Map<String, Object?> value) {
    _profile = _copyMap(value);
    _profileChanges.add(profile);
  }

  void updateWallet(Map<String, Object?> value) {
    _wallet = _copyMap(value);
    _walletChanges.add(wallet);
  }

  void replaceDeposits(List<Map<String, Object?>> value) {
    _deposits = value.map(_copyMap).toList();
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
      final workingProfile = _copyMap(_profile);
      final workingWallet = _copyMap(_wallet);
      final workingDeposits = _deposits.map(_copyMap).toList();
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

  static Map<String, Object?> _copyMap(Map<String, Object?> value) =>
      value.map((key, item) => MapEntry(key, _copyValue(item)));

  static Object? _copyValue(Object? value) {
    if (value is Map) {
      return value.map(
        (key, item) => MapEntry(key.toString(), _copyValue(item)),
      );
    }
    if (value is List) {
      return value.map(_copyValue).toList(growable: false);
    }
    return value;
  }
}
