import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/shared/widgets/app_error_view.dart';
import 'package:eco_loop/shared/widgets/app_loading_view.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../domain/models/reward.dart';
import '../../domain/models/reward_category.dart';
import '../controllers/rewards_controller.dart';
import '../controllers/vouchers_controller.dart';
import '../widgets/reward_card.dart';
import '../widgets/reward_redemption_dialog.dart';
import '../widgets/voucher_tile.dart';

class RewardsScreen extends ConsumerStatefulWidget {
  const RewardsScreen({this.categoryId, super.key});
  final String? categoryId;

  @override
  ConsumerState<RewardsScreen> createState() => _RewardsScreenState();
}

class _RewardsScreenState extends ConsumerState<RewardsScreen> {
  String? _selectedCategory;
  Reward? _pendingReward;
  String? _redemptionError;
  String? _idempotencyKey;
  bool _redeeming = false;

  @override
  void initState() {
    super.initState();
    _selectedCategory = widget.categoryId;
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(rewardCategoriesProvider);
    final rewards = ref.watch(rewardsProvider(_selectedCategory));
    final wallet = ref.watch(walletSnapshotProvider);
    final vouchers = ref.watch(vouchersProvider(null));
    return AppPage(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'MARKETPLACE',
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                    Text(
                      'Rewards',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                  ],
                ),
              ),
              wallet.when(
                loading: () => const SizedBox.shrink(),
                error: (_, _) => const SizedBox.shrink(),
                data: (value) => Chip(
                  avatar: const Icon(Icons.eco, color: AppColors.primary),
                  label: Text('${value.balance}'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          categories.when(
            loading: () => const LinearProgressIndicator(),
            error: (_, _) => const SizedBox.shrink(),
            data: (items) {
              if (_selectedCategory != null &&
                  !items.any((item) => item.id == _selectedCategory)) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (!mounted) return;
                  setState(() => _selectedCategory = null);
                  context.go(AppRoutes.rewards);
                });
              }
              return _CategoryChips(
                categories: items,
                selected: _selectedCategory,
                onSelected: _selectCategory,
              );
            },
          ),
          const SizedBox(height: 18),
          rewards.when(
            loading: () => const AppLoadingView(message: 'Loading rewards'),
            error: (_, _) => AppErrorView(
              message: 'Rewards could not be loaded.',
              onRetry: () => ref.invalidate(rewardsProvider(_selectedCategory)),
            ),
            data: (items) => wallet.when(
              loading: () =>
                  const AppLoadingView(message: 'Loading your points'),
              error: (_, _) => const Text('Your wallet could not be loaded.'),
              data: (balance) => _RewardGrid(
                rewards: items,
                balance: balance.balance,
                onRedeem: _openRedemption,
              ),
            ),
          ),
          const SizedBox(height: 28),
          Row(
            children: [
              Expanded(
                child: Text(
                  'My vouchers',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              TextButton(
                onPressed: () => context.push(AppRoutes.vouchers),
                child: const Text('View all'),
              ),
            ],
          ),
          vouchers.when(
            loading: () => const LinearProgressIndicator(),
            error: (_, _) => const Text('Vouchers could not be loaded.'),
            data: (items) => items.isEmpty
                ? const Text('No vouchers yet.')
                : VoucherTile(
                    voucher: items.first,
                    onTap: () =>
                        context.push('${AppRoutes.vouchers}/${items.first.id}'),
                  ),
          ),
        ],
      ),
    );
  }

  void _selectCategory(String? category) {
    setState(() => _selectedCategory = category);
    final query = category == null ? '' : '?category=$category';
    context.go('${AppRoutes.rewards}$query');
  }

  void _openRedemption(Reward reward) {
    _pendingReward = reward;
    _redemptionError = null;
    _idempotencyKey =
        'redeem-${reward.id}-${DateTime.now().microsecondsSinceEpoch}';
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => StatefulBuilder(
        builder: (context, setDialogState) => RewardRedemptionDialog(
          reward: reward,
          balance: ref.read(walletSnapshotProvider).value?.balance ?? 0,
          error: _redemptionError,
          isLoading: _redeeming,
          onConfirm: () => _redeem(setDialogState),
        ),
      ),
    );
  }

  Future<void> _redeem(void Function(void Function()) setDialogState) async {
    final reward = _pendingReward;
    if (reward == null || _redeeming) return;
    setState(() => _redeeming = true);
    setDialogState(() {});
    try {
      final receipt = await ref
          .read(rewardsRepositoryProvider)
          .redeemReward(reward.id, _idempotencyKey!);
      if (!mounted) return;
      Navigator.pop(context);
      ref
        ..invalidate(walletSnapshotProvider)
        ..invalidate(rewardsProvider(_selectedCategory))
        ..invalidate(vouchersProvider(null));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${receipt.voucher.title} redeemed.'),
          action: SnackBarAction(
            label: 'Open voucher',
            onPressed: () =>
                context.push('${AppRoutes.vouchers}/${receipt.voucher.id}'),
          ),
        ),
      );
    } on AppFailure catch (failure) {
      if (mounted) {
        _redemptionError = switch (failure.code) {
          AppFailureCodes.insufficientPoints =>
            'You do not have enough points for this reward.',
          AppFailureCodes.conflict => 'You have reached the redemption limit.',
          _ => 'This reward is no longer available. Check and try again.',
        };
        _redeeming = false;
        setDialogState(() {});
      }
    } on Object {
      if (mounted) {
        _redemptionError = 'The redemption failed. Please try again.';
        _redeeming = false;
        setDialogState(() {});
      }
    }
  }
}

class _CategoryChips extends StatelessWidget {
  const _CategoryChips({
    required this.categories,
    required this.selected,
    required this.onSelected,
  });
  final List<RewardCategory> categories;
  final String? selected;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 8,
    children: [
      ChoiceChip(
        label: const Text('All rewards'),
        selected: selected == null,
        onSelected: (_) => onSelected(null),
      ),
      ...categories.map(
        (category) => ChoiceChip(
          label: Text(category.label),
          selected: selected == category.id,
          onSelected: (_) => onSelected(category.id),
        ),
      ),
    ],
  );
}

class _RewardGrid extends StatelessWidget {
  const _RewardGrid({
    required this.rewards,
    required this.balance,
    required this.onRedeem,
  });
  final List<Reward> rewards;
  final int balance;
  final ValueChanged<Reward> onRedeem;

  @override
  Widget build(BuildContext context) {
    if (rewards.isEmpty) {
      return const Text('No rewards are available right now.');
    }
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 560 ? 2 : 1;
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: rewards.length,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: columns == 2 ? .72 : 1.3,
          ),
          itemBuilder: (_, index) => RewardCard(
            reward: rewards[index],
            balance: balance,
            onRedeem: () => onRedeem(rewards[index]),
          ),
        );
      },
    );
  }
}
