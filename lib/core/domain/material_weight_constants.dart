import 'material_type.dart';

abstract final class MaterialWeightConstants {
  static const Map<MaterialType, double> estimatedKgPerItem = {
    MaterialType.plastic: 0.025,
    MaterialType.aluminium: 0.015,
    MaterialType.paper: 0.050,
    MaterialType.glass: 0.200,
    MaterialType.unknown: 0.0,
  };

  static double getWeightKg(MaterialType type, int itemCount) {
    return (estimatedKgPerItem[type] ?? 0.0) * itemCount;
  }
}
