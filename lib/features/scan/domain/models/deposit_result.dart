import 'package:eco_loop/core/data/json_readers.dart';
import 'package:eco_loop/core/domain/deposit_line_item.dart';
import 'package:eco_loop/core/domain/material_type.dart';

enum DepositOutcome {
  processing('processing'),
  verified('verified'),
  review('review'),
  empty('empty'),
  rejected('rejected'),
  unknown('unknown');

  const DepositOutcome(this.wireValue);
  final String wireValue;
  static DepositOutcome fromWire(String value) => values.firstWhere(
    (item) => item.wireValue == value,
    orElse: () => DepositOutcome.unknown,
  );
}

class DepositResult {
  const DepositResult({
    required this.id,
    required this.sessionId,
    required this.transactionId,
    required this.outcome,
    required this.materialType,
    required this.materialLabel,
    required this.itemCount,
    required this.pointsAwarded,
    required this.classifiedAt,
    required this.explanation,
    this.totalDetectedObjectCount,
    this.lines = const [],
    this.policyVersion,
    this.decisionVersion,
    this.traceId,
  });

  final String id;
  final String sessionId;
  final String transactionId;
  final DepositOutcome outcome;
  final MaterialType materialType;
  final String materialLabel;
  final int itemCount;
  final int? totalDetectedObjectCount;
  final List<DepositLineItem> lines;
  final String? policyVersion;
  final int? decisionVersion;
  final String? traceId;
  final int? pointsAwarded;
  final DateTime classifiedAt;
  final String explanation;

  factory DepositResult.fromJson(JsonMap json) => DepositResult(
    id: JsonReaders.string(json, 'id'),
    sessionId: JsonReaders.string(json, 'sessionId'),
    transactionId: JsonReaders.string(json, 'transactionId'),
    outcome: DepositOutcome.fromWire(JsonReaders.string(json, 'outcome')),
    materialType: MaterialType.fromWire(
      JsonReaders.string(json, 'materialType'),
    ),
    materialLabel: JsonReaders.string(json, 'materialLabel'),
    itemCount: JsonReaders.integer(json, 'itemCount'),
    pointsAwarded: json['pointsAwarded'] == null
        ? null
        : JsonReaders.integer(json, 'pointsAwarded'),
    classifiedAt: JsonReaders.dateTime(json, 'classifiedAt'),
    explanation: JsonReaders.string(json, 'explanation'),
    totalDetectedObjectCount: JsonReaders.integer(json, 'itemCount'),
  );

  factory DepositResult.fromBackendJson(JsonMap json) {
    final lines = JsonReaders.maps(
      json,
      'lines',
    ).map(DepositLineItem.fromJson).toList(growable: false);
    return DepositResult(
      id: JsonReaders.string(json, 'id'),
      sessionId: JsonReaders.string(json, 'sessionId'),
      transactionId: JsonReaders.string(json, 'batchId'),
      outcome: DepositOutcome.fromWire(JsonReaders.string(json, 'outcome')),
      materialType: lines.isEmpty
          ? MaterialType.unknown
          : lines.first.materialType,
      materialLabel: lines.isEmpty ? 'No material' : lines.first.label,
      itemCount: _legacyCount(lines, json),
      pointsAwarded: _nullableInteger(json, 'pointsAwarded'),
      classifiedAt: JsonReaders.dateTime(json, 'updatedAt'),
      explanation: JsonReaders.string(json, 'explanation'),
      totalDetectedObjectCount: _nullableInteger(
        json,
        'totalDetectedObjectCount',
      ),
      lines: lines,
      policyVersion: JsonReaders.string(json, 'policyVersion'),
      decisionVersion: JsonReaders.integer(json, 'decisionVersion'),
      traceId: JsonReaders.string(json, 'traceId'),
    );
  }

  JsonMap toJson() => {
    'id': id,
    'sessionId': sessionId,
    'transactionId': transactionId,
    'outcome': outcome.wireValue,
    'materialType': materialType.wireValue,
    'materialLabel': materialLabel,
    'itemCount': itemCount,
    'pointsAwarded': pointsAwarded,
    'classifiedAt': classifiedAt.toIso8601String(),
    'explanation': explanation,
    'totalDetectedObjectCount': totalDetectedObjectCount,
    'lines': lines.map((line) => line.toJson()).toList(growable: false),
    'policyVersion': policyVersion,
    'decisionVersion': decisionVersion,
    'traceId': traceId,
  };

  static int _legacyCount(List<DepositLineItem> lines, JsonMap json) =>
      lines.isNotEmpty
      ? lines.fold<int>(0, (sum, line) => sum + (line.count ?? 0))
      : (_nullableInteger(json, 'totalDetectedObjectCount') ?? 0);

  static int? _nullableInteger(JsonMap json, String field) {
    final value = json[field];
    if (value == null) return null;
    if (value is int) return value;
    if (value is num && value == value.roundToDouble()) return value.toInt();
    throw JsonReaders.invalid(field);
  }
}
