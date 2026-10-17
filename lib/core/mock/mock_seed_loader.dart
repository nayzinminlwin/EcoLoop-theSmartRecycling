import 'dart:convert';

import 'package:flutter/services.dart';

import '../data/json_readers.dart';
import 'app_clock.dart';
import 'mock_data_store.dart';

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

  Future<MockDataStore> loadStore() async {
    final metadata = await loadMap('assets/mock/metadata.json');
    final profile = await loadMap('assets/mock/account/profile.json');
    final wallet = await loadMap('assets/mock/wallet/wallet.json');
    final security = await loadMap('assets/mock/account/security.json');
    final preferences = await loadMap(
      'assets/mock/account/notification_preferences.json',
    );
    final session = await loadMap('assets/mock/account/session.json');
    final scanBins = await loadMap('assets/mock/scan/bins.json');
    final guide = await loadMap('assets/mock/recycling_guide/guide.json');
    return MockDataStore(
      metadata: metadata,
      profile: profile,
      wallet: wallet,
      security: security,
      notificationPreferences: preferences,
      session: session,
      deposits: await loadItems('assets/mock/activity/deposits.json'),
      scanConfig: {'demoQrPayload': scanBins['demoQrPayload']},
      bins: JsonReaders.maps(scanBins, 'items'),
      scanInstructions: await loadItems('assets/mock/scan/instructions.json'),
      classifications: await loadItems(
        'assets/mock/scan/classification_scenarios.json',
      ),
      sessions: await loadItems('assets/mock/scan/sessions.json'),
      results: await loadItems('assets/mock/scan/results.json'),
      materialRates: guide['rates'] is List
          ? (guide['rates'] as List)
                .map((item) => JsonReaders.map(item, 'rates'))
                .toList(growable: false)
          : const [],
      rewardCategories: await loadItems('assets/mock/rewards/categories.json'),
      rewards: await loadItems('assets/mock/rewards/catalog.json'),
      vouchers: await loadItems('assets/mock/rewards/vouchers.json'),
      redemptions: await loadItems('assets/mock/rewards/redemptions.json'),
      clock: AppClock.fromMetadata(metadata),
    );
  }
}
