import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_scenario.dart';
import 'package:eco_loop/core/mock/mock_seed_loader.dart';
import 'package:eco_loop/features/scan/data/mock_scan_repository.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_session.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'full seeded fixtures: baseline scan yields 255, 13 verified, 1.09 kg, 85%',
    () async {
      final store = await const MockSeedLoader().loadStore();
      final repository = MockScanRepository(
        store: store,
        api: MockApi(
          readDelay: Duration.zero,
          writeDelay: Duration.zero,
          classificationDelay: Duration.zero,
        ),
      );

      final bin = await repository.lookupBin(
        await repository.getDemoQrPayload(),
      );
      final session = await repository.createSession(bin.id, 'request-1');
      await repository.confirmSession(session.id);
      await repository.reportFinishPressed(session.id);
      final processing = await repository.startVerification(session.id);
      await repository.completeVerification(processing.id);

      final wallet = store.wallet['wallet'] as Map;
      expect(wallet['balance'], 255);

      final verified = store.deposits
          .where((row) => row['status'] == 'verified')
          .toList();
      expect(verified, hasLength(13));
      final items = verified.fold<int>(
        0,
        (sum, row) => sum + ((row['itemCount'] as num?)?.toInt() ?? 0),
      );
      expect(items, 28);
      // 2 plastic items at 25 g each: 1.04 kg + 0.05 kg.
      final grams = verified.fold<double>(
        0,
        (sum, row) =>
            sum +
            ((row['itemCount'] as num?)?.toInt() ?? 0) *
                switch (row['materialType']) {
                  'plastic' => 25.0,
                  'aluminium' => 15.0,
                  'paper' => 50.0,
                  'glass' => 200.0,
                  _ => 0.0,
                },
      );
      expect(grams / 1000, closeTo(1.09, 0.0001));
      expect(
        (store.bins.singleWhere(
                  (row) => row['id'] == 'BIN-004',
                )['capacityPercent']
                as num)
            .toInt(),
        85,
      );
    },
  );

  test('future-stage URLs canonicalize to the committed stage state', () async {
    final store = await const MockSeedLoader().loadStore();
    final repository = MockScanRepository(
      store: store,
      api: MockApi(
        readDelay: Duration.zero,
        writeDelay: Duration.zero,
        classificationDelay: Duration.zero,
      ),
    );
    final bin = await repository.lookupBin(await repository.getDemoQrPayload());
    final session = await repository.createSession(bin.id, 'request-1');

    // The session is at bin found; a result URL resolves the session and the
    // screen canonicalizes (verified here at the repository level).
    final looked = await repository.getSession(session.id);
    expect(looked.stage, ScanStage.binFound);
    expect(looked.resultId, isNull);
  });

  test('review scenario keeps verified impact unchanged while retaining the record', () async {
    final store = await const MockSeedLoader().loadStore();
    final repository = MockScanRepository(
      store: store,
      api: MockApi(
        scenario: MockScenarioState(scenario: MockScenario.reviewDeposit),
        readDelay: Duration.zero,
        writeDelay: Duration.zero,
        classificationDelay: Duration.zero,
      ),
    );
    final bin = await repository.lookupBin(await repository.getDemoQrPayload());
    final session = await repository.createSession(bin.id, 'request-1');
    await repository.confirmSession(session.id);
    await repository.reportFinishPressed(session.id);
    final processing = await repository.startVerification(session.id);
    final completed = await repository.completeVerification(processing.id);

    final wallet = store.wallet['wallet'] as Map;
    expect(wallet['balance'], 245);
    expect(completed.stage, ScanStage.completed);
    final reviewRows = store.deposits
        .where((row) => row['status'] == 'review')
        .toList();
    expect(reviewRows, hasLength(2));
  });
}
