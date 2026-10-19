import 'package:eco_loop/features/scan/domain/models/deposit_session.dart';
import 'package:eco_loop/features/scan/presentation/controllers/scan_controller.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

void main() {
  test('session resume state ignores older cached revisions', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final controller = container.read(activeScanSessionProvider.notifier);

    controller.track(_session(stage: ScanStage.itemDetected, version: 4));
    controller.track(_session(stage: ScanStage.ready, version: 3));

    expect(
      container.read(activeScanSessionProvider)?.stage,
      ScanStage.itemDetected,
    );
    expect(container.read(activeScanSessionProvider)?.sessionVersion, 4);

    controller.track(_session(stage: ScanStage.processing, version: 5));
    expect(
      container.read(activeScanSessionProvider)?.stage,
      ScanStage.processing,
    );
  });

  test('clearing a completed session does not clear a replacement session', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final controller = container.read(activeScanSessionProvider.notifier);

    controller.track(_session(id: 'session-a', version: 1));
    controller.track(_session(id: 'session-b', version: 1));
    controller.clearIf('session-a');

    expect(container.read(activeScanSessionProvider)?.sessionId, 'session-b');
    controller.clearIf('session-b');
    expect(container.read(activeScanSessionProvider), isNull);
  });
}

DepositSession _session({
  String id = 'session-a',
  ScanStage stage = ScanStage.ready,
  int version = 1,
}) {
  final timestamp = DateTime.utc(2026, 10, 19);
  return DepositSession(
    id: id,
    residentId: 'RES-000842',
    binId: 'bin-1',
    stage: stage,
    createdAt: timestamp,
    updatedAt: timestamp,
    creationRequestId: 'request-1',
    sessionVersion: version,
  );
}
