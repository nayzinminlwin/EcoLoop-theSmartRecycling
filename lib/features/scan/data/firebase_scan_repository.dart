import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/core/firebase/backend_envelope.dart';
import 'package:eco_loop/core/firebase/command_client.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_result.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_session.dart';
import 'package:eco_loop/features/scan/domain/models/simulation_asset.dart';
import 'package:eco_loop/features/scan/domain/models/smart_bin.dart';

import 'backend_scan_mapper.dart';

abstract interface class ScanReadTransport {
  Future<Map<String, Object?>?> read(String collection, String id);
  Stream<Map<String, Object?>> watch(String collection, String id);
  Stream<Map<String, Object?>> watchOwner(String collection, String ownerId);
}

class FirestoreScanReadTransport implements ScanReadTransport {
  const FirestoreScanReadTransport(this._firestore);

  final FirebaseFirestore _firestore;

  @override
  Future<Map<String, Object?>?> read(String collection, String id) async {
    final snapshot = await _firestore.collection(collection).doc(id).get();
    final data = snapshot.data();
    return data == null ? null : Map<String, Object?>.from(data);
  }

  @override
  Stream<Map<String, Object?>> watch(String collection, String id) =>
      _firestore.collection(collection).doc(id).snapshots().map((snapshot) {
        final data = snapshot.data();
        if (data == null) throw _notFound(collection, id);
        return Map<String, Object?>.from(data);
      });

  @override
  Stream<Map<String, Object?>> watchOwner(
    String collection,
    String ownerId,
  ) =>
      _firestore
          .collection(collection)
          .where('ownerId', isEqualTo: ownerId)
          .snapshots()
          .expand(
            (snapshot) => snapshot.docs.map(
              (document) => Map<String, Object?>.from(document.data()),
            ),
          );
}

class FirebaseScanRepository {
  FirebaseScanRepository({
    required this.uid,
    required this.commandClient,
    FirebaseFirestore? firestore,
    ScanReadTransport? reads,
  }) : _reads =
           reads ??
           FirestoreScanReadTransport(firestore ?? FirebaseFirestore.instance);

  final String uid;
  final CommandClient commandClient;
  final ScanReadTransport _reads;
  final Map<String, DepositSession> _observedSessions = {};
  bool _disposed = false;

  Future<ScanCommandResult> scanBinQr(String qrPayload) async {
    _ensureActive();
    final envelope = await commandClient.execute('scanBinQr', {
      'qrPayload': qrPayload,
    });
    final session = BackendScanMapper.sessionFromEnvelope(envelope);
    final bin = BackendScanMapper.binFromEnvelope(envelope);
    _observe(session);
    return ScanCommandResult(session: session, bin: bin, traceId: envelope.traceId);
  }

  Future<SmartBin> getBin(String binId) async {
    _ensureActive();
    final json = await _requiredRead('bins', binId);
    return BackendScanMapper.binFromJson(json);
  }

  Future<SimulationAsset> getAsset(String assetId) async {
    _ensureActive();
    final json = await _requiredRead('simulationAssets', assetId);
    return BackendScanMapper.assetFromJson(json);
  }

  Future<DepositSession> getSession(String sessionId) async {
    _ensureActive();
    final session = BackendScanMapper.sessionFromJson(
      await _requiredRead('depositSessions', sessionId),
    );
    _observe(session);
    return session;
  }

  Future<DepositResult> getResult(String resultId) async {
    _ensureActive();
    final result = BackendScanMapper.resultFromJson(
      await _requiredRead('depositResults', resultId),
    );
    return result;
  }

  Future<DepositSession> confirmSession(
    String sessionId,
    int expectedVersion,
  ) => _sessionCommand('confirmSession', sessionId, expectedVersion);

  Future<DepositSession> reportFinishPressed(
    String sessionId,
    int expectedVersion,
  ) => _sessionCommand('reportFinishPressed', sessionId, expectedVersion);

  Future<DepositSession> renewSession(
    String sessionId,
    int expectedVersion,
  ) => _sessionCommand('renewSession', sessionId, expectedVersion);

  Future<DepositSession> cancelSession(
    String sessionId,
    int expectedVersion,
  ) => _sessionCommand('cancelSession', sessionId, expectedVersion);

  Future<DepositSession> saveImageSelection({
    required String sessionId,
    required String assetId,
    required String assetVersion,
    required int expectedVersion,
  }) async {
    _ensureActive();
    final envelope = await commandClient.execute('saveImageSelection', {
      'sessionId': sessionId,
      'assetId': assetId,
      'assetVersion': assetVersion,
      'expectedVersion': expectedVersion,
    });
    return _mapSessionCommand(envelope);
  }

  Future<InspectionSubmission> submitInspection({
    required String sessionId,
    required String assetId,
    required String assetVersion,
    required int expectedVersion,
  }) async {
    _ensureActive();
    final envelope = await commandClient.execute('submitInspection', {
      'sessionId': sessionId,
      'assetId': assetId,
      'assetVersion': assetVersion,
      'expectedVersion': expectedVersion,
    });
    final data = envelope.data;
    if (data == null ||
        data['batchId'] is! String ||
        data['jobId'] is! String ||
        data['resultId'] is! String) {
      throw AppFailure(
        code: AppFailureCodes.invalidData,
        messageKey: 'backendScan.submitInspection',
        retryable: false,
        requestId: envelope.requestId,
        traceId: envelope.traceId,
      );
    }
    return InspectionSubmission(
      batchId: data['batchId']! as String,
      jobId: data['jobId']! as String,
      resultId: data['resultId']! as String,
      deadlineAt: data['deadlineAt'] is String
          ? DateTime.parse(data['deadlineAt']! as String).toUtc()
          : null,
      traceId: envelope.traceId,
    );
  }

  Stream<DepositSession?> watchSession(String sessionId) async* {
    _ensureActive();
    final initial = await _readOptional('depositSessions', sessionId);
    if (initial != null) yield _observe(BackendScanMapper.sessionFromJson(initial));
    yield* _reads.watch('depositSessions', sessionId).map((json) {
      _assertJsonOwner(json);
      final session = BackendScanMapper.sessionFromJson(json);
      return _observe(session);
    }).where((session) => session != null);
  }

  Stream<DepositResult?> watchResult(String resultId) async* {
    _ensureActive();
    final initial = await _readOptional('depositResults', resultId);
    if (initial != null) {
      final result = BackendScanMapper.resultFromJson(initial);
      yield result;
    }
    yield* _reads.watch('depositResults', resultId).map((json) {
      _assertJsonOwner(json);
      final result = BackendScanMapper.resultFromJson(json);
      return result;
    });
  }

  Stream<SmartBin> watchBin(String binId) => _reads
      .watch('bins', binId)
      .map(BackendScanMapper.binFromJson);

  void dispose() {
    _disposed = true;
    _observedSessions.clear();
  }

  Future<DepositSession> _sessionCommand(
    String operation,
    String sessionId,
    int expectedVersion,
  ) async {
    _ensureActive();
    final envelope = await commandClient.execute(operation, {
      'sessionId': sessionId,
      'expectedVersion': expectedVersion,
    });
    return _mapSessionCommand(envelope);
  }

  DepositSession _mapSessionCommand(BackendEnvelope envelope) {
    final session = BackendScanMapper.sessionFromEnvelope(envelope);
    _observe(session);
    return session;
  }

  DepositSession? _observe(DepositSession session) {
    final previous = _observedSessions[session.id];
    if (previous != null && session.sessionVersion < previous.sessionVersion) {
      return null;
    }
    _observedSessions[session.id] = session;
    return session;
  }

  Future<Map<String, Object?>> _requiredRead(
    String collection,
    String id,
  ) async =>
      await _readOptional(collection, id) ?? (throw _notFound(collection, id));

  Future<Map<String, Object?>?> _readOptional(
    String collection,
    String id,
  ) async {
    final json = await _reads.read(collection, id);
    if (json != null && collection != 'bins' && collection != 'simulationAssets') {
      final owner = json['ownerId'];
      if (owner is! String || owner != uid) throw _permissionDenied();
    }
    return json;
  }

  void _assertJsonOwner(Map<String, Object?> json) {
    final owner = json['ownerId'];
    if (owner is! String || owner != uid) throw _permissionDenied();
  }

  void _ensureActive() {
    if (_disposed) throw StateError('FirebaseScanRepository has been disposed');
  }
}

class ScanCommandResult {
  const ScanCommandResult({
    required this.session,
    required this.bin,
    required this.traceId,
  });

  final DepositSession session;
  final SmartBin? bin;
  final String traceId;
}

class InspectionSubmission {
  const InspectionSubmission({
    required this.batchId,
    required this.jobId,
    required this.resultId,
    required this.deadlineAt,
    required this.traceId,
  });

  final String batchId;
  final String jobId;
  final String resultId;
  final DateTime? deadlineAt;
  final String traceId;
}

AppFailure _notFound(String collection, String id) => AppFailure(
  code: AppFailureCodes.notFound,
  messageKey: 'backendScan.$collection.$id',
  retryable: false,
);

AppFailure _permissionDenied() => const AppFailure(
  code: AppFailureCodes.permissionDenied,
  messageKey: 'backendScan.owner',
  retryable: false,
);
