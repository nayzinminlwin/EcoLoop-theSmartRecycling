// ignore_for_file: prefer_initializing_formals

import 'dart:async';

import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/core/data/json_readers.dart';
import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_data_store.dart';
import 'package:eco_loop/core/mock/mock_seed_loader.dart';

import '../domain/models/auth_state.dart';
import '../domain/models/account_security_info.dart';
import '../domain/models/demo_session.dart';
import '../domain/models/notification_preferences.dart';
import '../domain/models/password_change_request.dart';
import '../domain/models/profile_update_request.dart';
import '../domain/models/resident_profile.dart';
import '../domain/repositories/account_repository.dart';

class MockAccountRepository implements AccountRepository {
  MockAccountRepository({
    MockDataStore? store,
    MockApi? api,
    MockSeedLoader? loader,
    AppClock? clock,
  }) : _store = store,
       _api = api ?? MockApi(),
       _loader = loader ?? const MockSeedLoader(),
       _clock = clock ?? AppClock();

  final MockDataStore? _store;
  final MockApi _api;
  final MockSeedLoader _loader;
  final AppClock _clock;
  final _authChanges = StreamController<AuthState>.broadcast();
  final _profileChanges = StreamController<Map<String, Object?>>.broadcast();
  final _securityChanges = StreamController<AccountSecurityInfo?>.broadcast();
  final _preferenceChanges =
      StreamController<NotificationPreferences?>.broadcast();
  final _sessionChanges = StreamController<DemoSession>.broadcast();
  bool _signedIn = true;
  String _mockCurrentPassword = 'DemoPass123!';

  AuthState _readAuthState() => _signedIn
      ? const AuthState(uid: 'RES-000842', role: AppRole.user, isSignedIn: true)
      : const AuthState(uid: null, role: null, isSignedIn: false);

  @override
  Future<AuthState> signInWithGoogle() =>
      resumeDemoSession().then((_) => getAuthState());

  void _ensureSignedIn() {
    if (!_signedIn) {
      throw const AppFailure(
        code: AppFailureCodes.unauthenticated,
        messageKey: 'auth.signedOut',
        retryable: false,
      );
    }
  }

  @override
  Future<AuthState> getAuthState() =>
      _api.read('account.getAuthState', _readAuthState);

  @override
  Stream<AuthState> watchAuthState() async* {
    yield await _api.read('account.watchAuthState', _readAuthState);
    yield* _authChanges.stream;
  }

  Future<ResidentProfile> _readProfile() async {
    _ensureSignedIn();
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
        yield json.isEmpty ? null : ResidentProfile.fromJson(json);
      }
    }
  }

  Future<JsonMap> _fixture(String path, Map<String, Object?> stored) async =>
      stored.isNotEmpty ? stored : _loader.loadMap(path);

  @override
  Future<ResidentProfile> updateProfile(ProfileUpdateRequest request) =>
      _api.write('account.updateProfile', () async {
        final name = request.fullName.trim();
        final email = request.email.trim();
        if (name.isEmpty || !_validEmail.hasMatch(email)) {
          throw const AppFailure(
            code: AppFailureCodes.validation,
            messageKey: 'account.profileInvalid',
            retryable: false,
          );
        }
        final current = await _readProfile();
        final updated = ResidentProfile(
          id: current.id,
          fullName: name,
          email: email,
          avatarUrl: request.avatarUrl,
          createdAt: current.createdAt,
        );
        _store?.updateProfile(updated.toJson());
        return updated;
      });

  @override
  Future<AccountSecurityInfo> getSecurityInfo() =>
      _api.read('account.getSecurityInfo', () async {
        _ensureSignedIn();
        return AccountSecurityInfo.fromJson(
          await _fixture(
            'assets/mock/account/security.json',
            _store?.security ?? const {},
          ),
        );
      });

  @override
  Future<AccountSecurityInfo> changePassword(PasswordChangeRequest request) =>
      _api.write('account.changePassword', () async {
        _ensureSignedIn();
        if (request.currentPassword !=
            (_store?.mockCurrentPassword ?? _mockCurrentPassword)) {
          throw const AppFailure(
            code: AppFailureCodes.validation,
            messageKey: 'account.currentPasswordInvalid',
            retryable: false,
          );
        }
        if (!_validPassword(request.newPassword)) {
          throw const AppFailure(
            code: AppFailureCodes.validation,
            messageKey: 'account.passwordInvalid',
            retryable: false,
          );
        }
        _mockCurrentPassword = request.newPassword;
        _store?.mockCurrentPassword = request.newPassword;
        final security = AccountSecurityInfo(
          residentId: 'RES-000842',
          passwordUpdatedAt: _clock.now,
          isProtected: true,
        );
        _store?.updateSecurity(security.toJson());
        _securityChanges.add(security);
        return security;
      });

  @override
  Future<NotificationPreferences> getNotificationPreferences() =>
      _api.read('account.getNotificationPreferences', () async {
        _ensureSignedIn();
        return NotificationPreferences.fromJson(
          await _fixture(
            'assets/mock/account/notification_preferences.json',
            _store?.notificationPreferences ?? const {},
          ),
        );
      });

  @override
  Future<NotificationPreferences> updateNotificationPreferences(
    NotificationPreferences preferences,
  ) => _api.write('account.updateNotificationPreferences', () async {
    _ensureSignedIn();
    final saved = NotificationPreferences(
      residentId: 'RES-000842',
      recyclingUpdates: preferences.recyclingUpdates,
      pointsCredits: preferences.pointsCredits,
      rewardReminders: preferences.rewardReminders,
      updatedAt: _clock.now,
    );
    _store?.updateNotificationPreferences(saved.toJson());
    _preferenceChanges.add(saved);
    return saved;
  });

  @override
  Future<DemoSession> getDemoSession() => _api.read(
    'account.getDemoSession',
    () async => DemoSession.fromJson(
      await _fixture(
        'assets/mock/account/session.json',
        _store?.session ?? const {},
      ),
    ).copyWith(isSignedIn: _signedIn),
  );

  @override
  Future<void> signOut() => _api.write('account.signOut', () async {
    _signedIn = false;
    _authChanges.add(_readAuthState());
    _profileChanges.add({});
    _securityChanges.add(null);
    _preferenceChanges.add(null);
    final session = await getDemoSession();
    _sessionChanges.add(session.copyWith(isSignedIn: false));
  });

  @override
  Future<DemoSession> resumeDemoSession() =>
      _api.write('account.resumeDemoSession', () async {
        _signedIn = true;
        final session = (await getDemoSession()).copyWith(isSignedIn: true);
        _authChanges.add(_readAuthState());
        _sessionChanges.add(session);
        return session;
      });

  @override
  Stream<AccountSecurityInfo?> watchSecurityInfo() async* {
    yield await getSecurityInfo();
    yield* _securityChanges.stream;
  }

  @override
  Stream<NotificationPreferences?> watchNotificationPreferences() async* {
    yield await getNotificationPreferences();
    yield* _preferenceChanges.stream;
  }

  @override
  Stream<DemoSession> watchDemoSession() async* {
    yield await getDemoSession();
    yield* _sessionChanges.stream;
  }

  static final _validEmail = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
  static final _hasLetter = RegExp('[A-Za-z]');
  static final _hasNumber = RegExp(r'\d');
  static bool _validPassword(String value) =>
      value.length >= 8 &&
      _hasLetter.hasMatch(value) &&
      _hasNumber.hasMatch(value);
}
