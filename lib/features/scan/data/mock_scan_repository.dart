// ignore_for_file: prefer_initializing_formals

import 'dart:async';

import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/core/domain/material_type.dart';
import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_data_store.dart';

import '../domain/models/deposit_result.dart';
import '../domain/models/deposit_session.dart';
import '../domain/models/scan_instructions.dart';
import '../domain/models/smart_bin.dart';
import '../domain/repositories/scan_repository.dart';

class MockScanRepository implements ScanRepository {
  MockScanRepository({MockApi? api, AppClock? clock, MockDataStore? store})
    : _api = api ?? MockApi(),
      _clock = clock ?? AppClock(),
      _store = store;

  final MockApi _api;
  final AppClock _clock;
  final MockDataStore? _store;
  final Map<String, DepositSession> _sessions = {};
  final Map<String, DepositResult> _results = {};
  final Map<String, Future<DepositSession>> _completionOperations = {};
  final Map<String, StreamController<Object?>> _changes = {};
  SmartBin _bin = SmartBin(
    id: 'BIN-004',
    locationName: 'Central Market',
    locationDetail: 'North entrance, level 1',
    capacityPercent: 65,
    acceptedMaterials: const [
      MaterialType.plastic,
      MaterialType.aluminium,
      MaterialType.paper,
    ],
    isOnline: true,
    lastUpdatedAt: DateTime.parse('2024-05-20T10:55:00+08:00'),
  );

  static const _instructions = ScanInstructions(
    id: 'default',
    scannerTitle: 'Scan a smart bin',
    scannerDescription: 'Point your camera at the bin QR code to begin.',
    binFoundTitle: 'Smart bin found',
    readyTitle: 'Ready to recycle?',
    readyDescription: 'Insert your items, then press the red finish button.',
    itemDetectedTitle: 'Items detected',
    itemDetectedDescription: 'We are checking your recyclable items.',
    processingTitle: 'Identifying your items',
    processingDescription: 'This usually takes a few seconds.',
    verifiedTitle: 'Deposit verified',
    reviewTitle: 'Deposit sent for review',
    rejectedTitle: 'Deposit not eligible',
    pointsTimingNotice: 'Verified points are added after classification.',
  );

  @override
  Future<ScanInstructions> getInstructions() =>
      _api.read('scan.getInstructions', () => _instructions);

  @override
  Future<String> getDemoQrPayload() =>
      _api.read('scan.getDemoQrPayload', () => 'ecoloop://bin/BIN-004');

  @override
  Future<SmartBin> lookupBin(String qrPayload) =>
      _api.read('scan.lookupBin', () {
        if (qrPayload != 'ecoloop://bin/BIN-004') {
          throw const AppFailure(
            code: AppFailureCodes.invalidData,
            messageKey: 'scan.invalidQr',
            retryable: false,
          );
        }
        return _availableBin();
      });

  @override
  Future<SmartBin> getBin(String binId) => _api.read(
    'scan.getBin',
    () => binId == _bin.id ? _availableBin() : _missing('bin'),
  );

  @override
  Future<DepositSession> createSession(String binId, String requestId) =>
      _api.write('scan.createSession', () {
        final existing = _sessions.values.where(
          (session) => session.creationRequestId == requestId,
        );
        if (existing.isNotEmpty) return existing.first;
        _availableBin();
        final now = _clock.now;
        final session = DepositSession(
          id: 'session-${_sessions.length + 1}',
          residentId: 'RES-000842',
          binId: binId,
          stage: ScanStage.binFound,
          createdAt: now,
          updatedAt: now,
          creationRequestId: requestId,
        );
        _sessions[session.id] = session;
        _emit(session.id, session);
        return session;
      });

  @override
  Future<DepositSession> getSession(String sessionId) => _api.read(
    'scan.getSession',
    () => _sessions[sessionId] ?? _missing('session'),
  );

  @override
  Future<DepositResult> getResult(String resultId) => _api.read(
    'scan.getResult',
    () => _results[resultId] ?? _missing('result'),
  );

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
  Future<DepositSession> completeVerification(String sessionId) =>
      _completionOperations[sessionId] ??= _completeVerification(sessionId)
        ..whenComplete(() => _completionOperations.remove(sessionId));

  Future<DepositSession> _completeVerification(String sessionId) =>
      _api.write('scan.completeVerification', () async {
        await Future<void>.delayed(_api.classificationDelay);
        final current = _session(sessionId);
        if (current.stage == ScanStage.completed) return current;
        if (current.stage != ScanStage.processing) {
          throw const AppFailure(
            code: AppFailureCodes.invalidData,
            messageKey: 'scan.invalidTransition',
            retryable: false,
          );
        }
        final now = _clock.now;
        final result = DepositResult(
          id: 'result-$sessionId',
          sessionId: sessionId,
          transactionId: 'deposit-$sessionId',
          outcome: DepositOutcome.verified,
          materialType: MaterialType.plastic,
          materialLabel: 'PET plastic bottles',
          itemCount: 2,
          pointsAwarded: 10,
          classifiedAt: now,
          explanation: 'Two recyclable PET plastic bottles were verified.',
        );
        _results[result.id] = result;
        final completed = current.copyWith(
          stage: ScanStage.completed,
          updatedAt: now,
          resultId: result.id,
        );
        _sessions[sessionId] = completed;
        _bin = SmartBin(
          id: _bin.id,
          locationName: _bin.locationName,
          locationDetail: _bin.locationDetail,
          capacityPercent: 85,
          acceptedMaterials: _bin.acceptedMaterials,
          isOnline: _bin.isOnline,
          lastUpdatedAt: now,
        );
        if (_store != null) {
          await _store.transaction<void>((profile, wallet, deposits) {
            final hasEnvelope = wallet['wallet'] is Map;
            final walletDocument = hasEnvelope
                ? (wallet['wallet'] as Map).map(
                    (key, value) => MapEntry(key.toString(), value),
                  )
                : wallet;
            walletDocument['balance'] =
                ((walletDocument['balance'] as num?)?.toInt() ?? 0) + 10;
            walletDocument['updatedAt'] = now.toIso8601String();
            walletDocument['version'] =
                ((walletDocument['version'] as num?)?.toInt() ?? 0) + 1;
            if (hasEnvelope) {
              wallet['wallet'] = walletDocument;
            } else {
              wallet
                ..clear()
                ..addAll(walletDocument);
            }
            deposits.add({
              'id': result.transactionId,
              'residentId': current.residentId,
              'sessionId': current.id,
              'binId': current.binId,
              'binLocation': _bin.locationName,
              'materialType': result.materialType.wireValue,
              'materialLabel': result.materialLabel,
              'itemCount': result.itemCount,
              'pointsAwarded': result.pointsAwarded,
              'status': result.outcome.wireValue,
              'occurredAt': now.toIso8601String(),
              'verifiedAt': now.toIso8601String(),
            });
          });
        }
        _emit(sessionId, completed);
        _emit(result.id, result);
        _emit(_bin.id, _bin);
        return completed;
      });

  @override
  Future<DepositSession> cancelSession(String sessionId) =>
      _api.write('scan.cancelSession', () {
        final current = _session(sessionId);
        if (current.stage == ScanStage.processing ||
            current.stage == ScanStage.completed) {
          throw const AppFailure(
            code: AppFailureCodes.invalidData,
            messageKey: 'scan.cannotCancel',
            retryable: false,
          );
        }
        final cancelled = current.copyWith(
          stage: ScanStage.cancelled,
          updatedAt: _clock.now,
        );
        _sessions[sessionId] = cancelled;
        _emit(sessionId, cancelled);
        return cancelled;
      });

  @override
  Stream<SmartBin?> watchBin(String binId) async* {
    yield binId == _bin.id ? _bin : null;
    yield* _stream(binId).where((value) => value is SmartBin).cast<SmartBin>();
  }

  @override
  Stream<DepositSession?> watchSession(String sessionId) async* {
    yield _sessions[sessionId];
    yield* _stream(sessionId)
        .where((value) => value is DepositSession?)
        .cast<DepositSession?>();
  }

  @override
  Stream<DepositResult?> watchResult(String resultId) async* {
    yield _results[resultId];
    yield* _stream(resultId)
        .where((value) => value is DepositResult?)
        .cast<DepositResult?>();
  }

  SmartBin _availableBin() {
    if (!_bin.isOnline) {
      throw const AppFailure(
        code: AppFailureCodes.unavailable,
        messageKey: 'scan.binOffline',
        retryable: true,
      );
    }
    if (_bin.capacityPercent >= 100) {
      throw const AppFailure(
        code: AppFailureCodes.unavailable,
        messageKey: 'scan.binFull',
        retryable: false,
      );
    }
    return _bin;
  }

  Future<DepositSession> _transition(String id, ScanStage from, ScanStage to) =>
      _api.write('scan.transition', () {
        final current = _session(id);
        if (current.stage != from) {
          throw const AppFailure(
            code: AppFailureCodes.invalidData,
            messageKey: 'scan.invalidTransition',
            retryable: false,
          );
        }
        final updated = current.copyWith(stage: to, updatedAt: _clock.now);
        _sessions[id] = updated;
        _emit(id, updated);
        return updated;
      });

  DepositSession _session(String id) => _sessions[id] ?? _missing('session');

  Never _missing(String entity) => throw MockDataStore.notFound(entity);

  StreamController<Object?> _controller(String id) =>
      _changes.putIfAbsent(id, () => StreamController<Object?>.broadcast());

  Stream<Object?> _stream(String id) => _controller(id).stream;
  void _emit(String id, Object? value) => _controller(id).add(value);

  SmartBin get currentBin => _bin;
  void dispose() {
    for (final controller in _changes.values) {
      controller.close();
    }
  }
}
