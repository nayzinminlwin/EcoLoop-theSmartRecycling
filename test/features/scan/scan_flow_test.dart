import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/app/router/app_router.dart';
import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_data_store.dart';
import 'package:eco_loop/core/theme/app_theme.dart';
import 'package:eco_loop/features/scan/data/mock_scan_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../fixtures/mock_scan_store.dart';

Future<(Widget, GoRouter)> pumpScanApp(
  WidgetTester tester, {
  MockDataStore? store,
  Duration classificationDelay = Duration.zero,
}) async {
  final effectiveStore = store ?? buildScanStore();
  final repository = MockScanRepository(
    store: effectiveStore,
    api: MockApi(
      readDelay: Duration.zero,
      writeDelay: Duration.zero,
      classificationDelay: classificationDelay,
    ),
  );
  final router = createAppRouter();
  final app = ProviderScope(
    overrides: [
      mockDataStoreProvider.overrideWithValue(effectiveStore),
      scanRepositoryProvider.overrideWithValue(repository),
    ],
    child: MaterialApp.router(theme: AppTheme.light, routerConfig: router),
  );
  // Phone-sized viewport so content below the first screen stays tappable.
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(app);
  return (app, router);
}

/// Repeated timed pumps instead of pumpAndSettle: the processing visual
/// animates forever, so the tree never settles on its own.
Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 4; i++) {
    await tester.pump(const Duration(milliseconds: 350));
  }
}

void main() {
  // Pumped first: a second app pump in one file can suffer binding
  // pollution, so the heaviest scenario runs before the smaller ones.
  testWidgets(
    'all stages are recognizably distinct and the happy path completes once',
    (tester) async {
      final store = buildScanStore();
      final (_, router) = await pumpScanApp(
        tester,
        store: store,
        classificationDelay: const Duration(seconds: 5),
      );
      router.go(AppRoutes.scan);
      await settle(tester);

      // Scanner → bin found (V04)
      await tester.tap(find.text('Simulate QR scan'));
      await settle(tester);
      expect(find.text('65%'), findsOneWidget);
      expect(find.textContaining('Cedar Residence'), findsWidgets);
      expect(find.text('Accepts'), findsOneWidget);
      expect(find.text('Confirm session'), findsOneWidget);

      // Bin found → ready (V05)
      await tester.tap(find.text('Confirm session'));
      await settle(tester);
      expect(find.text('READY'), findsOneWidget);
      expect(find.text('I pressed the finish button'), findsOneWidget);

      // Ready → item detected (V06)
      await tester.tap(find.text('I pressed the finish button'));
      await settle(tester);
      expect(find.text('Items detected'), findsWidgets);
      expect(find.text('Continue'), findsOneWidget);

      // Continue stays disabled until an image is explicitly selected.
      await tester.tap(find.text('Continue'));
      await settle(tester);
      expect(find.text('Items detected'), findsWidgets);
      await tester.tap(find.text('PET plastic bottles'));
      await settle(tester);

      // Detected → processing (V07): automatic completion through the mock
      // service; there is no manual completion button.
      await tester.tap(find.text('Continue'));
      await settle(tester);
      expect(find.text('Processing'), findsOneWidget);
      expect(find.textContaining('Complete verification'), findsNothing);

      // Processing completes by itself → result (V08)
      await tester.pump(const Duration(seconds: 5));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Verified'), findsOneWidget);
      expect(find.text('Deposit verified'), findsWidgets);
      expect(find.text('2 pcs'), findsOneWidget);
      expect(find.text('PET plastic bottles'), findsOneWidget);
      expect(find.text('+10'), findsOneWidget);
      expect(find.text('Back to home'), findsOneWidget);
      expect(find.text('I pressed the finish button'), findsNothing);

      // Exactly one committed credit/activity row/capacity increase.
      final wallet = store.wallet['wallet'] as Map;
      expect(wallet['balance'], 255);
      expect(store.deposits, hasLength(2));
      expect((store.bins.single['capacityPercent'] as num).toInt(), 85);

      // Result → back home.
      await tester.ensureVisible(find.text('Back to home'));
      // Advance past the page transition so the superseded stage page exits,
      // then scroll the surviving page's own view.
      await settle(tester);
      await tester.ensureVisible(find.text('Back to home'));
      await settle(tester);
      await tester.tap(find.text('Back to home'));
      await settle(tester);
      expect(find.text('Back to home'), findsNothing);
      await settle(tester);
      expect(find.text('Back to home'), findsNothing);
    },
  );

  testWidgets(
    'leaving during processing does not cancel; Scan resumes the result',
    (tester) async {
      final store = buildScanStore();
      final (_, router) = await pumpScanApp(
        tester,
        store: store,
        classificationDelay: const Duration(seconds: 5),
      );
      router.go(AppRoutes.scan);
      await settle(tester);
      await tester.tap(find.text('Simulate QR scan'));
      await settle(tester);
      await tester.tap(find.text('Confirm session'));
      await settle(tester);
      await tester.tap(find.text('I pressed the finish button'));
      await settle(tester);
      await tester.tap(find.text('PET plastic bottles'));
      await settle(tester);
      await tester.tap(find.text('Continue'));
      await settle(tester);
      expect(find.text('Processing'), findsOneWidget);

      // Leaving during processing never asks to cancel.
      await tester.tap(find.text('Home'));
      await settle(tester);
      expect(find.text('Continue session'), findsNothing);
      expect(find.text('Processing'), findsNothing);

      // The completion still finishes; Scan resumes the committed result
      // without replaying credit.
      await tester.pump(const Duration(seconds: 5));
      await settle(tester);
      await tester.tap(find.text('Scan'));
      await settle(tester);
      expect(find.text('Back to home'), findsOneWidget);
      final wallet = store.wallet['wallet'] as Map;
      expect(wallet['balance'], 255);
    },
  );

  testWidgets(
    'branch change during pre-processing asks whether to cancel or continue',
    (tester) async {
      final store = buildScanStore();
      final (_, router) = await pumpScanApp(tester, store: store);
      router.go(AppRoutes.scan);
      await settle(tester);
      await tester.tap(find.text('Simulate QR scan'));
      await settle(tester);

      await tester.tap(find.text('Home'));
      await settle(tester);
      expect(find.text('Continue session'), findsOneWidget);
      expect(find.text('Cancel session'), findsOneWidget);

      // Continue keeps the session and stays on the session screen.
      await tester.tap(find.text('Continue session'));
      await settle(tester);
      expect(find.text('Confirm session'), findsOneWidget);
      expect(store.sessions.single['stage'], 'binFound');
    },
  );

  testWidgets('pre-processing back asks whether to cancel or continue', (
    tester,
  ) async {
    final store = buildScanStore();
    final (_, router) = await pumpScanApp(tester, store: store);
    router.go(AppRoutes.scan);
    await settle(tester);
    await tester.tap(find.text('Simulate QR scan'));
    await settle(tester);
    expect(find.text('Confirm session'), findsOneWidget);

    await tester.tap(find.byKey(const Key('app-page-header-back')));
    await settle(tester);
    expect(find.text('Continue session'), findsOneWidget);
    expect(find.text('Cancel session'), findsOneWidget);

    await tester.tap(find.text('Cancel session'));
    await settle(tester);
    expect(find.text('Simulate QR scan'), findsOneWidget);
    expect(store.sessions.single['stage'], 'cancelled');
  });

  testWidgets('scanner route renders the dark camera-simulation stage', (
    tester,
  ) async {
    final (_, router) = await pumpScanApp(tester);
    router.go(AppRoutes.scan);
    await settle(tester);

    expect(find.text('Camera simulation'), findsOneWidget);
    expect(find.text('Scan a smart bin'), findsWidgets);
    expect(find.text('Simulate QR scan'), findsOneWidget);
    expect(find.text('Cancel'), findsOneWidget);
  });

  testWidgets('unknown session links offer recovery instead of a spinner', (
    tester,
  ) async {
    final (_, router) = await pumpScanApp(tester);
    router.go(AppRoutes.scanBinPath('missing-session'));
    await settle(tester);

    expect(
      find.text('This scan session is no longer available. Start a new scan.'),
      findsOneWidget,
    );
    expect(find.text('Back to scanner'), findsOneWidget);

    await tester.tap(find.text('Back to scanner'));
    await settle(tester);
    expect(find.text('Simulate QR scan'), findsOneWidget);
  });

  test('router registers every scan stage', () {
    final router = createAppRouter();
    expect(router.namedLocation(AppRoutes.scanName), AppRoutes.scan);
    expect(
      router.namedLocation(
        AppRoutes.scanProcessingName,
        pathParameters: {'sessionId': 's1'},
      ),
      '/scan/sessions/s1/processing',
    );
  });
}
