import 'package:eco_loop/app/router/app_router.dart';
import 'package:eco_loop/features/account/data/mock_account_repository.dart';
import 'package:eco_loop/features/account/domain/repositories/account_repository.dart';
import 'package:eco_loop/features/activity/data/mock_activity_repository.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
import 'package:eco_loop/features/activity/domain/repositories/activity_repository.dart';
import 'package:eco_loop/features/wallet/data/mock_wallet_repository.dart';
import 'package:eco_loop/features/wallet/domain/repositories/wallet_repository.dart';
import 'package:eco_loop/features/recycling_guide/data/mock_recycling_guide_repository.dart';
import 'package:eco_loop/features/recycling_guide/domain/repositories/recycling_guide_repository.dart';
import 'package:eco_loop/core/mock/mock_seed_loader.dart';
import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final appRouterProvider = Provider((ref) => createAppRouter());
final appClockProvider = Provider<AppClock>((ref) => AppClock());

final accountRepositoryProvider = Provider<AccountRepository>(
  (ref) => MockAccountRepository(),
);

final walletRepositoryProvider = Provider<WalletRepository>(
  (ref) => MockWalletRepository(),
);

final recyclingGuideRepositoryProvider = Provider<RecyclingGuideRepository>(
  (ref) => MockRecyclingGuideRepository(),
);

final activityRepositoryProvider = FutureProvider<ActivityRepository>((
  ref,
) async {
  final items = await const MockSeedLoader().loadItems(
    'assets/mock/activity/deposits.json',
  );
  return MockActivityRepository(
    deposits: items.map(DepositTransaction.fromJson).toList(),
    residentId: 'RES-000842',
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
