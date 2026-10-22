import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/shared/widgets/app_error_view.dart';
import 'package:eco_loop/shared/widgets/app_loading_view.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';
import 'package:eco_loop/shared/widgets/app_icon.dart';
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
  String? _successMessage;
  String? _successVoucherId;

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
                      style: AppTypography.eyebrow.copyWith(
                        color: AppColors.primary,
                      ),
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
                data: (value) => Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.mint,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const AppIcon('leaf', size: 16, color: AppColors.primary),
                      const SizedBox(width: 6),
                      Text(
                        '${value?.balance ?? 0} pts',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          if (_successMessage != null) ...[
            _SuccessBanner(
              message: _successMessage!,
              onOpen: _successVoucherId == null
                  ? null
                  : () => context.push(
                      '${AppRoutes.vouchers}/$_successVoucherId',
                    ),
            ),
            const SizedBox(height: 16),
          ],
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
              data: (balance) => balance == null
                  ? const Text('Your wallet could not be loaded.')
                  : _RewardGrid(
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
    _redeeming = false;
    _idempotencyKey =
        'redeem-${reward.id}-${DateTime.now().microsecondsSinceEpoch}';
    _successMessage = null;
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => StatefulBuilder(
        builder: (context, setDialogState) => RewardRedemptionDialog(
          reward: reward,
          balance: ref.read(walletSnapshotProvider).valueOrNull?.balance ?? 0,
          error: _redemptionError,
          isLoading: _redeeming,
          onConfirm: () => _redeem(context, setDialogState),
        ),
      ),
    );
  }

  Future<void> _redeem(
    BuildContext dialogContext,
    void Function(void Function()) setDialogState,
  ) async {
    final reward = _pendingReward;
    if (reward == null || _redeeming) return;
    final dialogNavigator = Navigator.of(dialogContext);
    setState(() => _redeeming = true);
    setDialogState(() {});
    try {
      final receipt = await ref
          .read(rewardsRepositoryProvider)
          .redeemReward(
            reward.id,
            _idempotencyKey!,
            offerVersion: reward.offerVersion,
            displayedCost: reward.pointsCost,
          );
      if (!mounted || !dialogNavigator.mounted) return;
      _redeeming = false;
      dialogNavigator.pop();
      ref
        ..invalidate(rewardsProvider)
        ..invalidate(vouchersProvider(null));
      setState(() {
        _successMessage =
            '${receipt.voucher.title} added to My vouchers. '
            'Code: ${receipt.voucher.code}';
        _successVoucherId = receipt.voucher.id;
      });
    } on AppFailure catch (failure) {
      if (mounted) {
        _redemptionError = switch (failure.code) {
          AppFailureCodes.insufficientPoints =>
            'You do not have enough points for this reward.',
          AppFailureCodes.conflict => 'You have reached the redemption limit.',
          AppFailureCodes.offerChanged =>
            'This offer changed. Refresh the rewards list and try again.',
          AppFailureCodes.redemptionLimitReached =>
            'You have reached the redemption limit for this reward.',
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
    spacing: 16,
    runSpacing: 12,
    children: [
      _chip(
        label: 'All rewards',
        selected: selected == null,
        onSelected: (_) => onSelected(null),
      ),
      ...categories.map(
        (category) => _chip(
          label: category.label,
          selected: selected == category.id,
          onSelected: (_) => onSelected(category.id),
        ),
      ),
    ],
  );

  ChoiceChip _chip({
    required String label,
    required bool selected,
    required ValueChanged<bool> onSelected,
  }) => ChoiceChip(
    label: Text(label),
    labelStyle: AppTypography.textTheme.labelMedium!.copyWith(
      color: selected ? AppColors.primaryDark : AppColors.text,
    ),
    selected: selected,
    selectedColor: AppColors.sage,
    backgroundColor: AppColors.mint,
    checkmarkColor: AppColors.primaryDark,
    side: selected
        ? const BorderSide(color: AppColors.primaryDark)
        : BorderSide.none,
    onSelected: onSelected,
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
        final textScale = MediaQuery.textScalerOf(context).scale(1);
        final columns = constraints.maxWidth >= 340 && textScale < 1.35 ? 2 : 1;
        final width = columns == 2
            ? (constraints.maxWidth - 12) / 2
            : constraints.maxWidth;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            for (final reward in rewards)
              SizedBox(
                width: width,
                child: RewardCard(
                  reward: reward,
                  balance: balance,
                  onRedeem: () => onRedeem(reward),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _SuccessBanner extends StatelessWidget {
  const _SuccessBanner({required this.message, required this.onOpen});

  final String message;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.mint,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: AppColors.onPrimaryPale),
    ),
    child: Row(
      children: [
        const Icon(Icons.check_circle, color: AppColors.primary),
        const SizedBox(width: 10),
        Expanded(child: Text(message)),
        if (onOpen != null)
          TextButton(onPressed: onOpen, child: const Text('Open voucher')),
      ],
    ),
  );
}
