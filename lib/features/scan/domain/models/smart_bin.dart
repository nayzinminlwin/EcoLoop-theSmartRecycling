import 'package:eco_loop/core/data/json_readers.dart';
import 'package:eco_loop/core/domain/material_type.dart';

class SmartBin {
  const SmartBin({
    required this.id,
    required this.locationName,
    required this.locationDetail,
    required this.capacityPercent,
    required this.acceptedMaterials,
    required this.isOnline,
    required this.lastUpdatedAt,
    this.capacitySpc,
    this.occupiedSpc,
    this.cycleId,
    this.enabled = true,
  });

  final String id;
  final String locationName;
  final String locationDetail;
  final int capacityPercent;
  final List<MaterialType> acceptedMaterials;
  final bool isOnline;
  final DateTime lastUpdatedAt;
  final int? capacitySpc;
  final int? occupiedSpc;
  final String? cycleId;
  final bool enabled;

  factory SmartBin.fromJson(JsonMap json) => SmartBin(
    id: JsonReaders.string(json, 'id'),
    locationName: JsonReaders.string(json, 'locationName'),
    locationDetail: JsonReaders.string(json, 'locationDetail'),
    capacityPercent: JsonReaders.integer(json, 'capacityPercent'),
    acceptedMaterials: (json['acceptedMaterials'] as List)
        .map((value) => MaterialType.fromWire(value.toString()))
        .toList(growable: false),
    isOnline: JsonReaders.boolean(json, 'isOnline'),
    lastUpdatedAt: JsonReaders.dateTime(json, 'lastUpdatedAt'),
  );

  factory SmartBin.fromBackendJson(JsonMap json) {
    if (JsonReaders.string(json, 'kind') != 'bin' ||
        JsonReaders.string(json, 'schemaVersion') != 'backend.v1') {
      throw JsonReaders.invalid('snapshot');
    }
    final materials = JsonReaders.strings(json, 'acceptedMaterials')
        .map(MaterialType.fromWire)
        .toList(growable: false);
    if (materials.contains(MaterialType.unknown)) {
      throw JsonReaders.invalid('acceptedMaterials');
    }
    final capacitySpc = JsonReaders.integer(json, 'capacitySpc');
    final occupiedSpc = JsonReaders.integer(json, 'occupiedSpc');
    if (capacitySpc <= 0 || occupiedSpc < 0) {
      throw JsonReaders.invalid('capacitySpc');
    }
    return SmartBin(
      id: JsonReaders.string(json, 'binId'),
      locationName:
          JsonReaders.nullableString(json, 'locationName') ??
          JsonReaders.string(json, 'binId'),
      locationDetail: JsonReaders.nullableString(json, 'locationDetail') ?? '',
      capacityPercent: _displayPercent(occupiedSpc, capacitySpc),
      acceptedMaterials: materials,
      isOnline: JsonReaders.boolean(json, 'isOnline'),
      lastUpdatedAt: _dateOrNow(json),
      capacitySpc: capacitySpc,
      occupiedSpc: occupiedSpc,
      cycleId: JsonReaders.string(json, 'cycleId'),
      enabled: JsonReaders.boolean(json, 'enabled'),
    );
  }

  JsonMap toJson() => {
    'id': id,
    'locationName': locationName,
    'locationDetail': locationDetail,
    'capacityPercent': capacityPercent,
    'acceptedMaterials': acceptedMaterials
        .map((item) => item.wireValue)
        .toList(),
    'isOnline': isOnline,
    'lastUpdatedAt': lastUpdatedAt.toIso8601String(),
    'capacitySpc': capacitySpc,
    'occupiedSpc': occupiedSpc,
    'cycleId': cycleId,
    'enabled': enabled,
  };

  static int _displayPercent(int occupied, int capacity) =>
      (occupied * 100 ~/ capacity).clamp(0, 100);

  static DateTime _dateOrNow(JsonMap json) {
    final value = json['updatedAt'] ?? json['lastUpdatedAt'];
    return value == null
        ? DateTime.fromMillisecondsSinceEpoch(0, isUtc: true)
        : JsonReaders.dateTime({...json, 'updatedAt': value}, 'updatedAt');
  }
}
