import 'package:eco_loop/core/data/json_readers.dart';
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
  });

  final String id;
  final String sessionId;
  final String transactionId;
  final DepositOutcome outcome;
  final MaterialType materialType;
  final String materialLabel;
  final int itemCount;
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
  );

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
  };
}
