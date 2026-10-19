import 'dart:async';

import 'package:eco_loop/features/activity/data/firebase_activity_repository.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_filter.dart';
import 'package:eco_loop/features/activity/domain/repositories/activity_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('uses owner filters and preserves a timestamp/id cursor', () async {
    final reads = _FakeReads([
      ActivityRawPage(
        rows: [_row('batch-2', '2026-10-19T04:02:00Z')],
        nextCursor: ActivityCursor(
          occurredAt: DateTime.parse('2026-10-19T04:02:00Z'),
          id: 'batch-2',
        ),
      ),
    ]);
    final repository = FirebaseActivityRepository(
      uid: 'resident-1',
      reads: reads,
    );

    final page = await repository.getDepositsPage(
      filter: const DepositFilter(),
      limit: 1,
    );

    expect(reads.uid, 'resident-1');
    expect(reads.limit, 1);
    expect(page.items.single.id, 'batch-2');
    expect(page.nextCursor?.id, 'batch-2');
  });

  test(
    'merges a newer decision for the same batch without duplicates',
    () async {
      final controller = StreamController<ActivityRawPage>();
      final reads = _FakeReads([], stream: controller.stream);
      final repository = FirebaseActivityRepository(
        uid: 'resident-1',
        reads: reads,
      );
      final values = <ActivityPage>[];
      final subscription = repository
          .watchDepositsPage(filter: const DepositFilter(), limit: 10)
          .listen(values.add);

      controller.add(
        ActivityRawPage(
          rows: [_row('batch-1', '2026-10-19T04:00:00Z', version: 1)],
        ),
      );
      controller.add(
        ActivityRawPage(
          rows: [_row('batch-1', '2026-10-19T04:01:00Z', version: 2)],
        ),
      );
      await Future<void>.delayed(Duration.zero);

      expect(values, hasLength(2));
      expect(values.last.items, hasLength(1));
      expect(values.last.items.single.decisionVersion, 2);
      await subscription.cancel();
      await controller.close();
    },
  );
}

Map<String, Object?> _row(String id, String updatedAt, {int version = 1}) => {
  'id': id,
  'ownerId': 'resident-1',
  'sessionId': 'session-1',
  'binId': 'bin-1',
  'binLocation': 'Test bin',
  'lines': [
    {
      'lineId': 'line-1',
      'class': 'plastic_bottle',
      'eligible': true,
      'count': 1,
      'points': 1,
      'spaceSpc': 1,
    },
  ],
  'status': version == 1 ? 'processing' : 'verified',
  'updatedAt': updatedAt,
  'totalDetectedObjectCount': 1,
  'pointsAwarded': version == 1 ? null : 1,
  'traceId': '0123456789abcdef0123456789abcdef',
  'decisionVersion': version,
};

class _FakeReads implements ActivityReadTransport {
  _FakeReads(this.pages, {this.stream});

  final List<ActivityRawPage> pages;
  final Stream<ActivityRawPage>? stream;
  String? uid;
  int? limit;

  @override
  Future<ActivityRawPage> readPage({
    required String uid,
    required DepositFilter filter,
    required int limit,
    ActivityCursor? after,
  }) async {
    this.uid = uid;
    this.limit = limit;
    return pages.single;
  }

  @override
  Stream<ActivityRawPage> watchPage({
    required String uid,
    required DepositFilter filter,
    required int limit,
  }) {
    this.uid = uid;
    this.limit = limit;
    return stream ?? const Stream.empty();
  }
}
