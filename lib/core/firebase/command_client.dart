import 'dart:async';
import 'dart:math' hide log;

import 'package:cloud_functions/cloud_functions.dart';

import '../data/app_failure.dart';
import '../data/pending_operation_store.dart';
import '../diagnostics/app_logger.dart';
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
    AppLogger? logger,
  }) : _transport =
           transport ??
           _firebaseTransport(functions ?? FirebaseFunctions.instance),
       _requestIdFactory = requestIdFactory ?? _newRequestId,
       _logger = logger ?? AppLogger();

  final String uid;
  final PendingOperationStore store;
  final CallableTransport _transport;
  final String Function() _requestIdFactory;
  final AppLogger _logger;
  static final Map<String, Future<void>> _uidLocks = <String, Future<void>>{};

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
  }) => _synchronized(() async {
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
  }, uid);

  Future<T> _synchronized<T>(Future<T> Function() action, String key) async {
    final previous = _uidLocks[key] ?? Future<void>.value();
    final gate = Completer<void>();
    _uidLocks[key] = gate.future;
    await previous;
    try {
      return await action();
    } finally {
      gate.complete();
      if (identical(_uidLocks[key], gate.future)) {
        _uidLocks.remove(key);
      }
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
      if (!error.retryable &&
          error.code != 'not-found' &&
          error.code != 'not_found') {
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
        _logger.log(
          AppLogLevel.error,
          'command.call_error_envelope',
          fields: <String, Object?>{
            'operation': operation,
            'requestId': requestId,
            'envelopeRequestId': envelope.requestId,
            'traceId': envelope.traceId,
            'errorCode': error.code,
            'errorMessage': error.message,
            'retryable': error.retryable,
            'details': error.details,
          },
        );
        throw AppFailure(
          code: _mapErrorCode(error.code),
          messageKey: 'backend.${error.code}',
          retryable: error.retryable,
          requestId: envelope.requestId,
          traceId: envelope.traceId,
        );
      }
      _logger.log(
        AppLogLevel.debug,
        'command.call_succeeded',
        fields: <String, Object?>{
          'operation': operation,
          'requestId': requestId,
          'envelopeRequestId': envelope.requestId,
          'traceId': envelope.traceId,
        },
      );
      return envelope;
    } on AppFailure catch (error) {
      _logger.log(
        AppLogLevel.error,
        'command.call_app_failure',
        fields: <String, Object?>{
          'operation': operation,
          'requestId': requestId,
          'errorCode': error.code,
          'messageKey': error.messageKey,
          'retryable': error.retryable,
          'errorRequestId': error.requestId,
          'traceId': error.traceId,
        },
      );
      rethrow;
    } on FormatException catch (error) {
      _logger.log(
        AppLogLevel.error,
        'command.call_invalid_response',
        fields: <String, Object?>{
          'operation': operation,
          'requestId': requestId,
          'message': error.message,
        },
      );
      throw AppFailure(
        code: AppFailureCodes.invalidData,
        messageKey: 'backendContract.${error.message}',
        retryable: false,
        requestId: requestId,
      );
    } on FirebaseFunctionsException catch (error) {
      final details = error.details is Map
          ? Map<String, Object?>.from(error.details as Map)
          : const <String, Object?>{};
      final domainCode = details['code'] is String
          ? details['code']! as String
          : error.code.replaceAll('-', '_');
      _logger.log(
        AppLogLevel.error,
        'command.call_firebase_failure',
        fields: <String, Object?>{
          'operation': operation,
          'requestId': requestId,
          'firebaseCode': error.code,
          'message': error.message,
          'details': details,
          'domainCode': domainCode,
        },
      );
      throw AppFailure(
        code: _mapErrorCode(domainCode),
        messageKey: 'backend.$domainCode',
        retryable:
            details['retryable'] == true ||
            error.code == 'unavailable' ||
            error.code == 'deadline-exceeded' ||
            error.code == 'internal',
        requestId: details['requestId'] is String
            ? details['requestId']! as String
            : requestId,
        traceId: details['traceId'] is String
            ? details['traceId']! as String
            : null,
      );
    } catch (error) {
      _logger.error(
        'command.call_unknown_failure',
        error,
        fields: <String, Object?>{
          'operation': operation,
          'requestId': requestId,
        },
      );
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
