import 'dart:async';

import 'package:eco_loop/app/eco_loop_app.dart';
import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/app/presentation/bootstrap_screen.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_seed_loader.dart';
import 'package:eco_loop/core/mock/mock_scenario.dart';
import 'package:eco_loop/core/config/runtime_config.dart';
import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:eco_loop/core/firebase/firebase_clients.dart';
import 'package:eco_loop/core/data/pending_operation_store.dart';
import 'package:eco_loop/core/data/exit_intent_coordinator.dart';
import 'package:eco_loop/core/data/exit_intent_store.dart';
import 'package:eco_loop/core/data/resident_work_store.dart';
import 'package:eco_loop/core/firebase/command_client.dart';
import 'package:eco_loop/core/diagnostics/app_logger.dart';
import 'package:eco_loop/core/theme/app_theme.dart';
import 'package:eco_loop/features/account/data/firebase_account_repository.dart';
import 'package:eco_loop/features/notifications/data/firebase_notification_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const _BootstrapApp());

  final pendingOperationStore = PendingOperationStore();
  final exitIntentCoordinator = ExitIntentCoordinator(
    store: ExitIntentStore(
      preferences: SharedPreferencesExitIntentPreferences(),
    ),
    installationId: 'runtime',
  );
  unawaited(_restoreExitIntents(exitIntentCoordinator));
  final residentWorkStore = ResidentWorkStore(
    preferences: SharedPreferencesResidentWorkPreferences(),
  );
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
          residentWorkStoreProvider.overrideWithValue(residentWorkStore),
        ],
        child: const EcoLoopApp(),
      ),
    );
    unawaited(_startNotifications(notificationService));
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
        residentWorkStoreProvider.overrideWithValue(residentWorkStore),
      ],
      child: const EcoLoopApp(),
    ),
  );
}

Future<void> _restoreExitIntents(
  ExitIntentCoordinator exitIntentCoordinator,
) async {
  try {
    await exitIntentCoordinator.restore();
  } catch (error) {
    AppLogger().error('exit_intent_restore_failed', error);
  }
}

Future<void> _startNotifications(
  FirebaseNotificationService notificationService,
) async {
  try {
    await notificationService.start();
  } catch (error) {
    AppLogger().error('notification_start_failed', error);
  }
}

class _BootstrapApp extends StatelessWidget {
  const _BootstrapApp();

  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: AppTheme.light,
    home: const BootstrapScreen(),
  );
}
