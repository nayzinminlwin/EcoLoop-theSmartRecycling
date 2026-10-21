import 'package:eco_loop/app/eco_loop_app.dart';
import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_seed_loader.dart';
import 'package:eco_loop/core/mock/mock_scenario.dart';
import 'package:eco_loop/core/config/runtime_config.dart';
import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:eco_loop/core/firebase/firebase_clients.dart';
import 'package:eco_loop/core/data/pending_operation_store.dart';
import 'package:eco_loop/core/data/exit_intent_coordinator.dart';
import 'package:eco_loop/core/firebase/command_client.dart';
import 'package:eco_loop/features/account/data/firebase_account_repository.dart';
import 'package:eco_loop/features/notifications/data/firebase_notification_service.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();
  final pendingOperationStore = PendingOperationStore();
  final exitIntentCoordinator = ExitIntentCoordinator(
    installationId: await pendingOperationStore.installationId(),
  );
  await exitIntentCoordinator.restore();
  final config = RuntimeConfig.fromEnvironment();
  if (config.mode != FirebaseMode.mock) {
    final clients = await FirebaseClients.initialize(config);
    final notificationService = FirebaseNotificationService(
      authState: clients.auth.authStateChanges().map((user) => user?.uid),
      messaging: FirebaseNotificationMessagingClient(
        messaging: clients.messaging,
      ),
      commandClient: (uid) => CommandClient(
        uid: uid,
        store: pendingOperationStore,
        functions: clients.functions,
      ),
    );
    final accountRepository = FirebaseAccountRepository(
      auth: FirebaseUserAuthGateway(auth: clients.auth),
      google: FirebaseGoogleAuthGateway(),
      commandClient: (uid) => CommandClient(
        uid: uid,
        store: pendingOperationStore,
        functions: clients.functions,
      ),
      beforeSignOut: notificationService.unregisterCurrentDevice,
    );
    await notificationService.start();
    runApp(
      ProviderScope(
        overrides: [
          runtimeConfigProvider.overrideWithValue(config),
          appClockProvider.overrideWithValue(AppClock.system()),
          firebaseClientsProvider.overrideWithValue(clients),
          firebaseNotificationServiceProvider.overrideWithValue(
            notificationService,
          ),
          accountRepositoryProvider.overrideWithValue(accountRepository),
          exitIntentCoordinatorProvider.overrideWithValue(
            exitIntentCoordinator,
          ),
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
        exitIntentCoordinatorProvider.overrideWithValue(exitIntentCoordinator),
      ],
      child: const EcoLoopApp(),
    ),
  );
}
