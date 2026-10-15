// ignore_for_file: prefer_initializing_formals

import 'dart:async';

import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_data_store.dart';
import 'package:eco_loop/core/mock/mock_scenario.dart';

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
    if (_store == null) return _deposits;
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
    return RecyclingSummary(
      verifiedDepositCount: verified.length,
      verifiedWeightKg: verified.fold<double>(
        0,
        (sum, item) => sum + item.weightKg,
      ),
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
}
