import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/features/account/presentation/controllers/account_providers.dart';
import 'package:eco_loop/features/account/domain/models/resident_profile.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_filter.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
import 'package:eco_loop/features/activity/domain/models/recycling_summary.dart';
import 'package:eco_loop/features/wallet/domain/models/wallet_snapshot.dart';
import 'package:eco_loop/features/rewards/domain/models/reward.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum RewardProgressState {
  loading,
  error,
  ready,
  allHigherLevelsUnlocked,
  noEligibleOffer,
}

class HomeViewData {
  const HomeViewData({
    required this.profile,
    required this.wallet,
    required this.summary,
    required this.recentDeposits,
    this.rewardProgressState = RewardProgressState.loading,
  });

  final ResidentProfile profile;
  final WalletSnapshot wallet;
  final RecyclingSummary summary;
  final List<DepositTransaction> recentDeposits;
  final RewardProgressState rewardProgressState;

  double get rewardProgress {
    final next = wallet.nextRewardCost;
    if (next == null || next <= 0) return 1;
    return (wallet.balance / next).clamp(0.0, 1.0);
  }

  int? get pointsToNextReward {
    final next = wallet.nextRewardCost;
    return next == null ? null : (next - wallet.balance).clamp(0, next);
  }

  HomeViewData copyWith({
    WalletSnapshot? wallet,
    RewardProgressState? rewardProgressState,
  }) => HomeViewData(
    profile: profile,
    wallet: wallet ?? this.wallet,
    summary: summary,
    recentDeposits: recentDeposits,
    rewardProgressState: rewardProgressState ?? this.rewardProgressState,
  );
}

final homeControllerProvider =
    AsyncNotifierProvider<HomeController, HomeViewData>(HomeController.new);

final homeProfileStreamProvider = accountProfileProvider;

final homeWalletStreamProvider = walletSnapshotProvider;

final homeRewardsStreamProvider = StreamProvider<List<Reward>>(
  (ref) => ref.watch(rewardsRepositoryProvider).watchRewards(),
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
  AsyncValue<List<Reward>>? _pendingRewardsState;

  @override
  Future<HomeViewData> build() async {
    ref.listen(homeWalletStreamProvider, (_, next) {
      final wallet = next.valueOrNull;
      final current = state.valueOrNull;
      if (wallet != null &&
          current != null &&
          wallet.version > current.wallet.version) {
        state = AsyncData(current.copyWith(wallet: wallet));
      }
    });
    ref.listen(homeRewardsStreamProvider, (_, next) {
      final current = state.valueOrNull;
      if (current == null) {
        _pendingRewardsState = next;
        return;
      }
      state = AsyncData(_withRewardProgress(current, next));
    });
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
    final data = HomeViewData(
      profile: profile,
      wallet: wallet,
      summary: summary,
      recentDeposits: List.unmodifiable(recentDeposits),
    );
    return _withRewardProgress(
      data,
      _pendingRewardsState ?? ref.read(homeRewardsStreamProvider),
    );
  }

  HomeViewData _withRewardProgress(
    HomeViewData current,
    AsyncValue<List<Reward>> rewardsState,
  ) {
    if (rewardsState.hasError) {
      return current.copyWith(
        rewardProgressState: current.wallet.nextRewardCost == null
            ? RewardProgressState.error
            : RewardProgressState.ready,
      );
    }
    final rewards = rewardsState.valueOrNull;
    if (rewards == null) {
      return current.copyWith(
        rewardProgressState: current.wallet.nextRewardCost == null
            ? RewardProgressState.loading
            : RewardProgressState.ready,
      );
    }
    if (rewards.isEmpty && current.wallet.nextRewardCost != null) {
      return current.copyWith(rewardProgressState: RewardProgressState.ready);
    }
    final now = ref.read(appClockProvider).now;
    final eligible = rewards
        .where((reward) => reward.isActive && !reward.isExpiredAt(now))
        .where(
          (reward) =>
              reward.residentRedemptionCount < reward.maxRedemptionsPerResident,
        )
        .toList();
    final higher =
        eligible
            .where((reward) => reward.pointsCost > current.wallet.balance)
            .toList()
          ..sort((a, b) => a.pointsCost.compareTo(b.pointsCost));
    if (higher.isEmpty) {
      if (current.wallet.nextRewardCost != null && eligible.isNotEmpty) {
        return current.copyWith(rewardProgressState: RewardProgressState.ready);
      }
      return current.copyWith(
        wallet: WalletSnapshot(
          residentId: current.wallet.residentId,
          balance: current.wallet.balance,
          nextRewardCost: null,
          updatedAt: current.wallet.updatedAt,
          version: current.wallet.version,
        ),
        rewardProgressState: eligible.isEmpty
            ? RewardProgressState.noEligibleOffer
            : RewardProgressState.allHigherLevelsUnlocked,
      );
    }
    final next = higher.first.pointsCost;
    return current.copyWith(
      wallet: WalletSnapshot(
        residentId: current.wallet.residentId,
        balance: current.wallet.balance,
        nextRewardCost: next,
        updatedAt: current.wallet.updatedAt,
        version: current.wallet.version,
      ),
      rewardProgressState: RewardProgressState.ready,
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
