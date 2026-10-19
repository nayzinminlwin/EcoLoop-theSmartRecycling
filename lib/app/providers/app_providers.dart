import 'package:eco_loop/app/router/app_router.dart';
import 'package:eco_loop/app/router/leave_decision_coordinator.dart';
import 'package:eco_loop/features/account/data/mock_account_repository.dart';
import 'package:eco_loop/features/account/domain/repositories/account_repository.dart';
import 'package:eco_loop/features/activity/data/mock_activity_repository.dart';
import 'package:eco_loop/features/activity/data/firebase_activity_repository.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
import 'package:eco_loop/features/activity/domain/repositories/activity_repository.dart';
import 'package:eco_loop/features/wallet/data/mock_wallet_repository.dart';
import 'package:eco_loop/features/wallet/data/firebase_wallet_repository.dart';
import 'package:eco_loop/features/wallet/domain/repositories/wallet_repository.dart';
import 'package:eco_loop/features/recycling_guide/data/mock_recycling_guide_repository.dart';
import 'package:eco_loop/features/recycling_guide/data/firebase_recycling_guide_repository.dart';
import 'package:eco_loop/features/recycling_guide/domain/repositories/recycling_guide_repository.dart';
import 'package:eco_loop/features/scan/data/mock_scan_repository.dart';
import 'package:eco_loop/features/scan/data/firebase_scan_repository.dart';
import 'package:eco_loop/features/scan/domain/repositories/scan_repository.dart';
import 'package:eco_loop/features/scan/domain/models/simulation_asset.dart';
import 'package:eco_loop/features/rewards/data/mock_rewards_repository.dart';
import 'package:eco_loop/features/rewards/data/firebase_rewards_repository.dart';
import 'package:eco_loop/features/rewards/domain/repositories/rewards_repository.dart';
import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:eco_loop/core/mock/mock_data_store.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_scenario.dart';
import 'package:eco_loop/core/mock/mock_seed_loader.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:eco_loop/core/config/runtime_config.dart';
import 'package:eco_loop/core/data/pending_operation_store.dart';
import 'package:eco_loop/core/firebase/command_client.dart';
import 'package:eco_loop/core/firebase/firebase_clients.dart';
import 'package:eco_loop/features/account/data/firebase_account_repository.dart';
import 'package:eco_loop/features/account/presentation/controllers/auth_controller.dart';
import 'package:eco_loop/features/account/presentation/controllers/account_providers.dart';
import 'package:eco_loop/features/account/presentation/screens/sign_in_screen.dart';
import 'package:eco_loop/features/notifications/data/firebase_notification_service.dart';

final runtimeConfigProvider = Provider<RuntimeConfig>(
  (ref) => RuntimeConfig.fromEnvironment(),
);
final firebaseClientsProvider = Provider<FirebaseClients?>((ref) => null);
final firebaseNotificationServiceProvider =
    Provider<FirebaseNotificationService?>((ref) => null);
final appRouterProvider = Provider((ref) {
  final config = ref.watch(runtimeConfigProvider);
  return createAppRouter(
    accountRepository: ref.watch(accountRepositoryProvider),
    signInBuilder: (context) => SignInScreen(
      controller: AuthController(ref.read(accountRepositoryProvider)),
    ),
    resolveSessionStage: config.mode == FirebaseMode.mock
        ? (sessionId) =>
              ref.watch(scanRepositoryProvider).peekSessionStage(sessionId)
        : null,
    utcOffsetMinutes: ref.watch(appClockProvider).utcOffsetMinutes,
  );
});
final appClockProvider = Provider<AppClock>((ref) => AppClock());
final systemAppClockProvider = Provider<AppClock>(
  (ref) => AppClock.system(
    locale: ref.watch(appClockProvider).locale,
    utcOffsetMinutes: ref.watch(appClockProvider).utcOffsetMinutes,
  ),
);
final leaveDecisionProvider = Provider<LeaveDecisionCoordinator>(
  (ref) => LeaveDecisionCoordinator(),
);
final mockScenarioProvider = Provider<MockScenarioState>(
  (ref) => MockScenarioState.fromEnvironment(),
);
final mockApiProvider = Provider<MockApi>(
  (ref) => MockApi(scenario: ref.watch(mockScenarioProvider)),
);
final mockDataStoreProvider = Provider<MockDataStore>(
  (ref) => MockDataStore(
    profile: const {
      'id': 'RES-000842',
      'fullName': 'Faris Rezza',
      'email': 'rezza@example.com',
      'avatarUrl': null,
      'createdAt': '2024-01-12T08:00:00+08:00',
    },
    wallet: {
      'residentId': 'RES-000842',
      'balance': 245,
      'updatedAt': '2024-05-20T11:00:00+08:00',
      'version': 1,
    },
    deposits: const [],
  ),
);

final accountRepositoryProvider = Provider<AccountRepository>(
  (ref) => MockAccountRepository(
    store: ref.watch(mockDataStoreProvider),
    api: ref.watch(mockApiProvider),
    clock: ref.watch(appClockProvider),
  ),
);

final authControllerProvider = ChangeNotifierProvider<AuthController>(
  (ref) => AuthController(ref.watch(accountRepositoryProvider)),
);

AccountRepository createFirebaseAccountRepository(FirebaseClients clients) {
  return FirebaseAccountRepository(
    auth: FirebaseUserAuthGateway(auth: clients.auth),
    google: FirebaseGoogleAuthGateway(),
    commandClient: (uid) => CommandClient(
      uid: uid,
      store: PendingOperationStore(),
      functions: clients.functions,
    ),
  );
}

final walletRepositoryProvider = Provider<WalletRepository>((ref) {
  final config = ref.watch(runtimeConfigProvider);
  final clients = ref.watch(firebaseClientsProvider);
  if (config.mode != FirebaseMode.mock) {
    ref.listen(residentUidProvider, (_, _) => ref.invalidateSelf());
    final uid = clients?.auth.currentUser?.uid;
    if (clients == null || uid == null) {
      throw StateError('A signed-in Firebase resident is required');
    }
    return FirebaseWalletRepository(uid: uid, firestore: clients.firestore);
  }
  return MockWalletRepository(
    store: ref.watch(mockDataStoreProvider),
    api: ref.watch(mockApiProvider),
    clock: ref.watch(appClockProvider),
  );
});

final recyclingGuideRepositoryProvider = Provider<RecyclingGuideRepository>((
  ref,
) {
  final config = ref.watch(runtimeConfigProvider);
  final clients = ref.watch(firebaseClientsProvider);
  if (config.mode != FirebaseMode.mock) {
    if (clients == null) throw StateError('Firebase clients are required');
    return FirebaseRecyclingGuideRepository(firestore: clients.firestore);
  }
  return MockRecyclingGuideRepository();
});

final activityRepositoryProvider = FutureProvider<ActivityRepository>((
  ref,
) async {
  final config = ref.watch(runtimeConfigProvider);
  final clients = ref.watch(firebaseClientsProvider);
  if (config.mode != FirebaseMode.mock) {
    ref.listen(residentUidProvider, (_, _) => ref.invalidateSelf());
    final uid = clients?.auth.currentUser?.uid;
    if (clients == null || uid == null) {
      throw StateError('A signed-in Firebase resident is required');
    }
    return FirebaseActivityRepository(uid: uid, firestore: clients.firestore);
  }
  final store = ref.watch(mockDataStoreProvider);
  final items = store.deposits.isNotEmpty
      ? store.deposits
      : await const MockSeedLoader().loadItems(
          'assets/mock/activity/deposits.json',
        );
  return MockActivityRepository(
    deposits: items.map(DepositTransaction.fromJson).toList(),
    residentId: 'RES-000842',
    store: store,
    api: ref.watch(mockApiProvider),
  );
});

final authStateProvider = FutureProvider(
  (ref) => ref.watch(accountRepositoryProvider).getAuthState(),
);

final residentProfileProvider = FutureProvider(
  (ref) => ref.watch(accountRepositoryProvider).getProfile(),
);

final walletSnapshotProvider = FutureProvider(
  (ref) => ref.watch(walletRepositoryProvider).getWallet(),
);

final scanRepositoryProvider = Provider<ScanRepository>((ref) {
  final config = ref.watch(runtimeConfigProvider);
  if (config.mode != FirebaseMode.mock) {
    final clients = ref.watch(firebaseClientsProvider);
    final uid = clients?.auth.currentUser?.uid;
    if (clients == null || uid == null) {
      throw StateError('A signed-in Firebase resident is required');
    }
    final repository = FirebaseScanRepository(
      uid: uid,
      commandClient: CommandClient(
        uid: uid,
        store: PendingOperationStore(),
        functions: clients.functions,
      ),
      firestore: clients.firestore,
    );
    ref.onDispose(repository.dispose);
    return repository;
  }
  return MockScanRepository(
    clock: ref.watch(appClockProvider),
    store: ref.watch(mockDataStoreProvider),
    api: ref.watch(mockApiProvider),
  );
});

final scanAssetsProvider = StreamProvider<List<SimulationAsset>>(
  (ref) => ref.watch(scanRepositoryProvider).watchAssets(),
);

final rewardsRepositoryProvider = Provider<RewardsRepository>((ref) {
  final config = ref.watch(runtimeConfigProvider);
  final clients = ref.watch(firebaseClientsProvider);
  if (config.mode != FirebaseMode.mock) {
    ref.listen(residentUidProvider, (_, _) => ref.invalidateSelf());
    final uid = clients?.auth.currentUser?.uid;
    if (clients == null || uid == null) {
      throw StateError('A signed-in Firebase resident is required');
    }
    return FirebaseRewardsRepository(
      uid: uid,
      commandClient: CommandClient(
        uid: uid,
        store: PendingOperationStore(),
        functions: clients.functions,
      ),
      now: () => ref.read(systemAppClockProvider).now,
      firestore: clients.firestore,
    );
  }
  return MockRewardsRepository(
    clock: ref.watch(appClockProvider),
    store: ref.watch(mockDataStoreProvider),
    api: ref.watch(mockApiProvider),
  );
});
