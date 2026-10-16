import 'package:eco_loop/core/data/json_readers.dart';

import 'material_rate.dart';
import 'recycling_guide_content.dart';
import 'recycling_material.dart';
import 'recycling_step.dart';

class RecyclingGuide {
  const RecyclingGuide({
    required this.id,
    required this.heroTitle,
    required this.heroDescription,
    required this.materials,
    required this.toDo,
    required this.toAvoid,
    required this.steps,
    required this.rates,
    required this.pointsDisclaimer,
  });

  final String id;
  final String heroTitle;
  final String heroDescription;
  final List<RecyclingMaterial> materials;
  final List<String> toDo;
  final List<String> toAvoid;
  final List<RecyclingStep> steps;
  final List<MaterialRate> rates;
  final String pointsDisclaimer;

  factory RecyclingGuide.fromJson(JsonMap json) => RecyclingGuide(
    id: JsonReaders.string(json, 'id'),
    heroTitle: JsonReaders.string(json, 'heroTitle'),
    heroDescription: JsonReaders.string(json, 'heroDescription'),
    materials: List.unmodifiable(
      JsonReaders.maps(json, 'materials').map(RecyclingMaterial.fromJson),
    ),
    toDo: List.unmodifiable(JsonReaders.strings(json, 'toDo')),
    toAvoid: List.unmodifiable(JsonReaders.strings(json, 'toAvoid')),
    steps: List.unmodifiable(
      JsonReaders.maps(json, 'steps').map(RecyclingStep.fromJson),
    ),
    rates: List.unmodifiable(
      JsonReaders.maps(json, 'rates').map(MaterialRate.fromJson),
    ),
    pointsDisclaimer: JsonReaders.string(json, 'pointsDisclaimer'),
  );

  factory RecyclingGuide.compose({
    required RecyclingGuideContent content,
    required List<RecyclingMaterial> materials,
    required List<RecyclingStep> steps,
    required List<MaterialRate> rates,
  }) => RecyclingGuide(
    id: content.id,
    heroTitle: content.heroTitle,
    heroDescription: content.heroDescription,
    materials: List.unmodifiable(materials),
    toDo: List.unmodifiable(content.toDo),
    toAvoid: List.unmodifiable(content.toAvoid),
    steps: List.unmodifiable(steps),
    rates: List.unmodifiable(rates),
    pointsDisclaimer: content.pointsDisclaimer,
  );

  JsonMap toJson() => {
    'id': id,
    'heroTitle': heroTitle,
    'heroDescription': heroDescription,
    'materials': materials.map((item) => item.toJson()).toList(),
    'toDo': toDo,
    'toAvoid': toAvoid,
    'steps': steps.map((item) => item.toJson()).toList(),
    'rates': rates.map((item) => item.toJson()).toList(),
    'pointsDisclaimer': pointsDisclaimer,
  };
}
