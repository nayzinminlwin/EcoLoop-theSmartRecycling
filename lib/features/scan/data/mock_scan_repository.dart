// ignore_for_file: prefer_initializing_formals

import 'dart:async';

import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/core/domain/material_type.dart';
import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_data_store.dart';
import 'package:eco_loop/core/mock/mock_scenario.dart';
import 'package:eco_loop/features/recycling_guide/domain/models/material_rate.dart';

import '../domain/models/deposit_result.dart';
import '../domain/models/deposit_session.dart';
import '../domain/models/scan_instructions.dart';
import '../domain/models/smart_bin.dart';
import '../domain/repositories/scan_repository.dart';

/// Store-backed scan repository.
///
/// QR payloads, instructions, bins, classification rules, and material rates
/// all come from the initialized [MockDataStore]. Session creation, result
/// classification, the activity row, the wallet credit, and the bin capacity
/// increase commit together through one atomic store transaction, so a failed
/// operation leaves every dataset unchanged and a replay never duplicates
/// credit.
class MockScanRepository implements ScanRepository {
  MockScanRepository({
    required MockDataStore store,
    MockApi? api,
    AppClock? clock,
  }) : _store = store,
       _api = api ?? MockApi(),
       _clock = clock ?? store.clock;

  final MockDataStore _store;
  final MockApi _api;
  final AppClock _clock;
  final Map<String, Future<DepositSession>> _completionOperations = {};
  final Map<String, StreamController<Object?>> _changes = {};

  static const _payloadPrefix = 'ecoloop://bin/';

  ScanInstructions get _instructions =>
      ScanInstructions.fromJson(_store.scanInstructions.first);

  String get _demoQrPayload {
    final payload = _store.scanConfig['demoQrPayload'];
    if (payload is String && payload.isNotEmpty) return payload;
    throw MockDataStore.notFound('scan.demoQrPayload');
  }

  SmartBin? _binById(String binId) {
    for (final row in _store.bins) {
      if (row['id'] == binId) return SmartBin.fromJson(row);
    }
    return null;
  }

  DepositSession? _sessionById(String sessionId) {
    for (final row in _store.sessions) {
      if (row['id'] == sessionId) return DepositSession.fromJson(row);
    }
    return null;
  }

  DepositResult? _resultById(String resultId) {
    for (final row in _store.results) {
      if (row['id'] == resultId) return DepositResult.fromJson(row);
    }
    return null;
  }

  DepositSession _requireSession(String sessionId) =>
      _sessionById(sessionId) ?? _missing('session');

  SmartBin _requireBin(String binId) => _binById(binId) ?? _missing('bin');

  Never _missing(String entity) => throw MockDataStore.notFound(entity);

  @override
  Future<ScanInstructions> getInstructions() =>
      _api.read('scan.getInstructions', () => _instructions);

  @override
  Future<String> getDemoQrPayload() =>
      _api.read('scan.getDemoQrPayload', () => _demoQrPayload);

  String? _binIdFromPayload(String qrPayload) {
    if (!qrPayload.startsWith(_payloadPrefix)) return null;
    final binId = qrPayload.substring(_payloadPrefix.length);
    return binId.isEmpty ? null : binId;
  }

  @override
  Future<SmartBin> lookupBin(String qrPayload) =>
      _api.read('scan.lookupBin', () {
        if (_api.scenario.scenario == MockScenario.invalidQr) {
          throw _invalidQr();
        }
        final binId = _binIdFromPayload(qrPayload);
        if (binId == null || _binById(binId) == null) throw _invalidQr();
        return _ensureAvailable(_requireBin(binId));
      });

  @override
  Future<SmartBin> getBin(String binId) =>
      _api.read('scan.getBin', () => _ensureAvailable(_requireBin(binId)));

  @override
  Future<DepositSession> createSession(String binId, String requestId) =>
      _api.write('scan.createSession', () {
        for (final row in _store.sessions) {
          if (row['creationRequestId'] == requestId) {
            return DepositSession.fromJson(row);
          }
        }
        final bin = _requireBin(binId);
        _ensureAvailable(bin);
        final now = _clock.now;
        final session = DepositSession(
          id: _store.newId('session'),
          residentId: _store.profile['id'].toString(),
          binId: bin.id,
          stage: ScanStage.binFound,
          createdAt: now,
          updatedAt: now,
          creationRequestId: requestId,
        );
        _store.transactionScan<void>((_, _, _, sessions, _) {
          sessions.add(session.toJson());
        });
        _emit(session.id, session);
        return session;
      });

  @override
  Future<DepositSession> getSession(String sessionId) =>
      _api.read('scan.getSession', () => _requireSession(sessionId));

  @override
  Future<DepositResult> getResult(String resultId) =>
      _api.read('scan.getResult', () {
        return _resultById(resultId) ?? _missing('result');
      });

  @override
  Future<DepositSession> confirmSession(String sessionId) =>
      _transition(sessionId, ScanStage.binFound, ScanStage.ready);

  @override
  Future<DepositSession> reportFinishPressed(String sessionId) =>
      _transition(sessionId, ScanStage.ready, ScanStage.itemDetected);

  @override
  Future<DepositSession> startVerification(String sessionId) =>
      _transition(sessionId, ScanStage.itemDetected, ScanStage.processing);

  @override
  Future<DepositSession> completeVerification(String sessionId) {
    final existing = _completionOperations[sessionId];
    if (existing != null) return existing;
    final operation = _completeVerification(sessionId);
    _completionOperations[sessionId] = operation;
    unawaited(
      operation.then<void>(
        (_) => _completionOperations.remove(sessionId),
        onError: (_) {
          _completionOperations.remove(sessionId);
        },
      ),
    );
    return operation;
  }

  Future<DepositSession> _completeVerification(
    String sessionId,
  ) => _api.write('scan.completeVerification', () async {
    await Future<void>.delayed(_api.classificationDelay);
    final current = _requireSession(sessionId);
    if (current.stage == ScanStage.completed) return current;
    if (current.stage != ScanStage.processing) {
      throw const AppFailure(
        code: AppFailureCodes.invalidTransition,
        messageKey: 'scan.invalidTransition',
        retryable: false,
      );
    }
    final classification = _store.classifications.first;
    final bin = _requireBin(current.binId);
    final now = _clock.now;
    final outcome = _outcomeFor(classification, bin);
    final materialType = MaterialType.fromWire(
      classification['materialType'].toString(),
    );
    final materialLabel = classification['materialLabel'].toString();
    final itemCount =
        (classification['itemCount'] as num?)?.toInt() ??
        (throw const AppFailure(
          code: AppFailureCodes.validation,
          messageKey: 'scan.invalidClassification',
          retryable: false,
        ));
    final rate = _rateFor(materialType);
    final points = switch (outcome) {
      DepositOutcome.verified => rate?.pointsFor(itemCount) ?? 0,
      DepositOutcome.review => null,
      _ => 0,
    };
    final result = DepositResult(
      id: _store.newId('result'),
      sessionId: current.id,
      transactionId: _store.newId('deposit'),
      outcome: outcome,
      materialType: materialType,
      materialLabel: materialLabel,
      itemCount: itemCount,
      pointsAwarded: points,
      classifiedAt: now,
      explanation: classification['explanation'].toString(),
    );
    final completed = current.copyWith(
      stage: ScanStage.completed,
      updatedAt: now,
      resultId: result.id,
    );
    await _store.transactionScan((wallet, deposits, bins, sessions, results) {
      if (points != null && points > 0) {
        final hasEnvelope = wallet['wallet'] is Map;
        final document = hasEnvelope
            ? (wallet['wallet'] as Map).map(
                (key, value) => MapEntry(key.toString(), value),
              )
            : wallet;
        document['balance'] =
            ((document['balance'] as num?)?.toInt() ?? 0) + points;
        document['updatedAt'] = now.toIso8601String();
        document['version'] = ((document['version'] as num?)?.toInt() ?? 0) + 1;
        if (hasEnvelope) {
          wallet['wallet'] = document;
        } else {
          wallet
            ..clear()
            ..addAll(document);
        }
      }
      deposits.add({
        'id': result.transactionId,
        'residentId': current.residentId,
        'sessionId': current.id,
        'binId': current.binId,
        'binLocation': '${bin.id} · ${bin.locationName}',
        'materialType': materialType.wireValue,
        'materialLabel': materialLabel,
        'itemCount': itemCount,
        'pointsAwarded': points,
        'status': outcome.wireValue,
        'occurredAt': now.toIso8601String(),
        'verifiedAt': outcome == DepositOutcome.verified
            ? now.toIso8601String()
            : null,
      });
      final increase =
          (classification['capacityIncreasePercent'] as num?)?.toInt() ?? 0;
      for (var index = 0; index < bins.length; index++) {
        if (bins[index]['id'] != bin.id) continue;
        bins[index]['capacityPercent'] =
            (((bins[index]['capacityPercent'] as num?)?.toInt() ?? 0) +
                    increase)
                .clamp(0, 100);
        bins[index]['lastUpdatedAt'] = now.toIso8601String();
      }
      final sessionIndex = sessions.indexWhere(
        (row) => row['id'] == current.id,
      );
      final sessionRow = completed.toJson();
      if (sessionIndex == -1) {
        sessions.add(sessionRow);
      } else {
        sessions[sessionIndex] = sessionRow;
      }
      results.add(result.toJson());
    });
    _emit(current.id, completed);
    _emit(result.id, result);
    final updatedBin = _requireBin(bin.id);
    _emit(bin.id, updatedBin);
    return completed;
  });

  DepositOutcome _outcomeFor(
    Map<String, Object?> classification,
    SmartBin bin,
  ) {
    final configured = DepositOutcome.fromWire(
      classification['outcome'].toString(),
    );
    final scenario = switch (_api.scenario.scenario) {
      MockScenario.reviewDeposit => DepositOutcome.review,
      MockScenario.rejectedDeposit => DepositOutcome.rejected,
      _ => configured,
    };
    if (scenario != DepositOutcome.verified) return scenario;
    // Verified outcomes may only credit eligible, bin-accepted material.
    final materialType = MaterialType.fromWire(
      classification['materialType'].toString(),
    );
    final rate = _rateFor(materialType);
    final accepted = bin.acceptedMaterials.contains(materialType);
    if (rate == null || !rate.eligible || !accepted) {
      return DepositOutcome.rejected;
    }
    return DepositOutcome.verified;
  }

  MaterialRate? _rateFor(MaterialType materialType) {
    for (final row in _store.materialRates) {
      final rate = MaterialRate.fromJson(row);
      if (rate.materialType == materialType) return rate;
    }
    return null;
  }

  @override
  Future<DepositSession> cancelSession(String sessionId) =>
      _api.write('scan.cancelSession', () {
        final current = _requireSession(sessionId);
        if (current.stage == ScanStage.processing ||
            current.stage == ScanStage.completed) {
          throw const AppFailure(
            code: AppFailureCodes.invalidTransition,
            messageKey: 'scan.cannotCancel',
            retryable: false,
          );
        }
        final cancelled = current.copyWith(
          stage: ScanStage.cancelled,
          updatedAt: _clock.now,
        );
        _store.transactionScan<void>((_, _, _, sessions, _) {
          final index = sessions.indexWhere((row) => row['id'] == current.id);
          final row = cancelled.toJson();
          if (index == -1) {
            sessions.add(row);
          } else {
            sessions[index] = row;
          }
        });
        _emit(current.id, cancelled);
        return cancelled;
      });

  @override
  Stream<SmartBin?> watchBin(String binId) async* {
    yield _api.scenario.scenario == MockScenario.fullBin
        ? _fullBin(binId)
        : _binById(binId);
    yield* _stream(binId).map((_) => _binById(binId));
  }

  SmartBin? _fullBin(String binId) {
    final bin = _binById(binId);
    if (bin == null) return null;
    return SmartBin(
      id: bin.id,
      locationName: bin.locationName,
      locationDetail: bin.locationDetail,
      capacityPercent: 100,
      acceptedMaterials: bin.acceptedMaterials,
      isOnline: bin.isOnline,
      lastUpdatedAt: bin.lastUpdatedAt,
    );
  }

  @override
  Stream<DepositSession?> watchSession(String sessionId) async* {
    yield _sessionById(sessionId);
    yield* _stream(sessionId).map((_) => _sessionById(sessionId));
  }

  @override
  Stream<DepositResult?> watchResult(String resultId) async* {
    yield _resultById(resultId);
    yield* _stream(resultId).map((_) => _resultById(resultId));
  }

  @override
  ScanStage? peekSessionStage(String sessionId) =>
      _sessionById(sessionId)?.stage;

  AppFailure _invalidQr() => const AppFailure(
    code: AppFailureCodes.invalidQr,
    messageKey: 'scan.invalidQr',
    retryable: false,
  );

  SmartBin _ensureAvailable(SmartBin bin) {
    if (_api.scenario.scenario == MockScenario.fullBin &&
        bin.capacityPercent < 100) {
      throw const AppFailure(
        code: AppFailureCodes.binUnavailable,
        messageKey: 'scan.binFull',
        retryable: false,
      );
    }
    if (!bin.isOnline) {
      throw const AppFailure(
        code: AppFailureCodes.binUnavailable,
        messageKey: 'scan.binOffline',
        retryable: true,
      );
    }
    if (bin.capacityPercent >= 100) {
      throw const AppFailure(
        code: AppFailureCodes.binUnavailable,
        messageKey: 'scan.binFull',
        retryable: false,
      );
    }
    return bin;
  }

  Future<DepositSession> _transition(String id, ScanStage from, ScanStage to) =>
      _api.write('scan.transition', () {
        final current = _requireSession(id);
        if (current.stage != from) {
          throw const AppFailure(
            code: AppFailureCodes.invalidTransition,
            messageKey: 'scan.invalidTransition',
            retryable: false,
          );
        }
        final updated = current.copyWith(stage: to, updatedAt: _clock.now);
        _store.transactionScan<void>((_, _, _, sessions, _) {
          final index = sessions.indexWhere((row) => row['id'] == id);
          final row = updated.toJson();
          if (index == -1) {
            sessions.add(row);
          } else {
            sessions[index] = row;
          }
        });
        _emit(id, updated);
        return updated;
      });

  StreamController<Object?> _controller(String id) =>
      _changes.putIfAbsent(id, () => StreamController<Object?>.broadcast());

  Stream<Object?> _stream(String id) => _controller(id).stream;

  void _emit(String id, Object? value) {
    _changes[id]?.add(value);
  }

  void dispose() {
    for (final controller in _changes.values) {
      controller.close();
    }
  }
}
