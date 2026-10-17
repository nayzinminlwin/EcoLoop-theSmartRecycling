import 'package:eco_loop/core/data/json_readers.dart';

import 'material_rate.dart';
import 'recycling_guide_content.dart';
import 'guide_rate_example.dart';
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
    required this.rateExamples,
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
  final List<GuideRateExample> rateExamples;

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
    rateExamples: json['rateExamples'] is List
        ? List.unmodifiable(
            (json['rateExamples'] as List).map(
              (item) => GuideRateExample.fromJson(
                JsonReaders.map(item, 'rateExamples'),
              ),
            ),
          )
        : const [],
  );

  factory RecyclingGuide.compose({
    required RecyclingGuideContent content,
    required List<RecyclingMaterial> materials,
    required List<RecyclingStep> steps,
    required List<MaterialRate> rates,
    List<GuideRateExample> rateExamples = const [],
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
    rateExamples: List.unmodifiable(
      rateExamples.isEmpty ? content.rateExamples : rateExamples,
    ),
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
    'rateExamples': rateExamples.map((item) => item.toJson()).toList(),
  };
}
