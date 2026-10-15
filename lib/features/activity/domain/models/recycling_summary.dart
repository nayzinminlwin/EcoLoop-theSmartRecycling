import 'package:eco_loop/core/data/json_readers.dart';

class RecyclingSummary {
  const RecyclingSummary({
    required this.verifiedDepositCount,
    required this.verifiedWeightKg,
  });

  final int verifiedDepositCount;
  final double verifiedWeightKg;

  factory RecyclingSummary.fromJson(JsonMap json) => RecyclingSummary(
    verifiedDepositCount: JsonReaders.integer(json, 'verifiedDepositCount'),
    verifiedWeightKg: JsonReaders.number(json, 'verifiedWeightKg'),
  );

  JsonMap toJson() => {
    'verifiedDepositCount': verifiedDepositCount,
    'verifiedWeightKg': verifiedWeightKg,
  };
}
