import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/core/data/pending_operation_store.dart';
import 'package:eco_loop/core/firebase/command_client.dart';
import 'package:flutter_test/flutter_test.dart';

const committedTrace = '0123456789abcdef0123456789abcdef';

void main() {
  test('recovers ambiguous success with the original request ID', () async {
    final store = PendingOperationStore(preferences: MemoryPreferences());
    final calls = <Map<String, Object?>>[];
    var first = true;
    final client = CommandClient(
      uid: 'resident-1',
      store: store,
      requestIdFactory: () => 'request-001',
      transport: (operation, payload) async {
        calls.add(<String, Object?>{'operation': operation, ...payload});
        if (first) {
          first = false;
          throw const AppFailure(
            code: AppFailureCodes.unavailable,
            messageKey: 'transport',
            retryable: true,
          );
        }
        return _committed('request-001', operation);
      },
    );

    final result = await client.execute('submitInspection', <String, Object?>{
      'sessionId': 'session-1',
    });

    expect(result.isCommitted, isTrue);
    expect(calls.map((call) => call['operation']), [
      'submitInspection',
      'recoverOperation',
    ]);
    expect(calls[1]['requestId'], 'request-001');
    expect(await store.read('resident-1'), isNull);
  });

  test(
    'reopen recovery uses the persisted intent instead of a new request',
    () async {
      final preferences = MemoryPreferences();
      final store = PendingOperationStore(preferences: preferences);
      await store.save(
        const PendingOperation(
          uid: 'resident-1',
          operation: 'redeemReward',
          requestId: 'request-reopen',
          payload: <String, Object?>{'rewardId': 'reward-cafe'},
        ),
      );
      final calls = <Map<String, Object?>>[];
      final client = CommandClient(
        uid: 'resident-1',
        store: PendingOperationStore(preferences: preferences),
        requestIdFactory: () => 'request-must-not-be-used',
        transport: (operation, payload) async {
          calls.add(<String, Object?>{'operation': operation, ...payload});
          return _committed('request-reopen', operation);
        },
      );

      await client.execute('redeemReward', <String, Object?>{
        'rewardId': 'reward-cafe',
      });

      expect(calls.single['operation'], 'redeemReward');
      expect(calls.single['requestId'], 'request-reopen');
    },
  );

  test('changed payload conflicts with the persisted intent', () async {
    final store = PendingOperationStore(preferences: MemoryPreferences());
    await store.save(
      const PendingOperation(
        uid: 'resident-1',
        operation: 'redeemReward',
        requestId: 'request-conflict',
        payload: <String, Object?>{'rewardId': 'reward-cafe'},
      ),
    );
    final client = CommandClient(
      uid: 'resident-1',
      store: store,
      transport: (operation, payload) async =>
          _committed('request-conflict', operation),
    );

    expect(
      () => client.execute('redeemReward', <String, Object?>{
        'rewardId': 'reward-meal',
      }),
      throwsA(
        isA<AppFailure>().having(
          (failure) => failure.code,
          'code',
          AppFailureCodes.conflict,
        ),
      ),
    );
  });

  test('terminal rejection clears the pending intent', () async {
    final store = PendingOperationStore(preferences: MemoryPreferences());
    final client = CommandClient(
      uid: 'resident-1',
      store: store,
      requestIdFactory: () => 'request-terminal',
      transport: (operation, payload) async => _error(
        'request-terminal',
        operation,
        code: 'insufficient_points',
        retryable: false,
      ),
    );

    expect(
      () => client.execute('redeemReward', <String, Object?>{
        'rewardId': 'reward-cafe',
      }),
      throwsA(
        isA<AppFailure>().having(
          (failure) => failure.code,
          'code',
          AppFailureCodes.insufficientPoints,
        ),
      ),
    );
    expect(await store.read('resident-1'), isNull);
  });

  test('session actions supersede a stale renewal intent', () async {
    final store = PendingOperationStore(preferences: MemoryPreferences());
    await store.save(
      const PendingOperation(
        uid: 'resident-1',
        operation: 'renewSession',
        requestId: 'request-renew',
        payload: <String, Object?>{
          'sessionId': 'session-1',
          'expectedVersion': 2,
        },
      ),
    );
    final calls = <String>[];
    final client = CommandClient(
      uid: 'resident-1',
      store: store,
      requestIdFactory: () => 'request-save',
      transport: (operation, payload) async {
        calls.add(operation);
        return _committed('request-save', operation);
      },
    );

    await client.execute('saveImageSelection', <String, Object?>{
      'sessionId': 'session-1',
      'assetId': 'asset-1',
      'assetVersion': 'version-1',
      'expectedVersion': 2,
    });

    expect(calls, ['saveImageSelection']);
    expect(await store.read('resident-1'), isNull);
  });

  test('account switching cannot recover another UID intent', () async {
    final preferences = MemoryPreferences();
    final store = PendingOperationStore(preferences: preferences);
    await store.save(
      const PendingOperation(
        uid: 'resident-1',
        operation: 'submitInspection',
        requestId: 'request-owner-1',
        payload: <String, Object?>{'sessionId': 'session-1'},
      ),
    );
    final calls = <String>[];
    final client = CommandClient(
      uid: 'resident-2',
      store: PendingOperationStore(preferences: preferences),
      requestIdFactory: () => 'request-owner-2',
      transport: (operation, payload) async {
        calls.add(payload['requestId']! as String);
        return _committed(payload['requestId']! as String, operation);
      },
    );

    await client.execute('submitInspection', <String, Object?>{
      'sessionId': 'session-2',
    });

    expect(calls.single, 'request-owner-2');
    expect((await store.read('resident-1'))?.requestId, 'request-owner-1');
  });
}

Map<String, Object?> _committed(String requestId, String operation) {
  return <String, Object?>{
    'schemaVersion': 'backend.v1',
    'operation': operation,
    'requestId': requestId,
    'traceId': committedTrace,
    'status': 'committed',
    'data': <String, Object?>{
      'residentId': 'resident-1',
      'recordIds': <Object?>['record-1'],
      'version': 1,
    },
  };
}

Map<String, Object?> _error(
  String requestId,
  String operation, {
  required String code,
  required bool retryable,
}) {
  return <String, Object?>{
    'schemaVersion': 'backend.v1',
    'operation': operation,
    'requestId': requestId,
    'traceId': committedTrace,
    'status': 'error',
    'error': <String, Object?>{
      'code': code,
      'message': 'The operation was rejected.',
      'retryable': retryable,
    },
  };
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
