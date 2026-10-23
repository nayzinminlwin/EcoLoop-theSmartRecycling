import 'dart:async';

import 'package:eco_loop/core/data/pending_operation_store.dart';
import 'package:eco_loop/core/firebase/command_client.dart';
import 'package:eco_loop/features/scan/data/firebase_scan_repository.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_result.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_session.dart';
import 'package:eco_loop/features/scan/domain/models/smart_bin.dart';
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

  test(
    'runs the acknowledged forward path through one draft and submitted result',
    () async {
      final operations = <String>[];
      final client = CommandClient(
        uid: 'resident-1',
        store: PendingOperationStore(preferences: _MemoryPreferences()),
        requestIdFactory: () => 'request-forward',
        transport: (operation, payload) async {
          operations.add(operation);
          final version = switch (operation) {
            'scanBinQr' => 1,
            'confirmSession' => 2,
            'reportFinishPressed' => 3,
            'saveImageSelection' => 4,
            _ => 0,
          };
          final stage = switch (operation) {
            'scanBinQr' => 'binFound',
            'confirmSession' => 'ready',
            'reportFinishPressed' => 'itemDetected',
            'saveImageSelection' => 'itemDetected',
            _ => 'processing',
          };
          final session = _session(
            stage: stage,
            version: version,
            draftAssetId: operation == 'saveImageSelection'
                ? 'asset-demo-0010'
                : null,
            draftAssetVersion: operation == 'saveImageSelection'
                ? 'sha256-4a5e8b49da2c64c3'
                : null,
          );
          return _envelope(
            requestId: 'request-forward',
            operation: operation,
            data: operation == 'submitInspection'
                ? {
                    'batchId': 'batch-forward',
                    'jobId': 'job-forward',
                    'resultId': 'result-forward',
                    'deadlineAt': '2026-10-21T03:05:00Z',
                  }
                : {
                    'residentId': 'resident-1',
                    'recordIds': ['depositSessions/session-1'],
                    'version': version,
                    'operationState': 'applied',
                    'stage': stage,
                    'session': session,
                  },
          );
        },
      );
      final repository = FirebaseScanRepository(
        uid: 'resident-1',
        commandClient: client,
        reads: _FakeReads(
          values: {'depositResults/result-forward': _processingResult()},
          watches: {
            'depositResults/result-forward': Stream.fromIterable([
              _processingResult(),
              _finalResult(),
            ]),
          },
        ),
      );

      final scanned = await repository.scanBinQr(
        'ecoloop://bin/qr-demo-main',
        'request-forward',
      );
      final confirmed = await repository.confirmSession(
        scanned.id,
        scanned.sessionVersion,
      );
      final ready = await repository.reportFinishPressed(
        confirmed.id,
        confirmed.sessionVersion,
      );
      final draft = await repository.saveImageSelection(
        sessionId: ready.id,
        assetId: 'asset-demo-0010',
        assetVersion: 'sha256-4a5e8b49da2c64c3',
        expectedVersion: ready.sessionVersion,
      );
      final submission = await repository.submitInspection(
        sessionId: draft.id,
        assetId: 'asset-demo-0010',
        assetVersion: 'sha256-4a5e8b49da2c64c3',
        expectedVersion: draft.sessionVersion,
      );

      expect(
        [scanned.stage, confirmed.stage, ready.stage, draft.stage],
        [
          ScanStage.binFound,
          ScanStage.ready,
          ScanStage.itemDetected,
          ScanStage.itemDetected,
        ],
      );
      expect(draft.sessionVersion, 4);
      expect(submission.resultId, 'result-forward');
      expect(operations, [
        'scanBinQr',
        'confirmSession',
        'reportFinishPressed',
        'saveImageSelection',
        'submitInspection',
      ]);
      await expectLater(
        repository
            .watchResult('result-forward')
            .map((result) => result?.outcome),
        emitsInOrder([
          DepositOutcome.processing,
          DepositOutcome.processing,
          DepositOutcome.verified,
          emitsDone,
        ]),
      );
    },
  );

  test(
    'reads resident scan instructions from the Firebase content document',
    () async {
      final repository = FirebaseScanRepository(
        uid: 'resident-1',
        commandClient: _unusedClient(),
        reads: _FakeReads(values: {'scanContent/default': _instructions()}),
      );

      final instructions = await repository.getInstructions();

      expect(instructions.id, 'default');
      expect(instructions.processingTitle, 'Identifying your items');
    },
  );

  test(
    'keeps the result listener alive from processing through final data',
    () async {
      final repository = FirebaseScanRepository(
        uid: 'resident-1',
        commandClient: _unusedClient(),
        reads: _FakeReads(
          values: {'depositResults/result-1': _processingResult()},
          watches: {
            'depositResults/result-1': Stream.fromIterable([
              _processingResult(),
              _finalResult(),
            ]),
          },
        ),
      );

      await expectLater(
        repository.watchResult('result-1').map((result) => result?.outcome),
        emitsInOrder([
          DepositOutcome.processing,
          DepositOutcome.processing,
          DepositOutcome.verified,
          emitsDone,
        ]),
      );
    },
  );

  test(
    'keeps the bin returned by a successful scan when live bin reads fail',
    () async {
      final client = CommandClient(
        uid: 'resident-1',
        store: PendingOperationStore(preferences: _MemoryPreferences()),
        requestIdFactory: () => 'request-1',
        transport: (operation, _) async => _envelope(
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
        ),
      );
      final repository = FirebaseScanRepository(
        uid: 'resident-1',
        commandClient: client,
        reads: _FakeReads(
          watches: {
            'bins/BIN-004': Stream.error(StateError('live read unavailable')),
          },
        ),
      );

      await repository.scanBinQr('ecoloop://bin/BIN-004', 'request-1');

      await expectLater(
        repository.watchBin('BIN-004'),
        emitsInOrder([isA<SmartBin>()]),
      );
    },
  );

  test('keeps a live bin update when a later live read fails', () async {
    final repository = FirebaseScanRepository(
      uid: 'resident-1',
      commandClient: _unusedClient(),
      reads: _FakeReads(
        watches: {
          'bins/BIN-004': (() {
            late StreamController<Map<String, Object?>> controller;
            controller = StreamController<Map<String, Object?>>(
              onListen: () {
                controller
                  ..add(_bin())
                  ..addError(StateError('live read interrupted'))
                  ..close();
              },
            );
            return controller.stream;
          })(),
        },
      ),
    );

    await expectLater(
      repository.watchBin('BIN-004'),
      emitsInOrder([isA<SmartBin>(), emitsDone]),
    );
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
  String stage = 'processing',
  String? draftAssetId,
  String? draftAssetVersion,
}) => {
  'id': 'session-1',
  'ownerId': ownerId,
  'binId': 'BIN-004',
  'stage': stage,
  'version': version,
  'createdAt': '2026-10-19T04:00:00Z',
  'updatedAt': '2026-10-19T04:01:00Z',
  'draftAssetId': draftAssetId,
  'draftAssetVersion': draftAssetVersion,
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

Map<String, Object?> _instructions() => {
  'id': 'default',
  'scannerTitle': 'Scan a smart bin',
  'scannerDescription': 'Scan the registered QR code.',
  'binFoundTitle': 'Smart bin found',
  'readyTitle': 'Ready to recycle?',
  'readyDescription': 'Finish your deposit.',
  'itemDetectedTitle': 'Choose your batch image',
  'itemDetectedDescription': 'Choose one image.',
  'processingTitle': 'Identifying your items',
  'processingDescription': 'The backend is analysing the image.',
  'verifiedTitle': 'Deposit verified',
  'reviewTitle': 'Deposit sent for review',
  'rejectedTitle': 'Deposit not eligible',
  'pointsTimingNotice': 'Points are added after classification.',
};

Map<String, Object?> _processingResult() => {
  'id': 'result-1',
  'ownerId': 'resident-1',
  'sessionId': 'session-1',
  'batchId': 'deposit-1',
  'outcome': 'processing',
  'pointsAwarded': null,
  'explanation': 'Your image is being checked.',
  'createdAt': '2026-10-21T03:00:00Z',
};

Map<String, Object?> _finalResult() => {
  'id': 'result-1',
  'ownerId': 'resident-1',
  'sessionId': 'session-1',
  'batchId': 'deposit-1',
  'outcome': 'verified',
  'pointsAwarded': 10,
  'explanation': 'Inspection completed.',
  'lines': [
    {
      'lineId': 'line-1',
      'class': 'plastic_bottle',
      'count': 1,
      'points': 10,
      'spaceSpc': 1,
      'eligible': true,
    },
  ],
  'policyVersion': 'policy-v1',
  'decisionVersion': 1,
  'traceId': 'trace-1',
  'createdAt': '2026-10-21T03:00:00Z',
  'updatedAt': '2026-10-21T03:00:01Z',
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
