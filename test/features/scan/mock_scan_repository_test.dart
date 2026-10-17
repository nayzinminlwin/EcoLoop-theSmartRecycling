import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_scenario.dart';
import 'package:eco_loop/features/scan/data/mock_scan_repository.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_result.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_session.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../fixtures/mock_scan_store.dart';

MockApi zeroApi({MockScenarioState? scenario}) => MockApi(
  scenario: scenario,
  readDelay: Duration.zero,
  writeDelay: Duration.zero,
  classificationDelay: Duration.zero,
);

void main() {
  test('scan completion commits wallet, deposit, capacity, session, and result atomically', () async {
    final store = buildScanStore();
    final repository = MockScanRepository(store: store, api: zeroApi());

    final bin = await repository.lookupBin(await repository.getDemoQrPayload());
    final session = await repository.createSession(bin.id, 'request-1');
    await repository.confirmSession(session.id);
    await repository.reportFinishPressed(session.id);
    final processing = await repository.startVerification(session.id);
    final completed = await repository.completeVerification(processing.id);

    expect(completed.stage, ScanStage.completed);
    expect(completed.resultId, isNotNull);

    final wallet = store.wallet['wallet'] as Map;
    expect(wallet['balance'], 255);
    expect(wallet['version'], 2);

    expect(store.deposits, hasLength(2));
    final row = store.deposits.last;
    expect(row['pointsAwarded'], 10);
    expect(row['status'], 'verified');
    expect(row['sessionId'], session.id);
    expect(row['binId'], 'BIN-004');

    expect((store.bins.single['capacityPercent'] as num).toInt(), 85);

    final result = await repository.getResult(completed.resultId!);
    expect(result.outcome, DepositOutcome.verified);
    expect(result.itemCount, 2);
    expect(result.pointsAwarded, 10);
  });

  test(
    'replay and duplicate completion calls never duplicate credit',
    () async {
      final store = buildScanStore();
      final repository = MockScanRepository(store: store, api: zeroApi());

      final bin = await repository.lookupBin(
        await repository.getDemoQrPayload(),
      );
      final session = await repository.createSession(bin.id, 'request-1');
      await repository.confirmSession(session.id);
      await repository.reportFinishPressed(session.id);
      final processing = await repository.startVerification(session.id);

      final completions = await Future.wait([
        repository.completeVerification(processing.id),
        repository.completeVerification(processing.id),
      ]);
      final repeated = await repository.completeVerification(processing.id);

      expect(completions[1].resultId, completions.first.resultId);
      expect(repeated.resultId, completions.first.resultId);
      final wallet = store.wallet['wallet'] as Map;
      expect(wallet['balance'], 255);
      expect(store.deposits, hasLength(2));
      expect((store.bins.single['capacityPercent'] as num).toInt(), 85);
    },
  );

  test('changing a configured count/rate changes earned points', () async {
    final store = buildScanStore(
      classification: const {
        'id': 'baseline',
        'materialType': 'plastic',
        'materialLabel': 'PET plastic bottles',
        'itemCount': 3,
        'outcome': 'verified',
        'explanation': 'Three recyclable PET plastic bottles were verified.',
        'capacityIncreasePercent': 20,
      },
      pointsPerItem: 6,
    );
    final repository = MockScanRepository(store: store, api: zeroApi());

    final bin = await repository.lookupBin(await repository.getDemoQrPayload());
    final session = await repository.createSession(bin.id, 'request-1');
    await repository.confirmSession(session.id);
    await repository.reportFinishPressed(session.id);
    final processing = await repository.startVerification(session.id);
    final completed = await repository.completeVerification(processing.id);

    final result = await repository.getResult(completed.resultId!);
    expect(result.pointsAwarded, 18);
    expect((store.wallet['wallet'] as Map)['balance'], 245 + 18);
  });

  test(
    'review and rejected scenarios create labeled activity without credit',
    () async {
      Future<void> runScenario(
        MockScenario scenario,
        String expectedStatus,
        Object? expectedPoints,
      ) async {
        final store = buildScanStore();
        final repository = MockScanRepository(
          store: store,
          api: zeroApi(scenario: MockScenarioState(scenario: scenario)),
        );
        final bin = await repository.lookupBin(
          await repository.getDemoQrPayload(),
        );
        final session = await repository.createSession(bin.id, 'request-1');
        await repository.confirmSession(session.id);
        await repository.reportFinishPressed(session.id);
        final processing = await repository.startVerification(session.id);
        final completed = await repository.completeVerification(processing.id);
        final result = await repository.getResult(completed.resultId!);

        final wallet = store.wallet['wallet'] as Map;
        expect(wallet['balance'], 245);
        expect(result.pointsAwarded, expectedPoints);
        expect(store.deposits.last['status'], expectedStatus);
        expect(store.deposits.last['verifiedAt'], isNull);
        expect((store.bins.single['capacityPercent'] as num).toInt(), 85);
      }

      await runScenario(MockScenario.reviewDeposit, 'review', null);
      await runScenario(MockScenario.rejectedDeposit, 'rejected', 0);
    },
  );

  test('invalid QR, full bin, and offline bins fail distinctly', () async {
    final fullStore = buildScanStore(capacityPercent: 100);
    final fullRepository = MockScanRepository(store: fullStore, api: zeroApi());
    await expectLater(
      fullRepository.lookupBin('ecoloop://bin/BIN-004'),
      throwsA(
        isA<AppFailure>()
            .having((f) => f.code, 'code', AppFailureCodes.binUnavailable)
            .having((f) => f.messageKey, 'messageKey', 'scan.binFull'),
      ),
    );
    await expectLater(
      fullRepository.createSession('BIN-004', 'request-full'),
      throwsA(
        isA<AppFailure>().having(
          (f) => f.messageKey,
          'messageKey',
          'scan.binFull',
        ),
      ),
    );

    final offlineStore = buildScanStore(isOnline: false);
    final offlineRepository = MockScanRepository(
      store: offlineStore,
      api: zeroApi(),
    );
    await expectLater(
      offlineRepository.lookupBin('ecoloop://bin/BIN-004'),
      throwsA(
        isA<AppFailure>()
            .having((f) => f.code, 'code', AppFailureCodes.binUnavailable)
            .having((f) => f.retryable, 'retryable', isTrue),
      ),
    );

    final repository = MockScanRepository(
      store: buildScanStore(),
      api: zeroApi(),
    );
    await expectLater(
      repository.lookupBin('https://example.com/other'),
      throwsA(
        isA<AppFailure>().having(
          (f) => f.code,
          'code',
          AppFailureCodes.invalidQr,
        ),
      ),
    );
    await expectLater(
      repository.lookupBin('ecoloop://bin/BIN-999'),
      throwsA(
        isA<AppFailure>().having(
          (f) => f.code,
          'code',
          AppFailureCodes.invalidQr,
        ),
      ),
    );
  });

  test('injected completion failure leaves datasets unchanged and retry commits once', () async {
    final store = buildScanStore();
    final repository = MockScanRepository(
      store: store,
      api: zeroApi(
        scenario: MockScenarioState(
          writeFailuresOnce: {'scan.completeVerification'},
        ),
      ),
    );

    final bin = await repository.lookupBin(await repository.getDemoQrPayload());
    final session = await repository.createSession(bin.id, 'request-1');
    await repository.confirmSession(session.id);
    await repository.reportFinishPressed(session.id);
    final processing = await repository.startVerification(session.id);

    await expectLater(
      repository.completeVerification(processing.id),
      throwsA(isA<AppFailure>()),
    );
    final wallet = store.wallet['wallet'] as Map;
    expect(wallet['balance'], 245);
    expect(store.deposits, hasLength(1));
    expect((store.bins.single['capacityPercent'] as num).toInt(), 65);
    expect(
      repository.getSession(processing.id).then((s) => s.stage),
      completion(ScanStage.processing),
    );

    final completed = await repository.completeVerification(processing.id);
    expect(completed.stage, ScanStage.completed);
    expect((store.wallet['wallet'] as Map)['balance'], 255);
    expect(store.deposits, hasLength(2));
  });

  test('cancellation only works before processing and persists', () async {
    final store = buildScanStore();
    final repository = MockScanRepository(store: store, api: zeroApi());
    final bin = await repository.lookupBin(await repository.getDemoQrPayload());
    final session = await repository.createSession(bin.id, 'request-1');

    final cancelled = await repository.cancelSession(session.id);
    expect(cancelled.stage, ScanStage.cancelled);
    expect(
      repository.getSession(session.id).then((s) => s.stage),
      completion(ScanStage.cancelled),
    );

    // A cancelled session cannot be resumed or cancelled-then-reused.
    await expectLater(
      repository.confirmSession(session.id),
      throwsA(
        isA<AppFailure>().having(
          (f) => f.messageKey,
          'messageKey',
          'scan.invalidTransition',
        ),
      ),
    );
    await expectLater(
      repository.cancelSession(session.id).then((s) => s.stage),
      completion(ScanStage.cancelled),
    );
  });

  test(
    'full-bin scenario makes the bin unavailable for new sessions',
    () async {
      final store = buildScanStore();
      final repository = MockScanRepository(
        store: store,
        api: zeroApi(
          scenario: MockScenarioState(scenario: MockScenario.fullBin),
        ),
      );
      await expectLater(
        repository.lookupBin(await repository.getDemoQrPayload()),
        throwsA(
          isA<AppFailure>().having(
            (f) => f.messageKey,
            'messageKey',
            'scan.binFull',
          ),
        ),
      );
    },
  );
}
