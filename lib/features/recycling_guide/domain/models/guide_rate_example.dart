import 'package:eco_loop/core/data/json_readers.dart';

class GuideRateExample {
  const GuideRateExample({required this.materialType, required this.itemCount});

  final String materialType;
  final int itemCount;

  factory GuideRateExample.fromJson(JsonMap json) => GuideRateExample(
    materialType: JsonReaders.string(json, 'materialType'),
    itemCount: JsonReaders.integer(json, 'itemCount'),
  );

  JsonMap toJson() => {'materialType': materialType, 'itemCount': itemCount};
}
