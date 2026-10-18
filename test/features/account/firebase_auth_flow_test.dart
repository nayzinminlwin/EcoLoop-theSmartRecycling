import 'dart:async';

import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/core/data/pending_operation_store.dart';
import 'package:eco_loop/core/firebase/command_client.dart';
import 'package:eco_loop/features/account/data/firebase_account_repository.dart';
import 'package:eco_loop/features/account/domain/models/auth_state.dart';
import 'package:flutter_test/flutter_test.dart';

const traceId = '0123456789abcdef0123456789abcdef';

void main() {
  test(
    'Google sign-in bootstraps before publishing resident-ready state',
    () async {
      final auth = FakeAuthGateway();
      final google = FakeGoogleGateway(
        account: const GoogleAccount(
          email: 'resident@example.com',
          displayName: 'Resident One',
          photoUrl: null,
          idToken: 'google-token',
        ),
      );
      final calls = <String>[];
      final repository = FirebaseAccountRepository(
        auth: auth,
        google: google,
        commandClient: (uid) => CommandClient(
          uid: uid,
          store: PendingOperationStore(preferences: MemoryPreferences()),
          requestIdFactory: () => 'request-001',
          transport: (operation, payload) async {
            calls.add(operation);
            return _committed('request-001', operation);
          },
        ),
      );
      final states = <AuthState>[];
      final subscription = repository.watchAuthState().listen(states.add);

      final result = await repository.signInWithGoogle();

      expect(result.isSignedIn, isTrue);
      expect(result.uid, 'uid-1');
      expect(result.role, AppRole.user);
      expect(calls, ['bootstrapResident']);
      await Future<void>.delayed(Duration.zero);
      expect(states.single.isSignedIn, isTrue);
      await subscription.cancel();
      await repository.dispose();
    },
  );

  test(
    'Google cancellation stays signed out and does not call Firebase',
    () async {
      final auth = FakeAuthGateway();
      final google = FakeGoogleGateway();
      final repository = FirebaseAccountRepository(
        auth: auth,
        google: google,
        commandClient: (_) => throw StateError('must not be called'),
      );

      final result = await repository.signInWithGoogle();

      expect(result.isSignedIn, isFalse);
      expect(auth.signInCalls, 0);
    },
  );

  test(
    'bootstrap failure is surfaced with its trace and no ready state',
    () async {
      final auth = FakeAuthGateway();
      final google = FakeGoogleGateway(
        account: const GoogleAccount(
          email: 'resident@example.com',
          displayName: 'Resident One',
          photoUrl: null,
          idToken: 'google-token',
        ),
      );
      final repository = FirebaseAccountRepository(
        auth: auth,
        google: google,
        commandClient: (uid) => CommandClient(
          uid: uid,
          store: PendingOperationStore(preferences: MemoryPreferences()),
          requestIdFactory: () => 'request-002',
          transport: (operation, payload) async =>
              _error('request-002', operation, traceId: traceId),
        ),
      );

      await expectLater(
        repository.signInWithGoogle(),
        throwsA(
          isA<AppFailure>()
              .having((error) => error.traceId, 'traceId', traceId)
              .having((error) => error.retryable, 'retryable', isFalse),
        ),
      );
      await repository.dispose();
    },
  );
}

Map<String, Object?> _committed(String requestId, String operation) =>
    <String, Object?>{
      'schemaVersion': 'backend.v1',
      'operation': operation,
      'requestId': requestId,
      'traceId': traceId,
      'status': 'committed',
      'data': <String, Object?>{'role': 'user'},
    };

Map<String, Object?> _error(
  String requestId,
  String operation, {
  required String traceId,
}) => <String, Object?>{
  'schemaVersion': 'backend.v1',
  'operation': operation,
  'requestId': requestId,
  'traceId': traceId,
  'status': 'error',
  'error': <String, Object?>{
    'code': 'permission_denied',
    'message': 'Provisioning failed.',
    'retryable': false,
  },
};

class FakeGoogleGateway implements GoogleAuthGateway {
  FakeGoogleGateway({this.account});

  final GoogleAccount? account;

  @override
  Future<void> initialize() async {}

  @override
  Future<GoogleAccount?> authenticate() async => account;

  @override
  Future<void> signOut() async {}
}

class FakeAuthGateway implements FirebaseAuthGateway {
  final changes = StreamController<AuthUser?>.broadcast();
  int signInCalls = 0;
  AuthUser? _current;

  @override
  AuthUser? get currentUser => _current;

  @override
  Stream<AuthUser?> authStateChanges() => changes.stream;

  @override
  Future<AuthUser> signInWithGoogleCredential(String idToken) async {
    signInCalls++;
    return _current = const AuthUser(
      uid: 'uid-1',
      email: 'resident@example.com',
      displayName: 'Resident One',
      photoUrl: null,
    );
  }

  @override
  Future<Map<String, Object?>> refreshClaims(AuthUser user) async =>
      <String, Object?>{'role': 'user'};

  @override
  Future<void> signOut() async {
    _current = null;
  }
}

class MemoryPreferences implements PendingOperationPreferences {
  final values = <String, String>{};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> remove(String key) async {
    values.remove(key);
  }

  @override
  Future<void> write(String key, String value) async {
    values[key] = value;
  }
}
