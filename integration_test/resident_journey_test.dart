import 'package:eco_loop/app/eco_loop_app.dart';
import 'package:eco_loop/app/router/app_router.dart';
import 'package:eco_loop/app/router/app_routes.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('resident happy path reaches every connected destination', (
    tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: EcoLoopApp()));
    await _waitFor(tester, find.text('Good morning, Faris'));
    expect(find.text('245'), findsOneWidget);

    await tester.tap(find.text('How to recycle'));
    await tester.pumpAndSettle();
    expect(find.text('How to recycle'), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('Home'));
    await tester.pumpAndSettle();
    expect(find.text('Good morning, Faris'), findsOneWidget);

    await tester.tap(find.text('Scan a smart bin'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Simulate QR scan'));
    await _waitFor(tester, find.text('Smart bin found'));
    await tester.tap(find.text('Confirm bin'));
    await _waitFor(tester, find.text('Ready to recycle?'));
    await tester.tap(find.text('Press finish'));
    await _waitFor(tester, find.text('Items detected'));
    await tester.tap(find.text('Start verification'));
    await _waitFor(
      tester,
      find.text('Deposit complete'),
      timeout: const Duration(seconds: 8),
    );
    expect(find.text('+10 EcoPoints'), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('Home'));
    await tester.pumpAndSettle();
    expect(find.text('255'), findsOneWidget);
    expect(find.text('Good morning, Faris'), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('Settings'));
    await tester.pumpAndSettle();
    expect(find.text('Settings'), findsOneWidget);
    await tester.tap(find.text('Profile & personal details'));
    await tester.pumpAndSettle();
    expect(find.text('Profile & personal details'), findsOneWidget);
  });

  testWidgets('invalid direct voucher links recover to the voucher list', (
    tester,
  ) async {
    final router = createAppRouter();
    await tester.pumpWidget(
      ProviderScope(child: MaterialApp.router(routerConfig: router)),
    );
    await _waitFor(tester, find.text('Good morning, Faris'));
    router.go('/vouchers/%ZZ');
    await tester.pumpAndSettle();
    expect(router.state.uri.path, AppRoutes.vouchers);
    expect(find.text('Vouchers'), findsOneWidget);
  });
}

Future<void> _waitFor(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 4),
}) async {
  final end = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(end) && finder.evaluate().isEmpty) {
    await tester.pump(const Duration(milliseconds: 100));
  }
  expect(finder, findsOneWidget);
}
