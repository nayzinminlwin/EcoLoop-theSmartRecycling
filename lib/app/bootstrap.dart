import 'package:eco_loop/app/eco_loop_app.dart';
import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_seed_loader.dart';
import 'package:eco_loop/core/mock/mock_scenario.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();
  final store = await const MockSeedLoader().loadStore();
  final scenario = MockScenarioState.fromEnvironment();
  final api = MockApi(scenario: scenario);
  runApp(
    ProviderScope(
      overrides: [
        mockDataStoreProvider.overrideWithValue(store),
        appClockProvider.overrideWithValue(store.clock),
        mockScenarioProvider.overrideWithValue(scenario),
        mockApiProvider.overrideWithValue(api),
      ],
      child: const EcoLoopApp(),
    ),
  );
}
