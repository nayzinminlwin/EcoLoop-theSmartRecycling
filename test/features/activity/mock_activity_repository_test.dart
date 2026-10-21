import 'dart:async';

import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_data_store.dart';
import 'package:eco_loop/core/mock/mock_scenario.dart';
import 'package:eco_loop/core/mock/mock_seed_loader.dart';
import 'package:eco_loop/features/activity/data/mock_activity_repository.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_filter.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
import 'package:eco_loop/core/domain/material_type.dart';
import 'package:flutter_test/flutter_test.dart';

Future<MockActivityRepository> createRepository({MockApi? api}) async {
  final items = await const MockSeedLoader().loadItems(
    'assets/mock/activity/deposits.json',
  );
  return MockActivityRepository(
    deposits: items.map(DepositTransaction.fromJson).toList(),
    residentId: 'RES-000842',
    api: api,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('fixture has twelve verified deposits and derived 1.04 kg', () async {
    final repository = await createRepository();
    final summary = await repository.getSummary();
    expect(summary.verifiedDepositCount, 12);
    expect(summary.verifiedWeightKg, closeTo(1.04, 0.0001));
    final verified = await repository.getDeposits(
      filter: const DepositFilter(status: DepositStatus.verified),
    );
    expect(
      verified.fold<int>(0, (sum, item) => sum + (item.itemCount ?? 0)),
      26,
    );
    expect(
      verified.fold<int>(0, (sum, item) => sum + (item.pointsAwarded ?? 0)),
      150,
    );
    final review = await repository.getDeposits(
      filter: const DepositFilter(status: DepositStatus.review),
    );
    expect(review, hasLength(1));
    expect(review.single.pointsAwarded, isNull);
  });

  test('filters newest first and applies limit after filtering', () async {
    final repository = await createRepository();
    final result = await repository.getDeposits(
      filter: const DepositFilter(status: DepositStatus.verified),
      limit: 2,
    );
    expect(result, hasLength(2));
    expect(result.first.id, 'DEP-001');
    expect(result.last.id, 'DEP-002');
  });

  test('filter JSON preserves date and status values', () {
    final filter = DepositFilter(
      from: DateTime.parse('2024-05-01T00:00:00Z'),
      toExclusive: DateTime.parse('2024-06-01T00:00:00Z'),
      status: DepositStatus.review,
    );
    final decoded = DepositFilter.fromJson(filter.toJson());
    expect(decoded.from, filter.from);
    expect(decoded.toExclusive, filter.toExclusive);
    expect(decoded.status, DepositStatus.review);
  });

  test('read failure is asynchronous and succeeds on retry', () async {
    final api = MockApi(
      scenario: MockScenarioState(scenario: MockScenario.readFailureOnce),
      readDelay: Duration.zero,
    );
    final repository = await createRepository(api: api);
    await expectLater(repository.getSummary(), throwsA(isA<Exception>()));
    final summary = await repository.getSummary();
    expect(summary.verifiedDepositCount, 12);
  });

  test('empty scenario has zero impact', () async {
    final repository = await createRepository(
      api: MockApi(
        scenario: MockScenarioState(scenario: MockScenario.emptyActivity),
        readDelay: Duration.zero,
      ),
    );
    expect(
      (await repository.getDeposits(filter: const DepositFilter())),
      isEmpty,
    );
    final summary = await repository.getSummary();
    expect(summary.verifiedDepositCount, 0);
  });

  test('restores lines and derives mixed-material weight per line', () async {
    final transaction = DepositTransaction.fromJson({
      'id': 'mixed-1',
      'residentId': 'RES-000842',
      'sessionId': null,
      'binId': 'BIN-001',
      'binLocation': 'Test bin',
      'materialType': 'plastic',
      'materialLabel': 'Mixed',
      'itemCount': 6,
      'pointsAwarded': 0,
      'status': 'verified',
      'occurredAt': '2024-05-01T00:00:00Z',
      'verifiedAt': '2024-05-01T00:00:00Z',
      'lines': [
        {'lineId': 'plastic', 'class': 'plastic_bottle', 'eligible': true, 'count': 2, 'points': 0, 'spaceSpc': 0},
        {'lineId': 'aluminium', 'class': 'aluminium_can', 'eligible': true, 'count': 2, 'points': 0, 'spaceSpc': 0},
        {'lineId': 'paper', 'class': 'paper_item', 'eligible': true, 'count': 1, 'points': 0, 'spaceSpc': 0},
        {'lineId': 'glass', 'class': 'glass_bottle', 'eligible': true, 'count': 1, 'points': 0, 'spaceSpc': 0},
      ],
    });
    final repository = MockActivityRepository(
      deposits: [transaction],
      residentId: 'RES-000842',
    );

    expect(transaction.lines, hasLength(4));
    final summary = await repository.getSummary();
    expect(summary.acceptedItemCounts[MaterialType.plastic], 2);
    expect(summary.acceptedItemCounts[MaterialType.aluminium], 2);
    expect(summary.acceptedItemCounts[MaterialType.paper], 1);
    expect(summary.acceptedItemCounts[MaterialType.glass], 1);
    expect(summary.verifiedWeightKg, closeTo(0.33, 0.0001));
  });

  test('streams updated lifetime totals without a refresh', () async {
    final first = DepositTransaction.fromJson({
      'id': 'stream-1',
      'residentId': 'RES-000842',
      'sessionId': null,
      'binId': 'BIN-001',
      'binLocation': 'Test bin',
      'materialType': 'glass',
      'materialLabel': 'Glass',
      'itemCount': 1,
      'pointsAwarded': 10,
      'status': 'verified',
      'occurredAt': '2024-05-01T00:00:00Z',
      'verifiedAt': '2024-05-01T00:00:00Z',
    });
    final second = first.toJson()
      ..['id'] = 'stream-2'
      ..['occurredAt'] = '2024-05-02T00:00:00Z';
    final store = MockDataStore(
      profile: const {},
      wallet: const {},
      deposits: [first.toJson()],
    );
    final repository = MockActivityRepository(
      deposits: [first],
      residentId: 'RES-000842',
      store: store,
    );
    final summaries = <double>[];
    final initial = Completer<void>();
    final changed = Completer<void>();
    final subscription = repository.watchSummary().listen((summary) {
      summaries.add(summary.verifiedWeightKg);
      if (summaries.length == 1) initial.complete();
      if (summaries.length == 2) changed.complete();
    });
    await initial.future.timeout(const Duration(seconds: 1));
    await Future<void>.delayed(const Duration(milliseconds: 20));
    store.replaceDeposits([first.toJson(), second]);
    await changed.future.timeout(const Duration(seconds: 1));
    await subscription.cancel();
    expect(summaries.first, closeTo(0.2, 0.0001));
    expect(summaries.last, closeTo(0.4, 0.0001));
  });
}
