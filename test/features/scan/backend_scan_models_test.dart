import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_session.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_result.dart';
import 'package:eco_loop/features/scan/domain/models/simulation_asset.dart';
import 'package:eco_loop/features/scan/domain/models/smart_bin.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses backend bin raw SPC and clamped display projection', () {
    final bin = SmartBin.fromBackendJson({
      'kind': 'bin',
      'schemaVersion': 'backend.v1',
      'binId': 'BIN-004',
      'locationName': 'Cedar Residence',
      'locationDetail': 'Ground Floor',
      'capacitySpc': 100,
      'occupiedSpc': 61,
      'acceptedMaterials': ['plastic', 'aluminium'],
      'isOnline': true,
      'enabled': true,
      'cycleId': 'cycle-1',
      'updatedAt': '2026-10-19T04:00:00Z',
    });

    expect(bin.capacitySpc, 100);
    expect(bin.occupiedSpc, 61);
    expect(bin.capacityPercent, 61);
    expect(bin.cycleId, 'cycle-1');
    expect(bin.enabled, isTrue);
  });

  test('parses committed session references and completed review safely', () {
    final session = DepositSession.fromBackendJson({
      'kind': 'session',
      'schemaVersion': 'backend.v1',
      'sessionId': 'session-1',
      'ownerId': 'resident-1',
      'binId': 'BIN-004',
      'stage': 'completed',
      'creationRequestId': 'request-1',
      'version': 4,
      'createdAt': '2026-10-19T04:00:00Z',
      'updatedAt': '2026-10-19T04:01:00Z',
      'draftAssetId': 'asset-1',
      'draftAssetVersion': 'v1',
      'assetId': 'asset-1',
      'assetVersion': 'v1',
      'assetContentSha256': 'a' * 64,
      'batchId': 'batch-1',
      'jobId': 'job-1',
      'jobSubstage': 'settled',
      'progress': {
        'phase': 'finalizing',
        'activity': 'Saving your result',
        'revision': 7,
        'attemptNumber': 1,
        'completedStages': ['validating', 'detecting'],
        'submissionAt': '2026-10-19T04:00:00Z',
        'stageStartedAt': '2026-10-19T04:01:00Z',
        'updatedAt': '2026-10-19T04:01:00Z',
        'deadlineAt': '2026-10-19T04:05:00Z',
      },
      'deadlineAt': '2026-10-19T04:05:00Z',
      'reservationExpiresAt': null,
      'resultId': 'result-1',
      'terminationReason': null,
    });

    expect(session.stage, ScanStage.completed);
    expect(session.sessionVersion, 4);
    expect(session.committedAssetSha256, 'a' * 64);
    expect(session.jobSubstage, 'settled');
    expect(session.deadlineAt, isNotNull);
    expect(session.progress?.revision, 7);
    expect(session.progress?.phase, 'finalizing');
  });

  test('parses immutable asset metadata and nullable digest', () {
    final asset = SimulationAsset.fromBackendJson({
      'kind': 'asset',
      'schemaVersion': 'backend.v1',
      'assetId': 'asset-1',
      'enabled': true,
      'sortOrder': 1,
      'version': 'v1',
      'storageReference': 'simulation-assets/asset-1/v1.png',
      'mimeType': 'image/png',
      'width': 1200,
      'height': 900,
      'contentSha256': 'a' * 64,
    });

    expect(asset.contentSha256, 'a' * 64);
    expect(asset.width, 1200);
  });

  test('parses a processing result without final-only fields', () {
    final result = DepositResult.fromBackendJson({
      'id': 'result-1',
      'sessionId': 'session-1',
      'batchId': 'deposit-1',
      'outcome': 'processing',
      'pointsAwarded': null,
      'explanation': 'Your image is being checked.',
      'createdAt': '2026-10-21T03:00:00Z',
    });

    expect(result.outcome, DepositOutcome.processing);
    expect(result.pointsAwarded, isNull);
    expect(result.policyVersion, isNull);
    expect(result.traceId, isNull);
  });

  test('unsupported backend snapshots fail safely', () {
    expect(
      () => SmartBin.fromBackendJson({
        'kind': 'bin',
        'schemaVersion': 'backend.v1',
        'binId': 'BIN-004',
        'locationName': 'Cedar Residence',
        'locationDetail': 'Ground Floor',
        'capacitySpc': 100,
        'occupiedSpc': 10,
        'acceptedMaterials': ['future_material'],
        'isOnline': true,
        'enabled': true,
        'cycleId': 'cycle-1',
        'updatedAt': '2026-10-19T04:00:00Z',
      }),
      throwsA(isA<AppFailure>()),
    );
    expect(
      () => DepositSession.fromBackendJson({
        'kind': 'session',
        'schemaVersion': 'backend.v1',
        'sessionId': 'session-1',
        'ownerId': 'resident-1',
        'binId': 'BIN-004',
        'stage': 'future-stage',
        'creationRequestId': 'request-1',
        'version': 1,
        'createdAt': '2026-10-19T04:00:00Z',
        'updatedAt': '2026-10-19T04:00:00Z',
      }),
      throwsA(isA<AppFailure>()),
    );
  });
}
