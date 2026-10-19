import '../models/deposit_filter.dart';
import '../models/deposit_transaction.dart';
import '../models/recycling_summary.dart';

abstract interface class ActivityRepository {
  Future<List<DepositTransaction>> getDeposits({
    required DepositFilter filter,
    int? limit,
  });
  Future<RecyclingSummary> getSummary();
  Stream<List<DepositTransaction>> watchDeposits({
    required DepositFilter filter,
    int? limit,
  });
  Stream<RecyclingSummary> watchSummary();

  Future<ActivityPage> getDepositsPage({
    required DepositFilter filter,
    int? limit,
    ActivityCursor? after,
  }) async {
    final items = await getDeposits(filter: filter, limit: limit);
    return ActivityPage(items: items);
  }

  Stream<ActivityPage> watchDepositsPage({
    required DepositFilter filter,
    int? limit,
    ActivityCursor? after,
  }) async* {
    await for (final items in watchDeposits(filter: filter, limit: limit)) {
      yield ActivityPage(items: items);
    }
  }
}

class ActivityCursor {
  const ActivityCursor({required this.occurredAt, required this.id});

  final DateTime occurredAt;
  final String id;
}

class ActivityPage {
  const ActivityPage({required this.items, this.nextCursor});

  final List<DepositTransaction> items;
  final ActivityCursor? nextCursor;

  bool get hasMore => nextCursor != null;
}
