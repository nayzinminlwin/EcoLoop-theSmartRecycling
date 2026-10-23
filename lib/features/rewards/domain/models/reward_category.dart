import 'package:eco_loop/core/data/json_readers.dart';

class RewardCategory {
  const RewardCategory({
    required this.id,
    required this.label,
    required this.sortOrder,
  });

  final String id;
  final String label;
  final int sortOrder;

  factory RewardCategory.fromJson(JsonMap json) => RewardCategory(
    id: JsonReaders.string(json, 'id'),
    label: JsonReaders.string(
      json,
      json['label'] != null ? 'label' : 'displayName',
    ),
    sortOrder: JsonReaders.integer(json, 'sortOrder'),
  );

  factory RewardCategory.fromMap(JsonMap json) => RewardCategory.fromJson(json);

  JsonMap toJson() => {'id': id, 'label': label, 'sortOrder': sortOrder};
  JsonMap toMap() => toJson();
}
