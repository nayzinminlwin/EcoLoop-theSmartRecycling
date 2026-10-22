import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/features/rewards/data/mock_rewards_repository.dart';
import 'package:eco_loop/features/rewards/presentation/screens/vouchers_screen.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_theme.dart';
import 'package:eco_loop/features/rewards/domain/models/resident_voucher.dart';
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
        child: MaterialApp(theme: AppTheme.light, home: const VouchersScreen()),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Available'), findsOneWidget);
    expect(find.text('My vouchers'), findsOneWidget);

    final available = tester.widget<ChoiceChip>(
      find.widgetWithText(ChoiceChip, 'Available'),
    );
    final used = tester.widget<ChoiceChip>(
      find.widgetWithText(ChoiceChip, 'Used'),
    );
    expect(available.selected, isFalse);
    expect(available.backgroundColor, AppColors.mint);
    expect(available.checkmarkColor, AppColors.primaryDark);
    expect(available.side, BorderSide.none);
    expect(used.labelStyle?.color, AppColors.text);
  });

  testWidgets('uses the same selected styling as reward filters', (
    tester,
  ) async {
    final repository = MockRewardsRepository(
      api: MockApi(readDelay: Duration.zero, writeDelay: Duration.zero),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [rewardsRepositoryProvider.overrideWithValue(repository)],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const VouchersScreen(status: VoucherStatus.available),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    final available = tester.widget<ChoiceChip>(
      find.widgetWithText(ChoiceChip, 'Available'),
    );
    expect(available.selected, isTrue);
    expect(available.selectedColor, AppColors.sage);
    expect(available.checkmarkColor, AppColors.primaryDark);
    expect(available.side, const BorderSide(color: AppColors.primaryDark));
    expect(available.labelStyle?.color, AppColors.primaryDark);
  });
}
