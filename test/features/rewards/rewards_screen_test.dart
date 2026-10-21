import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_theme.dart';
import 'package:eco_loop/features/rewards/data/mock_rewards_repository.dart';
import 'package:eco_loop/features/rewards/domain/models/reward.dart';
import 'package:eco_loop/features/rewards/domain/models/reward_category.dart';
import 'package:eco_loop/features/rewards/presentation/screens/rewards_screen.dart';
import 'package:eco_loop/features/wallet/domain/models/wallet_snapshot.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  testWidgets('renders readable production-theme category chips', (
    tester,
  ) async {
    final router = await pumpRewardsApp(tester, viewport: const Size(390, 844));

    final chips = tester
        .widgetList<ChoiceChip>(find.byType(ChoiceChip))
        .toList();
    expect(chips, hasLength(3));
    expect(chips.first.selected, isTrue);
    expect(chips.first.selectedColor, AppColors.sage);
    expect(chips.first.backgroundColor, AppColors.mint);
    expect(chips.first.checkmarkColor, AppColors.primaryDark);
    expect(chips.first.side, const BorderSide(color: AppColors.primaryDark));
    expect(chips.first.labelStyle?.color, AppColors.primaryDark);
    expect(chips[1].labelStyle?.color, AppColors.text);

    await tester.tap(find.text('Food'));
    await tester.pumpAndSettle();

    expect(
      router.routeInformationProvider.value.uri.toString(),
      '/rewards?category=food',
    );
    final selectedChip = tester.widget<ChoiceChip>(
      find.widgetWithText(ChoiceChip, 'Food'),
    );
    expect(selectedChip.selected, isTrue);
    expect(selectedChip.labelStyle?.color, AppColors.primaryDark);
    expect(find.text('RM3 Welcome voucher'), findsNothing);
    expect(find.text('Cafe meal voucher'), findsOneWidget);
  });

  testWidgets('renders all reward action states at a 55-point balance', (
    tester,
  ) async {
    await pumpRewardsApp(tester, viewport: const Size(390, 844));

    expect(find.text('Redeem'), findsOneWidget);
    expect(find.text('Not enough points'), findsOneWidget);
    expect(find.text('Redeemed'), findsOneWidget);

    final redeemButton = tester.widget<ElevatedButton>(
      find.ancestor(
        of: find.text('Redeem'),
        matching: find.byType(ElevatedButton),
      ),
    );
    final unavailableButton = tester.widget<ElevatedButton>(
      find.ancestor(
        of: find.text('Not enough points'),
        matching: find.byType(ElevatedButton),
      ),
    );
    final redeemedButton = tester.widget<ElevatedButton>(
      find.ancestor(
        of: find.text('Redeemed'),
        matching: find.byType(ElevatedButton),
      ),
    );

    expect(redeemButton.onPressed, isNotNull);
    expect(unavailableButton.onPressed, isNull);
    expect(redeemedButton.onPressed, isNull);
    expect(
      unavailableButton.style?.backgroundColor?.resolve({WidgetState.disabled}),
      AppColors.grayBackground,
    );
    expect(
      unavailableButton.style?.foregroundColor?.resolve({WidgetState.disabled}),
      AppColors.grayText,
    );
  });

  testWidgets('keeps the catalog scrollable without overflow at target sizes', (
    tester,
  ) async {
    await pumpRewardsApp(tester, viewport: const Size(360, 844));
    expect(
      tester.getTopLeft(find.text('Cafe meal voucher')).dy,
      lessThan(tester.getTopLeft(find.text('Shopping voucher')).dy),
    );
    expect(tester.takeException(), isNull);

    await pumpRewardsApp(tester, viewport: const Size(390, 844));
    expect(
      tester.getTopLeft(find.text('Cafe meal voucher')).dy,
      tester.getTopLeft(find.text('Shopping voucher')).dy,
    );
    expect(tester.takeException(), isNull);

    await pumpRewardsApp(
      tester,
      viewport: const Size(390, 844),
      textScaler: const TextScaler.linear(1.5),
    );
    expect(
      tester.getTopLeft(find.text('Cafe meal voucher')).dy,
      lessThan(tester.getTopLeft(find.text('Shopping voucher')).dy),
    );
    expect(tester.takeException(), isNull);
    expect(find.text('My vouchers'), findsOneWidget);
  });
}

Future<GoRouter> pumpRewardsApp(
  WidgetTester tester, {
  required Size viewport,
  TextScaler textScaler = TextScaler.noScaling,
}) async {
  final repository = MockRewardsRepository(
    api: MockApi(readDelay: Duration.zero, writeDelay: Duration.zero),
    categories: const [
      RewardCategory(id: 'food', label: 'Food', sortOrder: 1),
      RewardCategory(id: 'shopping', label: 'Shopping', sortOrder: 2),
    ],
    rewards: _rewards,
  );
  final wallet = WalletSnapshot(
    residentId: 'RES-000842',
    balance: 55,
    nextRewardCost: 75,
    updatedAt: DateTime(2024, 5, 20, 11),
    version: 1,
  );
  final router = GoRouter(
    initialLocation: '/rewards',
    routes: [
      GoRoute(
        path: '/rewards',
        builder: (context, state) =>
            RewardsScreen(categoryId: state.uri.queryParameters['category']),
      ),
    ],
  );

  tester.view.physicalSize = viewport;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        rewardsRepositoryProvider.overrideWithValue(repository),
        walletSnapshotProvider.overrideWith((ref) => Stream.value(wallet)),
      ],
      child: MediaQuery(
        data: MediaQueryData(textScaler: textScaler),
        child: MaterialApp.router(
          theme: AppTheme.light,
          routerConfig: router,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: textScaler),
            child: child!,
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

final _rewards = [
  RewardDocument(
    id: 'redeemable',
    title: 'Cafe meal voucher',
    description: 'A redeemable meal.',
    merchantName: 'Cafe',
    categoryId: 'food',
    tag: null,
    imageUrl: null,
    pointsCost: 50,
    expiresAt: DateTime(2027),
    isActive: true,
    maxRedemptionsPerResident: 2,
    artKey: 'meal',
    sortOrder: 1,
  ),
  RewardDocument(
    id: 'unaffordable',
    title: 'Shopping voucher',
    description: 'An unaffordable voucher.',
    merchantName: 'Shop',
    categoryId: 'shopping',
    tag: null,
    imageUrl: null,
    pointsCost: 75,
    expiresAt: DateTime(2027),
    isActive: true,
    maxRedemptionsPerResident: 2,
    artKey: 'shopping',
    sortOrder: 2,
  ),
  RewardDocument(
    id: 'at-limit',
    title: 'Welcome voucher',
    description: 'A voucher at its limit.',
    merchantName: 'Welcome',
    categoryId: 'food',
    tag: null,
    imageUrl: null,
    pointsCost: 25,
    expiresAt: DateTime(2027),
    isActive: true,
    maxRedemptionsPerResident: 0,
    artKey: 'cafe',
    sortOrder: 3,
  ),
];
