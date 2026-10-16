import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/app/router/app_router.dart';
import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/features/scan/data/mock_scan_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

void main() {
  testWidgets('scan route renders the scanner simulation', (tester) async {
    final router = createAppRouter();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          scanRepositoryProvider.overrideWithValue(MockScanRepository()),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pump();
    router.go(AppRoutes.scan);
    await tester.pumpAndSettle();
    expect(find.text('Scan a smart bin'), findsOneWidget);
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
