import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/providers/app_providers.dart';
import '../../domain/models/reward.dart';
import '../../domain/models/reward_category.dart';

final rewardCategoriesProvider = FutureProvider<List<RewardCategory>>(
  (ref) => ref.watch(rewardsRepositoryProvider).getCategories(),
);

final rewardsProvider = FutureProvider.family<List<Reward>, String?>(
  (ref, categoryId) =>
      ref.watch(rewardsRepositoryProvider).getRewards(categoryId),
);

final rewardProvider = FutureProvider.family<Reward, String>(
  (ref, rewardId) => ref.watch(rewardsRepositoryProvider).getReward(rewardId),
);
