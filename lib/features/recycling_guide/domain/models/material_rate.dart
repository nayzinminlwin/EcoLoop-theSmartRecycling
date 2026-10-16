import 'package:eco_loop/core/data/json_readers.dart';
import 'package:eco_loop/core/domain/material_type.dart';

class MaterialRate {
  const MaterialRate({
    required this.materialType,
    required this.displayName,
    required this.pointsPerItem,
    required this.eligible,
  });

  final MaterialType materialType;
  final String displayName;
  final int pointsPerItem;
  final bool eligible;

  factory MaterialRate.fromJson(JsonMap json) => MaterialRate(
    materialType: MaterialType.fromWire(
      JsonReaders.string(json, 'materialType'),
    ),
    displayName: JsonReaders.string(json, 'displayName'),
    pointsPerItem: JsonReaders.integer(json, 'pointsPerItem'),
    eligible: JsonReaders.boolean(json, 'eligible'),
  );

  JsonMap toJson() => {
    'materialType': materialType.wireValue,
    'displayName': displayName,
    'pointsPerItem': pointsPerItem,
    'eligible': eligible,
  };

  int pointsFor(int itemCount) => eligible ? pointsPerItem * itemCount : 0;
}
