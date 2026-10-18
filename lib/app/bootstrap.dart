import 'package:eco_loop/app/eco_loop_app.dart';
import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_seed_loader.dart';
import 'package:eco_loop/core/mock/mock_scenario.dart';
import 'package:eco_loop/core/config/runtime_config.dart';
import 'package:eco_loop/core/firebase/firebase_clients.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();
  final config = RuntimeConfig.fromEnvironment();
  if (config.mode != FirebaseMode.mock) {
    await FirebaseClients.initialize(config);
    throw StateError(
      'Firebase mode ${config.mode.name} is configured, but real feature '
      'adapters are not implemented yet. Use '
      '--dart-define=ECOLOOP_FIREBASE_MODE=mock for the fixture runtime.',
    );
  }
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
