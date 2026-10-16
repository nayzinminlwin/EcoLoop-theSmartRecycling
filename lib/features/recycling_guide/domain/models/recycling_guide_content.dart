import 'package:eco_loop/core/data/json_readers.dart';

class RecyclingGuideContent {
  const RecyclingGuideContent({
    this.id = 'guide-default',
    required this.heroTitle,
    required this.heroDescription,
    required this.toDo,
    required this.toAvoid,
    required this.pointsDisclaimer,
  });

  final String id;
  final String heroTitle;
  final String heroDescription;
  final List<String> toDo;
  final List<String> toAvoid;
  final String pointsDisclaimer;

  factory RecyclingGuideContent.fromJson(JsonMap json) => RecyclingGuideContent(
    id: JsonReaders.string(json, 'id'),
    heroTitle: JsonReaders.string(json, 'heroTitle'),
    heroDescription: JsonReaders.string(json, 'heroDescription'),
    toDo: List.unmodifiable(JsonReaders.strings(json, 'toDo')),
    toAvoid: List.unmodifiable(JsonReaders.strings(json, 'toAvoid')),
    pointsDisclaimer: JsonReaders.string(json, 'pointsDisclaimer'),
  );

  JsonMap toJson() => {
    'id': id,
    'heroTitle': heroTitle,
    'heroDescription': heroDescription,
    'toDo': toDo,
    'toAvoid': toAvoid,
    'pointsDisclaimer': pointsDisclaimer,
  };
}
