import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
import 'package:eco_loop/features/activity/presentation/controllers/history_controller.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('custom range uses calendar-day exclusive end boundary', () {
    final filter = HistoryFilterState(
      datePreset: HistoryDatePreset.custom,
      customFrom: DateTime(2024, 5, 7, 18),
      customTo: DateTime(2024, 5, 9, 9),
      status: DepositStatus.verified,
    ).toFilter(DateTime(2024, 5, 20));

    expect(filter.from, DateTime(2024, 5, 7));
    expect(filter.toExclusive, DateTime(2024, 5, 10));
    expect(filter.status, DepositStatus.verified);
  });
}
