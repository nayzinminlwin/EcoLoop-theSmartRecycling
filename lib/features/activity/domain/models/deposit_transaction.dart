import 'package:eco_loop/core/data/json_readers.dart';
import 'package:eco_loop/core/domain/material_type.dart';

enum DepositStatus {
  processing('processing'),
  verified('verified'),
  review('review'),
  empty('empty'),
  rejected('rejected'),
  unknown('unknown');

  const DepositStatus(this.wireValue);
  final String wireValue;

  static DepositStatus fromWire(String value) => values.firstWhere(
    (item) => item.wireValue == value,
    orElse: () => DepositStatus.unknown,
  );
}

class DepositTransaction {
  const DepositTransaction({
    required this.id,
    required this.residentId,
    required this.sessionId,
    required this.binId,
    required this.binLocation,
    required this.materialType,
    required this.materialLabel,
    required this.itemCount,
    required this.pointsAwarded,
    required this.status,
    required this.occurredAt,
    required this.verifiedAt,
  });

  final String id;
  final String residentId;
  final String? sessionId;
  final String binId;
  final String binLocation;
  final MaterialType materialType;
  final String materialLabel;
  final int itemCount;
  final int? pointsAwarded;
  final DepositStatus status;
  final DateTime occurredAt;
  final DateTime? verifiedAt;

  factory DepositTransaction.fromJson(JsonMap json) => DepositTransaction(
    id: JsonReaders.string(json, 'id'),
    residentId: JsonReaders.string(json, 'residentId'),
    sessionId: JsonReaders.nullableString(json, 'sessionId'),
    binId: JsonReaders.string(json, 'binId'),
    binLocation: JsonReaders.string(json, 'binLocation'),
    materialType: MaterialType.fromWire(
      JsonReaders.string(json, 'materialType'),
    ),
    materialLabel: JsonReaders.string(json, 'materialLabel'),
    itemCount: JsonReaders.integer(json, 'itemCount'),
    pointsAwarded: json['pointsAwarded'] == null
        ? null
        : JsonReaders.integer(json, 'pointsAwarded'),
    status: DepositStatus.fromWire(JsonReaders.string(json, 'status')),
    occurredAt: JsonReaders.dateTime(json, 'occurredAt'),
    verifiedAt: json['verifiedAt'] == null
        ? null
        : JsonReaders.dateTime(json, 'verifiedAt'),
  );

  JsonMap toJson() => {
    'id': id,
    'residentId': residentId,
    'sessionId': sessionId,
    'binId': binId,
    'binLocation': binLocation,
    'materialType': materialType.wireValue,
    'materialLabel': materialLabel,
    'itemCount': itemCount,
    'pointsAwarded': pointsAwarded,
    'status': status.wireValue,
    'occurredAt': occurredAt.toIso8601String(),
    'verifiedAt': verifiedAt?.toIso8601String(),
  };
}
