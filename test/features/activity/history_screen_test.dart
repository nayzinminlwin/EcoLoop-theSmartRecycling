import 'package:eco_loop/features/activity/presentation/screens/history_screen.dart';
import 'package:eco_loop/core/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('history renders deposits and opens typed filters', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(theme: AppTheme.light, home: const HistoryScreen()),
      ),
    );
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('Recycling history'), findsOneWidget);
    expect(find.text('PET plastic'), findsWidgets);
    expect(find.text('Verified'), findsWidgets);

    await tester.tap(find.byTooltip('Filter history'));
    await tester.pumpAndSettle();
    expect(find.text('Filter history'), findsOneWidget);
    expect(find.text('Last 7 days'), findsOneWidget);

    await tester.tap(find.text('Review').last);
    await tester.tap(find.text('Apply'));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Paper'), findsOneWidget);
  });
}
