import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/core/firebase/command_client.dart';

import '../domain/models/account_security_info.dart';
import '../domain/models/auth_state.dart';
import '../domain/models/demo_session.dart';
import '../domain/models/notification_preferences.dart';
import '../domain/models/password_change_request.dart';
import '../domain/models/profile_update_request.dart';
import '../domain/models/resident_profile.dart';
import '../domain/repositories/account_repository.dart';

class GoogleAccount {
  const GoogleAccount({
    required this.email,
    required this.displayName,
    required this.photoUrl,
    required this.idToken,
  });

  final String email;
  final String? displayName;
  final String? photoUrl;
  final String idToken;
}

abstract interface class GoogleAuthGateway {
  Future<void> initialize();
  Future<GoogleAccount?> authenticate();
  Future<void> signOut();
}

abstract interface class FirebaseAuthGateway {
  AuthUser? get currentUser;
  Stream<AuthUser?> authStateChanges();
  Future<AuthUser> signInWithGoogleCredential(String idToken);
  Future<Map<String, Object?>> refreshClaims(AuthUser user);
  Future<void> signOut();
}

class AuthUser {
  const AuthUser({
    required this.uid,
    required this.email,
    required this.displayName,
    required this.photoUrl,
    this.providerIds = const [],
  });

  final String uid;
  final String? email;
  final String? displayName;
  final String? photoUrl;
  final List<String> providerIds;

  bool get hasGoogleProvider => providerIds.contains('google.com');
  bool get hasPasswordProvider => providerIds.contains('password');
}

class FirebaseGoogleAuthGateway implements GoogleAuthGateway {
  FirebaseGoogleAuthGateway({GoogleSignIn? googleSignIn})
    : _googleSignIn = googleSignIn ?? GoogleSignIn.instance;

  final GoogleSignIn _googleSignIn;
  bool _initialized = false;

  @override
  Future<void> initialize() async {
    if (_initialized) return;
    await _googleSignIn.initialize();
    _initialized = true;
  }

  @override
  Future<GoogleAccount?> authenticate() async {
    await initialize();
    late final GoogleSignInAccount account;
    try {
      account = await _googleSignIn.authenticate();
    } on GoogleSignInException catch (error) {
      switch (error.code) {
        case GoogleSignInExceptionCode.canceled:
        case GoogleSignInExceptionCode.interrupted:
        case GoogleSignInExceptionCode.uiUnavailable:
          return null;
        default:
          rethrow;
      }
    }
    final idToken = account.authentication.idToken;
    if (idToken == null || idToken.isEmpty) {
      throw const AppFailure(
        code: AppFailureCodes.invalidData,
        messageKey: 'auth.googleTokenMissing',
        retryable: false,
      );
    }
    return GoogleAccount(
      email: account.email,
      displayName: account.displayName,
      photoUrl: account.photoUrl,
      idToken: idToken,
    );
  }

  @override
  Future<void> signOut() => _googleSignIn.signOut();
}

class FirebaseUserAuthGateway implements FirebaseAuthGateway {
  FirebaseUserAuthGateway({FirebaseAuth? auth})
    : _auth = auth ?? FirebaseAuth.instance;

  final FirebaseAuth _auth;

  @override
  AuthUser? get currentUser => _mapUser(_auth.currentUser);

  @override
  Stream<AuthUser?> authStateChanges() =>
      _auth.authStateChanges().map(_mapUser);

  @override
  Future<AuthUser> signInWithGoogleCredential(String idToken) async {
    final credential = GoogleAuthProvider.credential(idToken: idToken);
    final result = await _auth.signInWithCredential(credential);
    final user = _mapUser(result.user);
    if (user == null) {
      throw const AppFailure(
        code: AppFailureCodes.unauthenticated,
        messageKey: 'auth.userMissing',
        retryable: false,
      );
    }
    return user;
  }

  @override
  Future<Map<String, Object?>> refreshClaims(AuthUser user) async {
    final firebaseUser = _auth.currentUser;
    if (firebaseUser == null || firebaseUser.uid != user.uid) {
      throw const AppFailure(
        code: AppFailureCodes.unauthenticated,
        messageKey: 'auth.sessionChanged',
        retryable: false,
      );
    }
    final token = await firebaseUser.getIdTokenResult(true);
    return Map<String, Object?>.from(token.claims ?? const {});
  }

  @override
  Future<void> signOut() => _auth.signOut();

  static AuthUser? _mapUser(User? user) => user == null
      ? null
      : AuthUser(
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoUrl: user.photoURL,
          providerIds: user.providerData
              .map((item) => item.providerId)
              .toList(),
        );
}

class FirebaseAccountRepository implements AccountRepository {
  FirebaseAccountRepository({
    required this._auth,
    required this._google,
    required this._commandClient,
    this.beforeSignOut,
  });

  final FirebaseAuthGateway _auth;
  final GoogleAuthGateway _google;
  final CommandClient Function(String uid) _commandClient;
  final Future<void> Function()? beforeSignOut;
  final _authChanges = StreamController<AuthState>.broadcast();
  final _profileChanges = StreamController<ResidentProfile?>.broadcast();
  final _preferenceChanges =
      StreamController<NotificationPreferences?>.broadcast();
  StreamSubscription<AuthUser?>? _authSubscription;
  Future<AuthState>? _initialState;
  String? _provisionedUid;
  AuthState? _lastState;

  @override
  Future<AuthState> signInWithGoogle() async {
    try {
      await _google.initialize();
      final googleAccount = await _google.authenticate();
      if (googleAccount == null) {
        return _publish(
          const AuthState(uid: null, role: null, isSignedIn: false),
        );
      }
      final user = await _auth.signInWithGoogleCredential(
        googleAccount.idToken,
      );
      return await _provision(user, googleAccount: googleAccount);
    } on AppFailure {
      rethrow;
    } catch (error) {
      throw _mapAuthError(error);
    }
  }

  @override
  Future<AuthState> getAuthState() {
    _subscribeOnce();
    return _initialState ??= _resolveCurrentUser();
  }

  @override
  Stream<AuthState> watchAuthState() {
    _subscribeOnce();
    return _authChanges.stream;
  }

  void _subscribeOnce() {
    if (_authSubscription != null) return;
    _authSubscription = _auth.authStateChanges().listen((user) async {
      if (user == null) {
        _provisionedUid = null;
        _publish(const AuthState(uid: null, role: null, isSignedIn: false));
        return;
      }
      try {
        await _provision(user);
      } catch (error) {
        _authChanges.addError(error);
      }
    }, onError: _authChanges.addError);
  }

  Future<AuthState> _resolveCurrentUser() async {
    final user = _auth.currentUser;
    if (user == null) {
      return _publish(
        const AuthState(uid: null, role: null, isSignedIn: false),
      );
    }
    return _provision(user);
  }

  Future<AuthState> _provision(
    AuthUser user, {
    GoogleAccount? googleAccount,
  }) async {
    if (_provisionedUid == user.uid && _lastState != null) return _lastState!;
    final claims = await _auth.refreshClaims(user);
    final client = _commandClient(user.uid);
    final result = await client.execute('bootstrapResident', <String, Object?>{
      'displayName': googleAccount?.displayName ?? user.displayName,
      'email': googleAccount?.email ?? user.email,
      'avatarUrl': googleAccount?.photoUrl ?? user.photoUrl,
    });
    final role = AppRole.fromWire(
      _stringValue(claims['role']) ?? _stringValue(result.data?['role']),
    );
    if (role == null) {
      throw AppFailure(
        code: AppFailureCodes.permissionDenied,
        messageKey: 'auth.roleMissing',
        retryable: false,
        requestId: result.requestId,
        traceId: result.traceId,
      );
    }
    _provisionedUid = user.uid;
    return _publish(AuthState(uid: user.uid, role: role, isSignedIn: true));
  }

  AuthState _publish(AuthState state) {
    _lastState = state;
    _authChanges.add(state);
    return state;
  }

  CommandClient _client() {
    final uid = _lastState?.uid;
    if (uid == null) throw _signedOut();
    return _commandClient(uid);
  }

  @override
  Future<ResidentProfile> getProfile() async {
    final envelope = await _client().execute(
      'getResidentProfile',
      const <String, Object?>{},
    );
    final profile = envelope.data?['profile'];
    if (profile is! Map) throw _invalidResponse();
    return ResidentProfile.fromJson(Map<String, Object?>.from(profile));
  }

  @override
  Stream<ResidentProfile?> watchProfile() async* {
    yield await getProfile();
    yield* _profileChanges.stream;
  }

  @override
  Future<ResidentProfile> updateProfile(ProfileUpdateRequest request) {
    return _client()
        .execute('updateResidentProfile', {
          'fullName': request.fullName,
          'avatarUrl': request.avatarUrl,
        })
        .then((envelope) {
          final profile = envelope.data?['profile'];
          if (profile is! Map) throw _invalidResponse();
          final result = ResidentProfile.fromJson(
            Map<String, Object?>.from(profile),
          );
          if (result.id != _lastState?.uid ||
              result.email != _auth.currentUser?.email) {
            throw _invalidResponse();
          }
          _profileChanges.add(result);
          return result;
        });
  }

  @override
  Future<AccountSecurityInfo> getSecurityInfo() async {
    final user = _auth.currentUser;
    if (user == null) throw _signedOut();
    return AccountSecurityInfo(
      residentId: user.uid,
      passwordUpdatedAt: null,
      isProtected: user.hasGoogleProvider || user.hasPasswordProvider,
      provider: user.hasGoogleProvider ? 'Google' : 'Firebase Auth',
    );
  }

  @override
  Future<AccountSecurityInfo> changePassword(PasswordChangeRequest request) =>
      _unsupported(
        _auth.currentUser?.hasPasswordProvider == true
            ? 'account.passwordChangeUnavailable'
            : 'account.googleManagedPassword',
      );

  @override
  Future<NotificationPreferences> getNotificationPreferences() async {
    final envelope = await _client().execute(
      'getResidentPreferences',
      const <String, Object?>{},
    );
    final preferences = envelope.data?['preferences'];
    if (preferences is! Map) throw _invalidResponse();
    return NotificationPreferences.fromJson(
      Map<String, Object?>.from(preferences),
    );
  }

  @override
  Future<NotificationPreferences> updateNotificationPreferences(
    NotificationPreferences preferences,
  ) async {
    final envelope = await _client().execute(
      'saveResidentPreferences',
      <String, Object?>{
        'preferences': {
          'recyclingUpdates': preferences.recyclingUpdates,
          'pointsCredits': preferences.pointsCredits,
          'rewardReminders': preferences.rewardReminders,
        },
      },
    );
    final saved = envelope.data?['preferences'];
    if (saved is! Map) throw _invalidResponse();
    final result = NotificationPreferences.fromJson(
      Map<String, Object?>.from(saved),
    );
    if (result.residentId != _lastState?.uid) throw _invalidResponse();
    _preferenceChanges.add(result);
    return result;
  }

  @override
  Future<DemoSession> getDemoSession() =>
      _unsupported('account.sessionUnavailable');

  @override
  Future<void> signOut() async {
    await beforeSignOut?.call();
    await _google.signOut();
    await _auth.signOut();
  }

  @override
  Future<DemoSession> resumeDemoSession() =>
      _unsupported('account.demoSessionUnavailable');

  @override
  Stream<AccountSecurityInfo?> watchSecurityInfo() async* {
    yield await getSecurityInfo();
  }

  @override
  Stream<NotificationPreferences?> watchNotificationPreferences() async* {
    yield await getNotificationPreferences();
    yield* _preferenceChanges.stream;
  }

  @override
  Stream<DemoSession> watchDemoSession() => Stream<DemoSession>.error(
    _unsupportedFailure('account.sessionUnavailable'),
  );

  Future<T> _unsupported<T>(String messageKey) =>
      Future<T>.error(_unsupportedFailure(messageKey));

  static AppFailure _unsupportedFailure(String messageKey) => AppFailure(
    code: AppFailureCodes.unavailable,
    messageKey: messageKey,
    retryable: false,
  );

  static AppFailure _signedOut() => const AppFailure(
    code: AppFailureCodes.unauthenticated,
    messageKey: 'auth.signedOut',
    retryable: false,
  );

  static AppFailure _invalidResponse() => const AppFailure(
    code: AppFailureCodes.invalidData,
    messageKey: 'auth.invalidAccountResponse',
    retryable: false,
  );

  static String? _stringValue(Object? value) => value is String ? value : null;

  static AppFailure _mapAuthError(Object error) => AppFailure(
    code: AppFailureCodes.unavailable,
    messageKey: 'auth.signInFailed',
    retryable: true,
  );

  Future<void> dispose() async {
    await _authSubscription?.cancel();
    await _authChanges.close();
    await _profileChanges.close();
    await _preferenceChanges.close();
  }
}
