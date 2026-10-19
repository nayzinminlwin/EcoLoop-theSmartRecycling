import 'package:eco_loop/core/data/json_readers.dart';
import 'package:eco_loop/core/domain/material_type.dart';

class DepositLineItem {
  const DepositLineItem({
    required this.lineId,
    required this.materialType,
    required this.label,
    required this.eligible,
    required this.count,
    required this.points,
    required this.spaceSpc,
  });

  final String lineId;
  final MaterialType materialType;
  final String label;
  final bool eligible;
  final int? count;
  final int points;
  final int spaceSpc;

  int get acceptedCount => eligible ? (count ?? 0) : 0;

  factory DepositLineItem.fromJson(JsonMap json) {
    final material = JsonReaders.string(json, 'class');
    return DepositLineItem(
      lineId: JsonReaders.string(json, 'lineId'),
      materialType: _materialType(material),
      label: _label(material),
      eligible: JsonReaders.boolean(json, 'eligible'),
      count: _nullableInteger(json, 'count'),
      points: JsonReaders.integer(json, 'points'),
      spaceSpc: JsonReaders.integer(json, 'spaceSpc'),
    );
  }

  JsonMap toJson() => {
    'lineId': lineId,
    'class': _wireClass(materialType),
    'eligible': eligible,
    'count': count,
    'points': points,
    'spaceSpc': spaceSpc,
  };

  static int? _nullableInteger(JsonMap json, String field) {
    final value = json[field];
    if (value == null) return null;
    if (value is int) return value;
    if (value is num && value == value.roundToDouble()) return value.toInt();
    throw JsonReaders.invalid(field);
  }

  static MaterialType _materialType(String value) => switch (value) {
    'plastic_bottle' => MaterialType.plastic,
    'aluminium_can' => MaterialType.aluminium,
    'glass_bottle' => MaterialType.glass,
    'paper_item' || 'paper_bag' => MaterialType.paper,
    _ => MaterialType.unknown,
  };

  static String _label(String value) => switch (value) {
    'plastic_bottle' => 'Plastic',
    'aluminium_can' => 'Aluminium',
    'glass_bottle' => 'Glass',
    'paper_item' => 'Paper',
    'paper_bag' => 'Paper bags',
    'cardboard_item' => 'Cardboard',
    _ => 'Other material',
  };

  static String _wireClass(MaterialType value) => switch (value) {
    MaterialType.plastic => 'plastic_bottle',
    MaterialType.aluminium => 'aluminium_can',
    MaterialType.glass => 'glass_bottle',
    MaterialType.paper => 'paper_item',
    MaterialType.unknown => 'unknown',
  };
}
