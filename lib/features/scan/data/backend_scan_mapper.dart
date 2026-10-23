import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/core/firebase/backend_envelope.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_result.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_session.dart';
import 'package:eco_loop/features/scan/domain/models/smart_bin.dart';

import '../domain/models/simulation_asset.dart';

typedef JsonMap = Map<String, Object?>;

abstract final class BackendScanMapper {
  static DepositSession sessionFromEnvelope(BackendEnvelope envelope) {
    final data = _data(envelope);
    final value = data['session'];
    return sessionFromJson(_map(value, 'session'));
  }

  static SmartBin? binFromEnvelope(BackendEnvelope envelope) {
    final value = _data(envelope)['bin'];
    if (value == null) return null;
    return binFromJson(_map(value, 'bin'));
  }

  static DepositSession sessionFromJson(JsonMap json) {
    final normalized = <String, Object?>{
      ...json,
      'kind': 'session',
      'schemaVersion': 'backend.v1',
      'sessionId': json['sessionId'] ?? json['id'],
    };
    return DepositSession.fromBackendJson(normalized);
  }

  static SmartBin binFromJson(JsonMap json) {
    final normalized = <String, Object?>{
      ...json,
      'kind': 'bin',
      'schemaVersion': 'backend.v1',
      'binId': json['binId'] ?? json['id'],
      'updatedAt': json['updatedAt'] ?? json['lastUpdatedAt'],
    };
    return SmartBin.fromBackendJson(normalized);
  }

  static SimulationAsset assetFromJson(JsonMap json) {
    final normalized = <String, Object?>{
      ...json,
      'kind': 'asset',
      'schemaVersion': 'backend.v1',
      'assetId': json['assetId'] ?? json['id'],
    };
    return SimulationAsset.fromBackendJson(normalized);
  }

  static DepositResult resultFromJson(JsonMap json) {
    final normalized = <String, Object?>{
      ...json,
      'id': json['id'] ?? json['resultId'],
      'transactionId': json['transactionId'] ?? json['batchId'],
      'classifiedAt':
          json['classifiedAt'] ?? json['updatedAt'] ?? json['createdAt'],
      'totalDetectedObjectCount':
          json['totalDetectedObjectCount'] ?? _countLines(json['lines']),
    };
    return DepositResult.fromBackendJson(normalized);
  }

  static JsonMap _data(BackendEnvelope envelope) {
    final data = envelope.data;
    if (data == null) throw _invalid('data');
    return data;
  }

  static JsonMap _map(Object? value, String field) {
    if (value is Map) return Map<String, Object?>.from(value);
    throw _invalid(field);
  }

  static int? _countLines(Object? value) {
    if (value is! List) return null;
    var count = 0;
    for (final item in value) {
      if (item is Map && item['count'] is num) {
        count += (item['count'] as num).toInt();
      }
    }
    return count;
  }

  static AppFailure _invalid(String field) => JsonMapFailure.invalid(field);
}

abstract final class JsonMapFailure {
  static AppFailure invalid(String field) => AppFailure(
    code: AppFailureCodes.invalidData,
    messageKey: 'backendScan.$field',
    retryable: false,
  );
}
