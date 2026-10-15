import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_scenario.dart';
import 'package:eco_loop/core/mock/mock_seed_loader.dart';
import 'package:eco_loop/features/activity/data/mock_activity_repository.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_filter.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
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

  test('fixture has twelve verified deposits and 3.2 kg', () async {
    final repository = await createRepository();
    final summary = await repository.getSummary();
    expect(summary.verifiedDepositCount, 12);
    expect(summary.verifiedWeightKg, closeTo(3.2, 0.0001));
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
}
