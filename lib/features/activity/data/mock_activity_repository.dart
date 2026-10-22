// ignore_for_file: prefer_initializing_formals

import 'dart:async';

import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_data_store.dart';
import 'package:eco_loop/core/mock/mock_scenario.dart';
import 'package:eco_loop/core/domain/material_weight_constants.dart';
import 'package:eco_loop/core/domain/material_type.dart';

import '../domain/models/deposit_filter.dart';
import '../domain/models/deposit_transaction.dart';
import '../domain/models/recycling_summary.dart';
import '../domain/repositories/activity_repository.dart';

class MockActivityRepository implements ActivityRepository {
  MockActivityRepository({
    required List<DepositTransaction> deposits,
    required String residentId,
    MockDataStore? store,
    MockApi? api,
  }) : _deposits = List.unmodifiable(deposits),
       _residentId = residentId,
       _store = store,
       _api = api ?? MockApi();

  final List<DepositTransaction> _deposits;
  final String _residentId;
  final MockDataStore? _store;
  final MockApi _api;

  List<DepositTransaction> _current() {
    if (_store == null || _store.deposits.isEmpty) return _deposits;
    return _store.deposits
        .map(DepositTransaction.fromJson)
        .toList(growable: false);
  }

  List<DepositTransaction> _filtered(DepositFilter filter, int? limit) {
    filter.validate();
    final result =
        _current()
            .where((item) => item.residentId == _residentId)
            .where(
              (item) => filter.status == null || item.status == filter.status,
            )
            .where(
              (item) =>
                  filter.from == null ||
                  !item.occurredAt.isBefore(filter.from!),
            )
            .where(
              (item) =>
                  filter.toExclusive == null ||
                  item.occurredAt.isBefore(filter.toExclusive!),
            )
            .toList()
          ..sort((a, b) {
            final date = b.occurredAt.compareTo(a.occurredAt);
            return date == 0 ? b.id.compareTo(a.id) : date;
          });
    return limit == null ? result : result.take(limit).toList();
  }

  List<DepositTransaction> _readDeposits(DepositFilter filter, int? limit) {
    if (_api.scenario.scenario == MockScenario.emptyActivity) {
      return <DepositTransaction>[];
    }
    return _filtered(filter, limit);
  }

  RecyclingSummary _readSummary() {
    if (_api.scenario.scenario == MockScenario.emptyActivity) {
      return const RecyclingSummary(
        verifiedDepositCount: 0,
        verifiedWeightKg: 0,
      );
    }
    final verified = _current().where(
      (item) =>
          item.residentId == _residentId &&
          item.status == DepositStatus.verified,
    );
    final acceptedItemCounts = <MaterialType, int>{
      for (final type in MaterialType.values) type: 0,
    };
    for (final item in verified) {
      if (item.lines.isEmpty) {
        acceptedItemCounts[item.materialType] =
            (acceptedItemCounts[item.materialType] ?? 0) + item.acceptedItemCount;
        continue;
      }
      for (final line in item.lines) {
        if (!line.eligible) continue;
        acceptedItemCounts[line.materialType] =
            (acceptedItemCounts[line.materialType] ?? 0) + line.acceptedCount;
      }
    }
    final verifiedWeightKg = acceptedItemCounts.entries.fold<double>(
      0,
      (sum, entry) => sum + MaterialWeightConstants.getWeightKg(
        entry.key,
        entry.value,
      ),
    );
    return RecyclingSummary(
      verifiedDepositCount: verified.length,
      verifiedWeightKg: verifiedWeightKg,
      acceptedItemCounts: acceptedItemCounts,
    );
  }

  @override
  Future<List<DepositTransaction>> getDeposits({
    required DepositFilter filter,
    int? limit,
  }) => _api.read('activity.getDeposits', () {
    return _readDeposits(filter, limit);
  });

  @override
  Future<RecyclingSummary> getSummary() =>
      _api.read('activity.getSummary', _readSummary);

  @override
  Stream<List<DepositTransaction>> watchDeposits({
    required DepositFilter filter,
    int? limit,
  }) async* {
    yield await _api.read(
      'activity.watchDeposits',
      () => _readDeposits(filter, limit),
    );
    if (_store != null) {
      await for (final _ in _store.watchDeposits()) {
        yield await getDeposits(filter: filter, limit: limit);
      }
    }
  }

  @override
  Stream<RecyclingSummary> watchSummary() async* {
    yield await _api.read('activity.watchSummary', _readSummary);
    if (_store != null) {
      await for (final _ in _store.watchDeposits()) {
        yield await getSummary();
      }
    }
  }

  @override
  Future<ActivityPage> getDepositsPage({
    required DepositFilter filter,
    int? limit,
    ActivityCursor? after,
  }) async {
    final items = _filtered(filter, null)
        .where((item) => after == null || _isAfter(item, after))
        .toList(growable: false);
    final page = limit == null ? items : items.take(limit).toList();
    return ActivityPage(
      items: page,
      nextCursor: limit != null && page.length == limit && page.isNotEmpty
          ? ActivityCursor(occurredAt: page.last.occurredAt, id: page.last.id)
          : null,
    );
  }

  @override
  Stream<ActivityPage> watchDepositsPage({
    required DepositFilter filter,
    int? limit,
    ActivityCursor? after,
  }) async* {
    yield await getDepositsPage(filter: filter, limit: limit, after: after);
    if (_store != null) {
      await for (final _ in _store.watchDeposits()) {
        yield await getDepositsPage(filter: filter, limit: limit, after: after);
      }
    }
  }

  static bool _isAfter(DepositTransaction item, ActivityCursor cursor) {
    final date = item.occurredAt.compareTo(cursor.occurredAt);
    return date < 0 || (date == 0 && item.id.compareTo(cursor.id) < 0);
  }
}
