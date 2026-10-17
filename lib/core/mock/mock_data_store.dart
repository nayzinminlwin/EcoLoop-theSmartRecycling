import 'dart:async';

import '../data/app_failure.dart';
import 'app_clock.dart';

class MockDataStore {
  MockDataStore({
    required Map<String, Object?> profile,
    required Map<String, Object?> wallet,
    required List<Map<String, Object?>> deposits,
    Map<String, Object?>? security,
    Map<String, Object?>? notificationPreferences,
    Map<String, Object?>? session,
    Map<String, Object?>? metadata,
    List<Map<String, Object?>>? bins,
    List<Map<String, Object?>>? scanInstructions,
    List<Map<String, Object?>>? classifications,
    List<Map<String, Object?>>? sessions,
    List<Map<String, Object?>>? results,
    List<Map<String, Object?>>? rewardCategories,
    List<Map<String, Object?>>? rewards,
    List<Map<String, Object?>>? vouchers,
    List<Map<String, Object?>>? redemptions,
    String Function(String prefix, int sequence)? idFactory,
    this.mockCurrentPassword = 'DemoPass123!',
    AppClock? clock,
  }) : _profile = _copyMap(profile),
       _wallet = _copyMap(wallet),
       _deposits = deposits.map(_copyMap).toList(),
       _security = _copyMap(security ?? const {}),
       _notificationPreferences = _copyMap(notificationPreferences ?? const {}),
       _session = _copyMap(session ?? const {}),
       _metadata = _copyMap(metadata ?? const {}),
       _bins = _copyList(bins),
       _scanInstructions = _copyList(scanInstructions),
       _classifications = _copyList(classifications),
       _sessions = _copyList(sessions),
       _results = _copyList(results),
       _rewardCategories = _copyList(rewardCategories),
       _rewards = _copyList(rewards),
       _vouchers = _copyList(vouchers),
       _redemptions = _copyList(redemptions),
       _idFactory = idFactory ?? ((prefix, sequence) => '$prefix-$sequence'),
       clock = clock ?? AppClock();

  final AppClock clock;
  Map<String, Object?> _profile;
  Map<String, Object?> _wallet;
  List<Map<String, Object?>> _deposits;
  Map<String, Object?> _security;
  Map<String, Object?> _notificationPreferences;
  Map<String, Object?> _session;
  final Map<String, Object?> _metadata;
  final List<Map<String, Object?>> _bins;
  final List<Map<String, Object?>> _scanInstructions;
  final List<Map<String, Object?>> _classifications;
  final List<Map<String, Object?>> _sessions;
  final List<Map<String, Object?>> _results;
  final List<Map<String, Object?>> _rewardCategories;
  final List<Map<String, Object?>> _rewards;
  List<Map<String, Object?>> _vouchers;
  List<Map<String, Object?>> _redemptions;
  final String Function(String prefix, int sequence) _idFactory;
  int _nextSequence = 1;
  String mockCurrentPassword;
  final _profileChanges = StreamController<Map<String, Object?>>.broadcast();
  final _walletChanges = StreamController<Map<String, Object?>>.broadcast();
  final _depositChanges =
      StreamController<List<Map<String, Object?>>>.broadcast();
  final _revisionChanges = StreamController<int>.broadcast();
  int _revision = 0;

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

  Map<String, Object?> get security => _copyMap(_security);
  Map<String, Object?> get notificationPreferences =>
      _copyMap(_notificationPreferences);
  Map<String, Object?> get session => _copyMap(_session);
  Map<String, Object?> get metadata => _copyMap(_metadata);
  List<Map<String, Object?>> get bins => _copyList(_bins);
  List<Map<String, Object?>> get scanInstructions =>
      _copyList(_scanInstructions);
  List<Map<String, Object?>> get classifications => _copyList(_classifications);
  List<Map<String, Object?>> get sessions => _copyList(_sessions);
  List<Map<String, Object?>> get results => _copyList(_results);
  List<Map<String, Object?>> get rewardCategories =>
      _copyList(_rewardCategories);
  List<Map<String, Object?>> get rewards => _copyList(_rewards);
  List<Map<String, Object?>> get vouchers => _copyList(_vouchers);
  List<Map<String, Object?>> get redemptions => _copyList(_redemptions);
  int get revision => _revision;
  Stream<int> watchRevision() => _revisionChanges.stream;
  String newId(String prefix) => _idFactory(prefix, _nextSequence++);

  void updateSecurity(Map<String, Object?> value) =>
      _security = _copyMap(value);
  void updateNotificationPreferences(Map<String, Object?> value) =>
      _notificationPreferences = _copyMap(value);
  void updateSession(Map<String, Object?> value) => _session = _copyMap(value);

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
      _revisionChanges.add(++_revision);
      return result;
    } on Object {
      _profile = oldProfile;
      _wallet = oldWallet;
      _deposits = oldDeposits;
      rethrow;
    }
  }

  Future<R> transactionRewards<R>(
    R Function(
      Map<String, Object?> wallet,
      List<Map<String, Object?>> vouchers,
      List<Map<String, Object?>> redemptions,
    )
    action,
  ) async {
    final workingWallet = _copyMap(_wallet);
    final workingVouchers = _copyList(_vouchers);
    final workingRedemptions = _copyList(_redemptions);
    final result = action(workingWallet, workingVouchers, workingRedemptions);
    _wallet = workingWallet;
    _vouchers = workingVouchers;
    _redemptions = workingRedemptions;
    _walletChanges.add(wallet);
    _revisionChanges.add(++_revision);
    return result;
  }

  void dispose() {
    _profileChanges.close();
    _walletChanges.close();
    _depositChanges.close();
    _revisionChanges.close();
  }

  static AppFailure notFound(String entity) => AppFailure(
    code: AppFailureCodes.notFound,
    messageKey: 'mock.$entity.notFound',
    retryable: false,
  );

  static Map<String, Object?> _copyMap(Map<String, Object?> value) =>
      value.map((key, item) => MapEntry(key, _copyValue(item)));

  static List<Map<String, Object?>> _copyList(
    List<Map<String, Object?>>? value,
  ) => (value ?? const []).map(_copyMap).toList();

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
