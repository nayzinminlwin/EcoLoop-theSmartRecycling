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
  });

  final String id;
  final String locationName;
  final String locationDetail;
  final int capacityPercent;
  final List<MaterialType> acceptedMaterials;
  final bool isOnline;
  final DateTime lastUpdatedAt;

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
  };
}
