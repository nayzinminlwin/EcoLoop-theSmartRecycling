import 'dart:async';

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

class HistoryViewData {
  const HistoryViewData({required this.items, this.refreshFailed = false});

  final List<DepositTransaction> items;
  final bool refreshFailed;
}

final historyControllerProvider =
    AsyncNotifierProvider<HistoryController, HistoryViewData>(
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

/// Observes the committed activity projection for the selected filter.
///
/// A filter change re-runs [build], cancelling the previous subscription;
/// events from superseded subscriptions are ignored by generation count.
/// Stream failures after the first projection keep the last visible content
/// and surface an inline refresh failure instead of an error screen.
class HistoryController extends AsyncNotifier<HistoryViewData> {
  StreamSubscription<List<DepositTransaction>>? _subscription;
  int _generation = 0;

  @override
  Future<HistoryViewData> build() async {
    final filterState = ref.watch(historyFilterProvider);
    final clock = ref.watch(appClockProvider);
    final repository = await ref.watch(activityRepositoryProvider.future);
    final filter = filterState.toFilter(clock.now);

    final generation = ++_generation;
    ref.onDispose(() {
      _subscription?.cancel();
      _subscription = null;
    });

    final firstValue = Completer<HistoryViewData>();
    _subscription = repository
        .watchDeposits(filter: filter)
        .listen(
          (items) {
            if (generation != _generation) return;
            final data = HistoryViewData(items: List.unmodifiable(items));
            if (!firstValue.isCompleted) {
              firstValue.complete(data);
            } else {
              state = AsyncData(data);
            }
          },
          onError: (Object error, StackTrace stackTrace) {
            if (generation != _generation) return;
            final previous = state.valueOrNull;
            if (!firstValue.isCompleted) {
              firstValue.completeError(error, stackTrace);
            } else if (previous != null) {
              state = AsyncData(
                HistoryViewData(items: previous.items, refreshFailed: true),
              );
            } else {
              state = AsyncError(error, stackTrace);
            }
          },
        );
    return firstValue.future;
  }

  Future<void> apply(HistoryFilterState filter) async {
    ref.read(historyFilterProvider.notifier).setFilter(filter);
  }

  Future<void> refresh() async {
    ref.invalidateSelf();
  }
}
