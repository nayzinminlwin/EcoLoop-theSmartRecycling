import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_data_store.dart';
import 'package:eco_loop/features/rewards/data/mock_rewards_repository.dart';
import 'package:eco_loop/features/rewards/presentation/screens/rewards_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders catalog categories, rewards, and welcome voucher', (
    tester,
  ) async {
    final repository = MockRewardsRepository(
      store: MockDataStore(
        profile: const {'id': 'RES-000842'},
        wallet: const {
          'residentId': 'RES-000842',
          'balance': 245,
          'updatedAt': '2024-05-20T11:00:00+08:00',
          'version': 1,
        },
        deposits: const [],
      ),
      api: MockApi(readDelay: Duration.zero, writeDelay: Duration.zero),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [rewardsRepositoryProvider.overrideWithValue(repository)],
        child: const MaterialApp(home: RewardsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Rewards'), findsOneWidget);
    expect(find.text('Vending snack'), findsOneWidget);
    expect(find.text('RM3 Welcome voucher'), findsOneWidget);
  });
}
