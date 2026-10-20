import 'package:eco_loop/core/data/json_readers.dart';

class SimulationAsset {
  const SimulationAsset({
    required this.id,
    required this.enabled,
    required this.version,
    this.displayName,
    this.sortOrder,
    this.storageReference,
    required this.mimeType,
    required this.width,
    required this.height,
    required this.contentSha256,
  });

  final String id;
  final bool enabled;
  final String version;
  final String? displayName;
  final int? sortOrder;
  final String? storageReference;
  final String mimeType;
  final int width;
  final int height;
  final String? contentSha256;

  factory SimulationAsset.fromBackendJson(JsonMap json) {
    if (JsonReaders.string(json, 'kind') != 'asset' ||
        JsonReaders.string(json, 'schemaVersion') != 'backend.v1') {
      throw JsonReaders.invalid('snapshot');
    }
    final mimeType = JsonReaders.string(json, 'mimeType');
    if (!const {'image/jpeg', 'image/png', 'image/webp'}.contains(mimeType)) {
      throw JsonReaders.invalid('mimeType');
    }
    final width = JsonReaders.integer(json, 'width');
    final height = JsonReaders.integer(json, 'height');
    if (width <= 0 || height <= 0) throw JsonReaders.invalid('geometry');
    return SimulationAsset(
      id: JsonReaders.string(json, 'assetId'),
      enabled: JsonReaders.boolean(json, 'enabled'),
      version: JsonReaders.string(json, 'version'),
      displayName: JsonReaders.nullableString(json, 'displayName'),
      sortOrder: json['sortOrder'] == null
          ? null
          : JsonReaders.integer(json, 'sortOrder'),
      storageReference: JsonReaders.nullableString(json, 'storageReference'),
      mimeType: mimeType,
      width: width,
      height: height,
      contentSha256: JsonReaders.string(json, 'contentSha256'),
    );
  }
}
