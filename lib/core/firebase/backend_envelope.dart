import 'dart:collection';

import '../data/app_failure.dart';

enum BackendEnvelopeStatus { committed, error }

class BackendError {
  const BackendError({
    required this.code,
    required this.message,
    required this.retryable,
    this.details = const <String, Object?>{},
  });

  final String code;
  final String message;
  final bool retryable;
  final Map<String, Object?> details;
}

class BackendEnvelope {
  const BackendEnvelope._({
    required this.schemaVersion,
    required this.requestId,
    required this.traceId,
    required this.status,
    this.operation,
    this.data,
    this.error,
    this.timestamp,
  });

  final String schemaVersion;
  final String requestId;
  final String traceId;
  final BackendEnvelopeStatus status;
  final String? operation;
  final Map<String, Object?>? data;
  final BackendError? error;
  final DateTime? timestamp;

  bool get isCommitted => status == BackendEnvelopeStatus.committed;
  bool get isError => status == BackendEnvelopeStatus.error;

  static BackendEnvelope fromJson(Map<String, Object?> json) {
    try {
      final schemaVersion = _requiredString(json, 'schemaVersion');
      if (schemaVersion != 'backend.v1') {
        throw const FormatException('unsupported schema version');
      }
      final requestId = _requiredString(json, 'requestId');
      final traceId = _requiredString(json, 'traceId');
      if (!RegExp(r'^[a-f0-9]{32}$').hasMatch(traceId)) {
        throw const FormatException('invalid trace ID');
      }
      final status = _requiredString(json, 'status');
      final operation = _optionalString(json, 'operation');
      final timestamp = _parseTimestamp(json['timestamp']);
      if (status == 'committed') {
        return BackendEnvelope._(
          schemaVersion: schemaVersion,
          requestId: requestId,
          traceId: traceId,
          status: BackendEnvelopeStatus.committed,
          operation: operation,
          data: _map(json['data'], 'data'),
          timestamp: timestamp,
        );
      }
      if (status == 'error') {
        final errorJson = _map(json['error'], 'error');
        return BackendEnvelope._(
          schemaVersion: schemaVersion,
          requestId: requestId,
          traceId: traceId,
          status: BackendEnvelopeStatus.error,
          operation: operation,
          error: BackendError(
            code: _requiredString(errorJson, 'code'),
            message: _requiredString(errorJson, 'message'),
            retryable: _requiredBool(errorJson, 'retryable'),
            details: _optionalMap(errorJson['details']),
          ),
          timestamp: timestamp,
        );
      }
      throw const FormatException('invalid envelope status');
    } on FormatException catch (error) {
      throw AppFailure(
        code: AppFailureCodes.invalidData,
        messageKey: 'backendContract.${error.message}',
        retryable: false,
      );
    }
  }
}

String _requiredString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) {
    throw FormatException('invalid $key');
  }
  return value;
}

String? _optionalString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value == null) return null;
  if (value is! String || value.isEmpty) throw FormatException('invalid $key');
  return value;
}

bool _requiredBool(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! bool) throw FormatException('invalid $key');
  return value;
}

Map<String, Object?> _map(Object? value, String key) {
  if (value is! Map) throw FormatException('invalid $key');
  return UnmodifiableMapView<String, Object?>(
    value.map((dynamic mapKey, dynamic mapValue) {
      if (mapKey is! String) throw FormatException('invalid $key');
      return MapEntry(mapKey, mapValue);
    }),
  );
}

Map<String, Object?> _optionalMap(Object? value) {
  if (value == null) return const <String, Object?>{};
  return _map(value, 'details');
}

DateTime? _parseTimestamp(Object? value) {
  if (value == null) return null;
  if (value is! String) throw const FormatException('invalid timestamp');
  final parsed = DateTime.tryParse(value);
  if (parsed == null || !parsed.isUtc) {
    throw const FormatException('invalid timestamp');
  }
  return parsed;
}
