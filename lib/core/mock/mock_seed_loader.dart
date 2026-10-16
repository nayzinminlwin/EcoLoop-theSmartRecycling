import 'dart:convert';

import 'package:flutter/services.dart';

import '../data/json_readers.dart';

class MockSeedLoader {
  const MockSeedLoader();

  Future<JsonMap> loadMap(String path) async {
    final decoded = jsonDecode(await rootBundle.loadString(path));
    return JsonReaders.map(decoded, path);
  }

  Future<List<JsonMap>> loadItems(String path) async {
    final envelope = await loadMap(path);
    return JsonReaders.maps(envelope, 'items');
  }

  Future<List<JsonMap>> loadRewardDocuments(String path) => loadItems(path);
}
