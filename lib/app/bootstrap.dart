import 'package:eco_loop/app/eco_loop_app.dart';
import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_seed_loader.dart';
import 'package:eco_loop/core/mock/mock_scenario.dart';
import 'package:eco_loop/core/config/runtime_config.dart';
import 'package:eco_loop/core/firebase/firebase_clients.dart';
import 'package:eco_loop/core/data/pending_operation_store.dart';
import 'package:eco_loop/core/firebase/command_client.dart';
import 'package:eco_loop/features/account/data/firebase_account_repository.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();
  final config = RuntimeConfig.fromEnvironment();
  if (config.mode != FirebaseMode.mock) {
    final clients = await FirebaseClients.initialize(config);
    final accountRepository = FirebaseAccountRepository(
      auth: FirebaseUserAuthGateway(auth: clients.auth),
      google: FirebaseGoogleAuthGateway(),
      commandClient: (uid) => CommandClient(
        uid: uid,
        store: PendingOperationStore(),
        functions: clients.functions,
      ),
    );
    runApp(
      ProviderScope(
        overrides: [
          runtimeConfigProvider.overrideWithValue(config),
          firebaseClientsProvider.overrideWithValue(clients),
          accountRepositoryProvider.overrideWithValue(accountRepository),
        ],
        child: const EcoLoopApp(),
      ),
    );
    return;
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
