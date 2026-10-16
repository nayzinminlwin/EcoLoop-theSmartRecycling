import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_filter.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum HistoryDatePreset { all, today, lastSevenDays, thisMonth, custom }

class HistoryFilterState {
  const HistoryFilterState({
    this.datePreset = HistoryDatePreset.all,
    this.status,
    this.customFrom,
    this.customTo,
  });

  final HistoryDatePreset datePreset;
  final DepositStatus? status;
  final DateTime? customFrom;
  final DateTime? customTo;

  DepositFilter toFilter(DateTime now) {
    final day = DateTime(now.year, now.month, now.day);
    DateTime? from;
    DateTime? to;
    switch (datePreset) {
      case HistoryDatePreset.all:
        break;
      case HistoryDatePreset.today:
        from = day;
        to = day.add(const Duration(days: 1));
      case HistoryDatePreset.lastSevenDays:
        from = day.subtract(const Duration(days: 6));
        to = day.add(const Duration(days: 1));
      case HistoryDatePreset.thisMonth:
        from = DateTime(day.year, day.month);
        to = DateTime(day.year, day.month + 1);
      case HistoryDatePreset.custom:
        from = customFrom == null
            ? null
            : DateTime(customFrom!.year, customFrom!.month, customFrom!.day);
        to = customTo == null
            ? null
            : DateTime(customTo!.year, customTo!.month, customTo!.day + 1);
    }
    return DepositFilter(from: from, toExclusive: to, status: status);
  }
}

final historyControllerProvider =
    AsyncNotifierProvider<HistoryController, List<DepositTransaction>>(
      HistoryController.new,
    );

final historyFilterProvider =
    NotifierProvider<HistoryFilterNotifier, HistoryFilterState>(
      HistoryFilterNotifier.new,
    );

class HistoryFilterNotifier extends Notifier<HistoryFilterState> {
  @override
  HistoryFilterState build() => const HistoryFilterState();

  void setFilter(HistoryFilterState value) => state = value;
  void reset() => state = const HistoryFilterState();
}

class HistoryController extends AsyncNotifier<List<DepositTransaction>> {
  int _requestId = 0;

  @override
  Future<List<DepositTransaction>> build() {
    final filter = ref.read(historyFilterProvider);
    return _load(filter.toFilter(ref.read(appClockProvider).now));
  }

  Future<List<DepositTransaction>> _load(DepositFilter filter) async {
    final repository = await ref.read(activityRepositoryProvider.future);
    return repository.getDeposits(filter: filter);
  }

  Future<void> apply(HistoryFilterState filter) async {
    final requestId = ++_requestId;
    final previous = state.valueOrNull;
    state = const AsyncLoading();
    ref.read(historyFilterProvider.notifier).setFilter(filter);
    try {
      final result = await _load(
        filter.toFilter(ref.read(appClockProvider).now),
      );
      if (requestId == _requestId) state = AsyncData(result);
    } catch (error, stackTrace) {
      if (requestId == _requestId) {
        state = previous == null
            ? AsyncError(error, stackTrace)
            : AsyncData(previous);
      }
      rethrow;
    }
  }

  Future<void> refresh() async {
    final filter = ref.read(historyFilterProvider);
    await apply(filter);
  }
}
