import 'package:eco_loop/app/router/app_router.dart';
import 'package:eco_loop/app/router/leave_decision_coordinator.dart';
import 'package:eco_loop/features/account/data/mock_account_repository.dart';
import 'package:eco_loop/features/account/domain/repositories/account_repository.dart';
import 'package:eco_loop/features/activity/data/mock_activity_repository.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
import 'package:eco_loop/features/activity/domain/repositories/activity_repository.dart';
import 'package:eco_loop/features/wallet/data/mock_wallet_repository.dart';
import 'package:eco_loop/features/wallet/domain/repositories/wallet_repository.dart';
import 'package:eco_loop/features/recycling_guide/data/mock_recycling_guide_repository.dart';
import 'package:eco_loop/features/recycling_guide/domain/repositories/recycling_guide_repository.dart';
import 'package:eco_loop/features/scan/data/mock_scan_repository.dart';
import 'package:eco_loop/features/scan/domain/repositories/scan_repository.dart';
import 'package:eco_loop/features/rewards/data/mock_rewards_repository.dart';
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
import 'package:eco_loop/features/account/presentation/screens/sign_in_screen.dart';

final runtimeConfigProvider = Provider<RuntimeConfig>(
  (ref) => RuntimeConfig.fromEnvironment(),
);
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

final walletRepositoryProvider = Provider<WalletRepository>(
  (ref) => _mockOnly(
    ref,
    MockWalletRepository(
      store: ref.watch(mockDataStoreProvider),
      api: ref.watch(mockApiProvider),
      clock: ref.watch(appClockProvider),
    ),
  ),
);

final recyclingGuideRepositoryProvider = Provider<RecyclingGuideRepository>(
  (ref) => _mockOnly(ref, MockRecyclingGuideRepository()),
);

final activityRepositoryProvider = FutureProvider<ActivityRepository>((
  ref,
) async {
  _ensureMock(ref);
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

final scanRepositoryProvider = Provider<ScanRepository>(
  (ref) => _mockOnly(
    ref,
    MockScanRepository(
      clock: ref.watch(appClockProvider),
      store: ref.watch(mockDataStoreProvider),
      api: ref.watch(mockApiProvider),
    ),
  ),
);

final rewardsRepositoryProvider = Provider<RewardsRepository>(
  (ref) => _mockOnly(
    ref,
    MockRewardsRepository(
      clock: ref.watch(appClockProvider),
      store: ref.watch(mockDataStoreProvider),
      api: ref.watch(mockApiProvider),
    ),
  ),
);

T _mockOnly<T>(Ref ref, T value) {
  _ensureMock(ref);
  return value;
}

void _ensureMock(Ref ref) {
  if (ref.watch(runtimeConfigProvider).mode != FirebaseMode.mock) {
    throw StateError(
      'This feature is not wired to Firebase yet; mock data is disabled '
      'outside ECOLOOP_FIREBASE_MODE=mock.',
    );
  }
}
