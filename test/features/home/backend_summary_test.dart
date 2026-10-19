import 'package:eco_loop/features/activity/data/firebase_activity_repository.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_filter.dart';
import 'package:eco_loop/features/activity/domain/repositories/activity_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'residentStats summary derives estimated weight from accepted counts',
    () async {
      final stats = _Stats({
        'verifiedBatchCount': 1,
        'acceptedItemCounts': {
          'plastic': 2,
          'aluminium': 3,
          'paper': 1,
          'glass': 0,
        },
      });
      final repository = FirebaseActivityRepository(
        uid: 'resident-1',
        reads: _NoopActivityReads(),
        stats: stats,
      );

      final summary = await repository.getSummary();

      expect(summary.verifiedDepositCount, 1);
      expect(summary.acceptedItemCounts.values, contains(2));
      expect(summary.verifiedWeightKg, closeTo(0.145, 0.0001));
    },
  );
}

class _Stats implements StatsReadTransport {
  _Stats(this.value);
  final Map<String, Object?> value;
  @override
  Future<Map<String, Object?>?> read(String uid) async => value;
  @override
  Stream<Map<String, Object?>> watch(String uid) => Stream.value(value);
}

class _NoopActivityReads implements ActivityReadTransport {
  @override
  Future<ActivityRawPage> readPage({
    required String uid,
    required DepositFilter filter,
    required int limit,
    ActivityCursor? after,
  }) async => const ActivityRawPage(rows: []);

  @override
  Stream<ActivityRawPage> watchPage({
    required String uid,
    required DepositFilter filter,
    required int limit,
  }) => const Stream.empty();
}
