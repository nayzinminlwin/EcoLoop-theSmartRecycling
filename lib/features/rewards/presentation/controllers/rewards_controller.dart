import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/providers/app_providers.dart';
import '../../domain/models/reward.dart';
import '../../domain/models/reward_category.dart';

final rewardCategoriesProvider = StreamProvider<List<RewardCategory>>(
  (ref) => ref.watch(rewardsRepositoryProvider).watchCategories(),
);

final rewardsProvider = StreamProvider.family<List<Reward>, String?>(
  (ref, categoryId) =>
      ref.watch(rewardsRepositoryProvider).watchRewards(categoryId: categoryId),
);

final rewardProvider = FutureProvider.family<Reward, String>(
  (ref, rewardId) => ref.watch(rewardsRepositoryProvider).getReward(rewardId),
);
