import 'dart:math';

import 'package:cloud_functions/cloud_functions.dart';

import '../data/app_failure.dart';
import '../data/pending_operation_store.dart';
import 'backend_envelope.dart';

typedef CallableTransport = Future<Object?> Function(
  String operation,
  Map<String, Object?> payload,
);

class CommandClient {
  CommandClient({
    required this.uid,
    required this.store,
    CallableTransport? transport,
    FirebaseFunctions? functions,
    String Function()? requestIdFactory,
  }) : _transport =
           transport ??
           _firebaseTransport(functions ?? FirebaseFunctions.instance),
       _requestIdFactory = requestIdFactory ?? _newRequestId;

  final String uid;
  final PendingOperationStore store;
  final CallableTransport _transport;
  final String Function() _requestIdFactory;

  static const _durableOperations = <String>{
    'scanBinQr',
    'confirmSession',
    'renewSession',
    'reportFinishPressed',
    'saveImageSelection',
    'submitInspection',
    'cancelSession',
    'redeemReward',
    'simulateVoucherUse',
    'useResidentDemoVoucher',
  };

  Future<BackendEnvelope> execute(
    String operation,
    Map<String, Object?> payload, {
    String? requestId,
  }) async {
    final durable = _durableOperations.contains(operation);
    final existing = durable ? await store.read(uid) : null;
    if (existing != null) {
      if (existing.operation != operation ||
          !_samePayload(existing.payload, payload)) {
        throw const AppFailure(
          code: AppFailureCodes.conflict,
          messageKey: 'pendingOperation.payloadChanged',
          retryable: false,
        );
      }
      return _attempt(existing, recoverOnAmbiguous: true);
    }

    final intent = PendingOperation(
      uid: uid,
      operation: operation,
      requestId: requestId ?? _requestIdFactory(),
      payload: Map<String, Object?>.from(payload),
    );
    if (durable) await store.save(intent);
    try {
      final envelope = await _call(intent.operation, intent.requestId, payload);
      if (durable) await store.clear(uid);
      return envelope;
    } on AppFailure catch (error) {
      if (durable && error.retryable) {
        return _recover(intent, error);
      }
      if (durable) await store.clear(uid);
      rethrow;
    }
  }

  Future<BackendEnvelope> _attempt(
    PendingOperation intent, {
    required bool recoverOnAmbiguous,
  }) async {
    try {
      final envelope = await _call(
        intent.operation,
        intent.requestId,
        intent.payload,
      );
      await store.clear(uid);
      return envelope;
    } on AppFailure catch (error) {
      if (recoverOnAmbiguous && error.retryable) {
        return _recover(intent, error);
      }
      if (!error.retryable) await store.clear(uid);
      rethrow;
    }
  }

  Future<BackendEnvelope> _recover(
    PendingOperation intent,
    AppFailure originalError,
  ) async {
    try {
      final envelope = await _call(
        'recoverOperation',
        intent.requestId,
        <String, Object?>{'operationId': intent.requestId},
      );
      await store.clear(uid);
      return envelope;
    } on AppFailure catch (error) {
      if (!error.retryable) {
        await store.clear(uid);
        rethrow;
      }
      throw originalError;
    }
  }

  Future<BackendEnvelope> _call(
    String operation,
    String requestId,
    Map<String, Object?> payload,
  ) async {
    try {
      final raw = await _transport(operation, <String, Object?>{
        'schemaVersion': 'backend.v1',
        'operation': operation,
        'requestId': requestId,
        'payload': payload,
      });
      if (raw is! Map) {
        throw const FormatException('Callable response is not an object');
      }
      final envelope = BackendEnvelope.fromJson(Map<String, Object?>.from(raw));
      if (envelope.requestId != requestId) {
        throw const FormatException('Callable response request ID mismatch');
      }
      if (envelope.isError) {
        final error = envelope.error!;
        throw AppFailure(
          code: _mapErrorCode(error.code),
          messageKey: 'backend.${error.code}',
          retryable: error.retryable,
          requestId: envelope.requestId,
          traceId: envelope.traceId,
        );
      }
      return envelope;
    } on AppFailure {
      rethrow;
    } on FormatException catch (error) {
      throw AppFailure(
        code: AppFailureCodes.invalidData,
        messageKey: 'backendContract.${error.message}',
        retryable: false,
        requestId: requestId,
      );
    } catch (error) {
      throw AppFailure(
        code: AppFailureCodes.unavailable,
        messageKey: 'backend.transportUnavailable',
        retryable: true,
        requestId: requestId,
      );
    }
  }

  static CallableTransport _firebaseTransport(FirebaseFunctions functions) {
    return (operation, payload) async {
      final result = await functions.httpsCallable(operation).call(payload);
      return result.data;
    };
  }

  static String _mapErrorCode(String code) {
    switch (code) {
      case 'unauthenticated':
        return AppFailureCodes.unauthenticated;
      case 'permission_denied':
        return AppFailureCodes.permissionDenied;
      case 'insufficient_points':
        return AppFailureCodes.insufficientPoints;
      case 'offer_changed':
        return AppFailureCodes.offerChanged;
      case 'redemption_limit_reached':
        return AppFailureCodes.redemptionLimitReached;
      case 'invalid_qr':
        return AppFailureCodes.invalidQr;
      case 'bin_unavailable':
        return AppFailureCodes.binUnavailable;
      case 'invalid_transition':
        return AppFailureCodes.invalidTransition;
      case 'idempotency_conflict':
        return AppFailureCodes.conflict;
      default:
        return code;
    }
  }

  static String _newRequestId() {
    final random = Random.secure();
    final suffix = List<String>.generate(
      16,
      (_) => random.nextInt(16).toRadixString(16),
    ).join();
    return 'req-$suffix';
  }

  static bool _samePayload(
    Map<String, Object?> left,
    Map<String, Object?> right,
  ) => _canonical(left) == _canonical(right);

  static String _canonical(Object? value) {
    if (value is Map) {
      final entries =
          value.entries
              .map((entry) => '${entry.key}:${_canonical(entry.value)}')
              .toList()
            ..sort();
      return '{${entries.join(',')}}';
    }
    if (value is Iterable) return '[${value.map(_canonical).join(',')}]';
    return '$value';
  }
}
