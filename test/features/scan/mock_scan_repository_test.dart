import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/features/scan/data/mock_scan_repository.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_session.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('scan documents round-trip and happy path is idempotent', () async {
    final repository = MockScanRepository(
      api: MockApi(
        readDelay: Duration.zero,
        writeDelay: Duration.zero,
        classificationDelay: Duration.zero,
      ),
    );
    final payload = await repository.getDemoQrPayload();
    final bin = await repository.lookupBin(payload);
    final first = await repository.createSession(bin.id, 'request-1');
    expect(await repository.createSession(bin.id, 'request-1'), first);
    final ready = await repository.confirmSession(first.id);
    final detected = await repository.reportFinishPressed(ready.id);
    final processing = await repository.startVerification(detected.id);
    final completions = await Future.wait([
      repository.completeVerification(processing.id),
      repository.completeVerification(processing.id),
    ]);
    final completed = completions.first;
    final repeated = await repository.completeVerification(processing.id);

    expect(completed.stage, ScanStage.completed);
    expect(completed.resultId, isNotNull);
    expect(completions[1].resultId, completed.resultId);
    expect(repeated.resultId, completed.resultId);
    expect((await repository.getResult(completed.resultId!)).pointsAwarded, 10);
    expect((await repository.getBin(bin.id)).capacityPercent, 85);
  });

  test('invalid transitions and cancellation do not skip stages', () async {
    final repository = MockScanRepository(
      api: MockApi(readDelay: Duration.zero, writeDelay: Duration.zero),
    );
    final bin = await repository.lookupBin(await repository.getDemoQrPayload());
    final session = await repository.createSession(bin.id, 'request-2');
    expect(
      () => repository.startVerification(session.id),
      throwsA(isA<Object>()),
    );
    final cancelled = await repository.cancelSession(session.id);
    expect(cancelled.stage, ScanStage.cancelled);
  });
}
