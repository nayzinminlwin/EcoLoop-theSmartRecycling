import 'package:eco_loop/core/data/json_readers.dart';
import 'package:eco_loop/core/domain/material_type.dart';

class RecyclingSummary {
  const RecyclingSummary({
    required this.verifiedDepositCount,
    required this.verifiedWeightKg,
    this.acceptedItemCounts = const {},
  });

  final int verifiedDepositCount;
  final double verifiedWeightKg;
  final Map<MaterialType, int> acceptedItemCounts;

  factory RecyclingSummary.fromJson(JsonMap json) => RecyclingSummary(
    verifiedDepositCount: JsonReaders.integer(json, 'verifiedDepositCount'),
    verifiedWeightKg: JsonReaders.number(json, 'verifiedWeightKg'),
    acceptedItemCounts: _countsFromJson(json['acceptedItemCounts']),
  );

  JsonMap toJson() => {
    'verifiedDepositCount': verifiedDepositCount,
    'verifiedWeightKg': verifiedWeightKg,
    'acceptedItemCounts': {
      for (final entry in acceptedItemCounts.entries)
        entry.key.wireValue: entry.value,
    },
  };

  static Map<MaterialType, int> _countsFromJson(Object? value) {
    if (value is! Map) return const {};
    return {
      for (final entry in value.entries)
        MaterialType.fromWire(entry.key.toString()): (entry.value is num
            ? (entry.value as num).toInt()
            : 0),
    };
  }
}
