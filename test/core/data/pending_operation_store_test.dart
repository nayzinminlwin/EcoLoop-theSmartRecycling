import 'package:eco_loop/core/data/pending_operation_store.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('persists and restores UID-scoped intent metadata', () async {
    final preferences = MemoryPreferences();
    final store = PendingOperationStore(preferences: preferences);
    const operation = PendingOperation(
      uid: 'resident-1',
      operation: 'redeemReward',
      requestId: 'request-001',
      payload: <String, Object?>{'rewardId': 'reward-cafe'},
    );

    await store.save(operation);

    expect(await store.read('resident-1'), isNotNull);
    expect((await store.read('resident-1'))?.requestId, 'request-001');
    expect(await store.read('resident-2'), isNull);
  });

  test('clear removes one account without touching another account', () async {
    final preferences = MemoryPreferences();
    final store = PendingOperationStore(preferences: preferences);

    await store.save(
      const PendingOperation(
        uid: 'resident-1',
        operation: 'submitInspection',
        requestId: 'request-001',
        payload: <String, Object?>{},
      ),
    );
    await store.save(
      const PendingOperation(
        uid: 'resident-2',
        operation: 'submitInspection',
        requestId: 'request-002',
        payload: <String, Object?>{},
      ),
    );

    await store.clear('resident-1');

    expect(await store.read('resident-1'), isNull);
    expect((await store.read('resident-2'))?.requestId, 'request-002');
  });

  test('creates and reuses a non-secret installation ID', () async {
    final store = PendingOperationStore(preferences: MemoryPreferences());

    final first = await store.installationId();
    final second = await store.installationId();

    expect(first, hasLength(32));
    expect(second, first);
  });

  test('invalid stored data fails explicitly and is removed', () async {
    final preferences = MemoryPreferences();
    final store = PendingOperationStore(preferences: preferences);
    await preferences.write(
      'ecoloop.pending_operation.v1.resident-1',
      '{"uid":"resident-2"}',
    );

    await expectLater(
      store.read('resident-1'),
      throwsA(isA<FormatException>()),
    );
    expect(await store.read('resident-1'), isNull);
  });
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
