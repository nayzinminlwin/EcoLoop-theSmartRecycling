import 'package:eco_loop/core/data/json_readers.dart';
import 'package:eco_loop/core/domain/deposit_line_item.dart';
import 'package:eco_loop/core/domain/material_type.dart';

enum DepositStatus {
  processing('processing'),
  verified('verified'),
  review('review'),
  excluded('excluded'),
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
    this.lines = const [],
    this.totalDetectedObjectCount,
    this.traceId,
    this.decisionVersion = 0,
  });

  final String id;
  final String residentId;
  final String? sessionId;
  final String binId;
  final String binLocation;
  final MaterialType materialType;
  final String materialLabel;
  final int? itemCount;
  final List<DepositLineItem> lines;
  final int? totalDetectedObjectCount;
  final String? traceId;
  final int decisionVersion;
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
    itemCount: _nullableInteger(json, 'itemCount'),
    pointsAwarded: json['pointsAwarded'] == null
        ? null
        : JsonReaders.integer(json, 'pointsAwarded'),
    status: DepositStatus.fromWire(_statusValue(json)),
    occurredAt: JsonReaders.dateTime(json, 'occurredAt'),
    verifiedAt: json['verifiedAt'] == null
        ? null
        : JsonReaders.dateTime(json, 'verifiedAt'),
  );

  factory DepositTransaction.fromBackendJson(JsonMap json) {
    final lines = JsonReaders.maps(
      json,
      'lines',
    ).map(DepositLineItem.fromJson).toList(growable: false);
    return DepositTransaction(
      id: JsonReaders.string(json, 'id'),
      residentId: JsonReaders.string(json, 'ownerId'),
      sessionId: JsonReaders.nullableString(json, 'sessionId'),
      binId: JsonReaders.string(json, 'binId'),
      binLocation: JsonReaders.string(json, 'binLocation'),
      materialType: lines.isEmpty
          ? MaterialType.unknown
          : lines.first.materialType,
      materialLabel: lines.isEmpty ? 'No material' : lines.first.label,
      itemCount: _nullableInteger(json, 'totalDetectedObjectCount'),
      pointsAwarded: _nullableInteger(json, 'pointsAwarded'),
      status: DepositStatus.fromWire(JsonReaders.string(json, 'status')),
      occurredAt: JsonReaders.dateTime(json, 'updatedAt'),
      verifiedAt: json['status'] == 'verified'
          ? JsonReaders.dateTime(json, 'updatedAt')
          : null,
      lines: lines,
      totalDetectedObjectCount: _nullableInteger(
        json,
        'totalDetectedObjectCount',
      ),
      traceId: JsonReaders.string(json, 'traceId'),
      decisionVersion: _nullableInteger(json, 'decisionVersion') ?? 0,
    );
  }

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
    'lines': lines.map((line) => line.toJson()).toList(growable: false),
    'totalDetectedObjectCount': totalDetectedObjectCount,
    'traceId': traceId,
    'decisionVersion': decisionVersion,
  };

  int get acceptedItemCount => lines.isEmpty
      ? (status == DepositStatus.verified ? (itemCount ?? 0) : 0)
      : lines.fold<int>(0, (sum, line) => sum + line.acceptedCount);

  static int? _nullableInteger(JsonMap json, String field) {
    final value = json[field];
    if (value == null) return null;
    if (value is int) return value;
    if (value is num && value == value.roundToDouble()) return value.toInt();
    throw JsonReaders.invalid(field);
  }

  static String _statusValue(JsonMap json) {
    final value = json['status'] ?? json['outcome'];
    if (value is String && value.isNotEmpty) return value;
    throw JsonReaders.invalid('status');
  }
}
