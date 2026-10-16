import 'package:eco_loop/core/data/json_readers.dart';

enum ScanStage {
  binFound('binFound'),
  ready('ready'),
  itemDetected('itemDetected'),
  processing('processing'),
  completed('completed'),
  cancelled('cancelled');

  const ScanStage(this.wireValue);
  final String wireValue;
  static ScanStage fromWire(String value) => values.firstWhere(
    (item) => item.wireValue == value,
    orElse: () => ScanStage.cancelled,
  );
}

class DepositSession {
  const DepositSession({
    required this.id,
    required this.residentId,
    required this.binId,
    required this.stage,
    required this.createdAt,
    required this.updatedAt,
    required this.creationRequestId,
    this.resultId,
  });

  final String id;
  final String residentId;
  final String binId;
  final ScanStage stage;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String creationRequestId;
  final String? resultId;

  factory DepositSession.fromJson(JsonMap json) => DepositSession(
    id: JsonReaders.string(json, 'id'),
    residentId: JsonReaders.string(json, 'residentId'),
    binId: JsonReaders.string(json, 'binId'),
    stage: ScanStage.fromWire(JsonReaders.string(json, 'stage')),
    createdAt: JsonReaders.dateTime(json, 'createdAt'),
    updatedAt: JsonReaders.dateTime(json, 'updatedAt'),
    creationRequestId: JsonReaders.string(json, 'creationRequestId'),
    resultId: JsonReaders.nullableString(json, 'resultId'),
  );

  JsonMap toJson() => {
    'id': id,
    'residentId': residentId,
    'binId': binId,
    'stage': stage.wireValue,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'creationRequestId': creationRequestId,
    'resultId': resultId,
  };

  DepositSession copyWith({
    ScanStage? stage,
    DateTime? updatedAt,
    String? resultId,
  }) => DepositSession(
    id: id,
    residentId: residentId,
    binId: binId,
    stage: stage ?? this.stage,
    createdAt: createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    creationRequestId: creationRequestId,
    resultId: resultId ?? this.resultId,
  );
}
