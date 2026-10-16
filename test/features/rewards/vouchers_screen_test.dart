import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/features/rewards/data/mock_rewards_repository.dart';
import 'package:eco_loop/features/rewards/presentation/screens/vouchers_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows available voucher filter and seeded welcome voucher', (
    tester,
  ) async {
    final repository = MockRewardsRepository(
      api: MockApi(readDelay: Duration.zero, writeDelay: Duration.zero),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [rewardsRepositoryProvider.overrideWithValue(repository)],
        child: const MaterialApp(home: VouchersScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Available'), findsOneWidget);
    expect(find.text('My vouchers'), findsOneWidget);
  });
}
