import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/features/account/presentation/screens/settings_screen.dart';
import 'package:eco_loop/features/account/presentation/controllers/settings_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('settings renders resident details and account actions', (
    tester,
  ) async {
    await tester.pumpWidget(
      const ProviderScope(child: MaterialApp(home: SettingsScreen())),
    );
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Settings'), findsOneWidget);
    expect(find.text('Faris Rahman'), findsOneWidget);
    expect(find.text('Profile & personal details'), findsOneWidget);
    expect(find.text('Account security'), findsOneWidget);
    expect(find.text('Notifications'), findsOneWidget);
    expect(find.text('Sign out'), findsOneWidget);
  });

  testWidgets('settings provider can use an overridden account repository', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          settingsProfileProvider.overrideWith(
            (ref) => ref.watch(accountRepositoryProvider).watchProfile(),
          ),
        ],
        child: const MaterialApp(home: SettingsScreen()),
      ),
    );
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Settings'), findsOneWidget);
  });
}
