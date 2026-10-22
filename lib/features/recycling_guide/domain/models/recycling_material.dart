import 'package:eco_loop/core/data/json_readers.dart';
import 'package:eco_loop/core/domain/material_type.dart';

class RecyclingMaterial {
  const RecyclingMaterial({
    required this.id,
    required this.type,
    this.canonicalClass,
    required this.title,
    required this.preparationTip,
    required this.iconKey,
    required this.sortOrder,
  });

  final String id;
  final MaterialType type;
  final String? canonicalClass;
  final String title;
  final String preparationTip;
  final String iconKey;
  final int sortOrder;

  factory RecyclingMaterial.fromJson(JsonMap json) => RecyclingMaterial(
    id: JsonReaders.string(json, 'id'),
    type: MaterialType.fromWire(JsonReaders.string(json, 'type')),
    canonicalClass: JsonReaders.nullableString(json, 'canonicalClass'),
    title: JsonReaders.string(json, 'title'),
    preparationTip: JsonReaders.string(json, 'preparationTip'),
    iconKey: JsonReaders.string(json, 'iconKey'),
    sortOrder: JsonReaders.integer(json, 'sortOrder'),
  );

  JsonMap toJson() => {
    'id': id,
    'type': type.wireValue,
    if (canonicalClass != null) 'canonicalClass': canonicalClass,
    'title': title,
    'preparationTip': preparationTip,
    'iconKey': iconKey,
    'sortOrder': sortOrder,
  };
}
