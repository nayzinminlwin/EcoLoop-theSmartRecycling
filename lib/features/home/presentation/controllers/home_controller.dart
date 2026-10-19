import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/features/account/presentation/controllers/account_providers.dart';
import 'package:eco_loop/features/account/domain/models/resident_profile.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_filter.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
import 'package:eco_loop/features/activity/domain/models/recycling_summary.dart';
import 'package:eco_loop/features/wallet/domain/models/wallet_snapshot.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class HomeViewData {
  const HomeViewData({
    required this.profile,
    required this.wallet,
    required this.summary,
    required this.recentDeposits,
  });

  final ResidentProfile profile;
  final WalletSnapshot wallet;
  final RecyclingSummary summary;
  final List<DepositTransaction> recentDeposits;

  double get rewardProgress {
    final next = wallet.nextRewardCost;
    if (next == null || next <= 0) return 1;
    return (wallet.balance / next).clamp(0.0, 1.0);
  }

  int? get pointsToNextReward {
    final next = wallet.nextRewardCost;
    return next == null ? null : (next - wallet.balance).clamp(0, next);
  }
}

final homeControllerProvider =
    AsyncNotifierProvider<HomeController, HomeViewData>(HomeController.new);

final homeProfileStreamProvider = accountProfileProvider;

final homeWalletStreamProvider = StreamProvider<WalletSnapshot?>(
  (ref) => ref.read(walletRepositoryProvider).watchWallet(),
);

final homeSummaryStreamProvider = StreamProvider<RecyclingSummary>((
  ref,
) async* {
  final repository = await ref.watch(activityRepositoryProvider.future);
  yield* repository.watchSummary();
});

final homeRecentDepositsStreamProvider =
    StreamProvider<List<DepositTransaction>>((ref) async* {
      final repository = await ref.watch(activityRepositoryProvider.future);
      yield* repository.watchDeposits(filter: const DepositFilter(), limit: 2);
    });

class HomeController extends AsyncNotifier<HomeViewData> {
  @override
  Future<HomeViewData> build() async {
    final profile = await ref.watch(homeProfileStreamProvider.future);
    final wallet = await ref.watch(homeWalletStreamProvider.future);
    final summary = await ref.watch(homeSummaryStreamProvider.future);
    final recentDeposits = await ref.watch(
      homeRecentDepositsStreamProvider.future,
    );
    if (profile == null || wallet == null) {
      throw const AppFailure(
        code: AppFailureCodes.notFound,
        messageKey: 'home.residentDataUnavailable',
        retryable: true,
      );
    }
    return HomeViewData(
      profile: profile,
      wallet: wallet,
      summary: summary,
      recentDeposits: List.unmodifiable(recentDeposits),
    );
  }

  Future<HomeViewData> _loadOnce() async {
    final profile = await ref.read(accountRepositoryProvider).getProfile();
    final wallet = await ref.read(walletRepositoryProvider).getWallet();
    final activity = await ref.read(activityRepositoryProvider.future);
    final summary = await activity.getSummary();
    final recentDeposits = await activity.getDeposits(
      filter: const DepositFilter(),
      limit: 2,
    );
    return HomeViewData(
      profile: profile,
      wallet: wallet,
      summary: summary,
      recentDeposits: List.unmodifiable(recentDeposits),
    );
  }

  Future<void> refresh() async {
    final previous = state.valueOrNull;
    state = const AsyncLoading();
    try {
      state = AsyncData(await _loadOnce());
    } catch (error, stackTrace) {
      state = previous == null
          ? AsyncError(error, stackTrace)
          : AsyncData(previous);
      rethrow;
    }
  }
}
