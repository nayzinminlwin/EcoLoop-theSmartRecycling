import 'dart:async';

import 'package:eco_loop/core/data/pending_operation_store.dart';
import 'package:eco_loop/core/firebase/command_client.dart';
import 'package:eco_loop/features/scan/data/firebase_scan_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('maps scan command response and preserves request identity', () async {
    final requests = <Map<String, Object?>>[];
    final client = CommandClient(
      uid: 'resident-1',
      store: PendingOperationStore(preferences: _MemoryPreferences()),
      requestIdFactory: () => 'request-1',
      transport: (operation, payload) async {
        requests.add({'operation': operation, 'payload': payload});
        return _envelope(
          requestId: 'request-1',
          operation: operation,
          data: {
            'residentId': 'resident-1',
            'recordIds': ['depositSessions/session-1'],
            'version': 0,
            'operationState': 'applied',
            'stage': 'binFound',
            'session': _session(),
            'bin': _bin(),
          },
        );
      },
    );
    final repository = FirebaseScanRepository(
      uid: 'resident-1',
      commandClient: client,
      reads: _FakeReads(),
    );

    final result = await repository.scanBinQr(
      'ecoloop://bin/BIN-004',
      'request-1',
    );

    expect(result.id, 'session-1');
    expect(requests.single['operation'], 'scanBinQr');
    final payload = requests.single['payload']! as Map<String, Object?>;
    expect(payload['requestId'], 'request-1');
    expect((payload['payload']! as Map)['qrPayload'], 'ecoloop://bin/BIN-004');
  });

  test('suppresses stale session snapshots from the watch stream', () async {
    final reads = _FakeReads(
      values: {'depositSessions/session-1': _session(version: 2)},
      watches: {
        'depositSessions/session-1': Stream.fromIterable([
          _session(version: 1),
          _session(version: 3),
        ]),
      },
    );
    final repository = FirebaseScanRepository(
      uid: 'resident-1',
      commandClient: _unusedClient(),
      reads: reads,
    );

    final sessions = await repository.watchSession('session-1').toList();

    expect(sessions.map((item) => item?.sessionVersion), [2, 3]);
  });

  test('owner mismatch is rejected on direct reads and streams', () async {
    final repository = FirebaseScanRepository(
      uid: 'resident-1',
      commandClient: _unusedClient(),
      reads: _FakeReads(
        values: {'depositSessions/session-1': _session(ownerId: 'other')},
      ),
    );

    expect(() => repository.getSession('session-1'), throwsA(isA<Exception>()));
  });
}

Map<String, Object?> _session({
  String ownerId = 'resident-1',
  int version = 1,
}) => {
  'id': 'session-1',
  'ownerId': ownerId,
  'binId': 'BIN-004',
  'stage': 'processing',
  'version': version,
  'createdAt': '2026-10-19T04:00:00Z',
  'updatedAt': '2026-10-19T04:01:00Z',
  'draftAssetId': null,
  'draftAssetVersion': null,
  'batchId': 'batch-1',
};

Map<String, Object?> _bin() => {
  'id': 'BIN-004',
  'capacitySpc': 100,
  'occupiedSpc': 20,
  'capacityPercent': 20,
  'cycleId': 'cycle-1',
  'isOnline': true,
  'enabled': true,
};

Map<String, Object?> _envelope({
  required String requestId,
  required String operation,
  required Map<String, Object?> data,
}) => {
  'schemaVersion': 'backend.v1',
  'operation': operation,
  'requestId': requestId,
  'traceId': '0123456789abcdef0123456789abcdef',
  'status': 'committed',
  'data': data,
};

CommandClient _unusedClient() => CommandClient(
  uid: 'resident-1',
  store: PendingOperationStore(preferences: _MemoryPreferences()),
  transport: (_, _) async => throw StateError('unexpected command'),
);

class _FakeReads implements ScanReadTransport {
  _FakeReads({this.values = const {}, this.watches = const {}});

  final Map<String, Map<String, Object?>> values;
  final Map<String, Stream<Map<String, Object?>>> watches;

  @override
  Future<Map<String, Object?>?> read(String collection, String id) async =>
      values['$collection/$id'];

  @override
  Stream<Map<String, Object?>> watch(String collection, String id) =>
      watches['$collection/$id'] ?? const Stream.empty();

  @override
  Stream<List<Map<String, Object?>>> watchCollection(String collection) =>
      const Stream.empty();

  @override
  Stream<Map<String, Object?>> watchOwner(String collection, String ownerId) =>
      const Stream.empty();
}

class _MemoryPreferences implements PendingOperationPreferences {
  final Map<String, String> values = {};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> remove(String key) async => values.remove(key);

  @override
  Future<void> write(String key, String value) async => values[key] = value;
}
