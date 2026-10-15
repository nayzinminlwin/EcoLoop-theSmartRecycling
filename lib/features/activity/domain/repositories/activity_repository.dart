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
}
