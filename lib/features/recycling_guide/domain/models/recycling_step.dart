import 'package:eco_loop/core/data/json_readers.dart';

class RecyclingStep {
  const RecyclingStep({
    required this.id,
    required this.order,
    required this.instruction,
  });

  final String id;
  final int order;
  final String instruction;

  factory RecyclingStep.fromJson(JsonMap json) => RecyclingStep(
    id: JsonReaders.string(json, 'id'),
    order: JsonReaders.integer(json, 'order'),
    instruction: JsonReaders.string(json, 'instruction'),
  );

  JsonMap toJson() => {'id': id, 'order': order, 'instruction': instruction};
}
