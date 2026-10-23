import 'package:eco_loop/features/home/presentation/screens/home_screen.dart';
import 'package:eco_loop/features/home/presentation/widgets/home_greeting.dart';
import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:eco_loop/core/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('home composes dashboard values from mock repositories', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(theme: AppTheme.light, home: const HomeScreen()),
      ),
    );
    await tester.pump(const Duration(seconds: 2));

    expect(find.text('Good morning, Faris'), findsOneWidget);
    expect(find.text('245'), findsOneWidget);
    expect(find.text('105 points to your next reward'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
    expect(find.text('1.04 kg'), findsOneWidget);
    expect(find.text('Recent recycling'), findsOneWidget);
  });

  for (final testCase in [
    (hour: 11, label: 'Good morning, Faris'),
    (hour: 12, label: 'Good afternoon, Faris'),
    (hour: 18, label: 'Good night, Faris'),
    (hour: 4, label: 'Good night, Faris'),
  ]) {
    testWidgets('home greeting follows local hour ${testCase.hour}', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: HomeGreeting(
            name: 'Faris',
            initials: 'FR',
            clock: AppClock(
              now: DateTime.utc(2024, 5, 20, testCase.hour),
              utcOffsetMinutes: 0,
            ),
          ),
        ),
      );

      expect(find.text(testCase.label), findsOneWidget);
    });
  }
}
