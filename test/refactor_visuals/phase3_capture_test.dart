import 'dart:io';
import 'dart:ui' as ui;

import 'package:eco_loop/app/eco_loop_app.dart';
import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/app/router/app_router.dart';
import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_data_store.dart';
import 'package:eco_loop/core/mock/mock_seed_loader.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Renders the production scan composition at the reference viewport and
/// saves comparison captures for the visual checklist (V04–V08 plus the
/// QR scanner, which has no supplied pair).
void main() {
  Future<void> loadInterFonts() async {
    for (final weight in ['Regular', 'SemiBold', 'Bold', 'ExtraBold']) {
      final file = File('assets/fonts/Inter-$weight.ttf');
      if (!file.existsSync()) continue;
      final bytes = file.readAsBytesSync();
      final loader = FontLoader('Inter')
        ..addFont(
          Future.value(ByteData.view(bytes.buffer, bytes.offsetInBytes)),
        );
      await loader.load();
    }
  }

  var pumpSequence = 0;
  Key pumpKeyCurrent = ValueKey('capture-root-0');

  Future<void> capture(WidgetTester tester, String path) async {
    await tester.runAsync(() async {
      final boundary = tester.renderObject<RenderRepaintBoundary>(
        find.byKey(pumpKeyCurrent, skipOffstage: false),
      );
      final image = await boundary.toImage(pixelRatio: 1);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      final file = File(path);
      await file.create(recursive: true);
      await file.writeAsBytes(bytes!.buffer.asUint8List());
      image.dispose();
    });
  }

  testWidgets('phase 3 scan comparison captures', (tester) async {
    addTearDown(tester.view.reset);
    await tester.runAsync(loadInterFonts);

    // A controlled longer classification delay lets the processing stage be
    // captured while it actually runs; there is no manual completion button.
    final api = MockApi(
      readDelay: Duration.zero,
      writeDelay: const Duration(milliseconds: 30),
      classificationDelay: const Duration(seconds: 5),
    );
    MockDataStore? loadedStore;
    await tester.runAsync(() async {
      loadedStore = await const MockSeedLoader().loadStore();
    });
    final store = loadedStore!;
    final router = createAppRouter();
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    pumpKeyCurrent = ValueKey('capture-root-${pumpSequence++}');
    await tester.pumpWidget(
      RepaintBoundary(
        key: pumpKeyCurrent,
        child: ProviderScope(
          overrides: [
            appRouterProvider.overrideWithValue(router),
            mockDataStoreProvider.overrideWithValue(store),
            appClockProvider.overrideWithValue(store.clock),
            mockApiProvider.overrideWithValue(api),
          ],
          child: const EcoLoopApp(),
        ),
      ),
    );
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 350));
    }

    // QR scanner — no supplied pair; compared against the source composition.
    router.go(AppRoutes.scan);
    await tester.pump(const Duration(milliseconds: 350));
    await capture(tester, 'docs/refactor_visuals/phase3/scanner_390.png');

    // V04 — bin found.
    await tester.tap(find.text('Simulate QR scan'));
    for (var i = 0; i < 4; i++) {
      await tester.pump(const Duration(milliseconds: 350));
    }
    await capture(
      tester,
      'docs/refactor_visuals/phase3/scan_bin_found_390.png',
    );

    // V05 — ready.
    await tester.tap(find.text('Confirm session'));
    for (var i = 0; i < 4; i++) {
      await tester.pump(const Duration(milliseconds: 350));
    }
    await capture(tester, 'docs/refactor_visuals/phase3/scan_ready_390.png');

    // V06 — item detected.
    await tester.tap(find.text('I pressed the finish button'));
    for (var i = 0; i < 4; i++) {
      await tester.pump(const Duration(milliseconds: 350));
    }
    await capture(
      tester,
      'docs/refactor_visuals/phase3/scan_item_detected_390.png',
    );

    // V07 — processing, captured while the classification actually runs.
    await tester.tap(find.text('PET plastic bottles'));
    for (var i = 0; i < 4; i++) {
      await tester.pump(const Duration(milliseconds: 350));
    }
    await tester.tap(find.text('Continue'));
    for (var i = 0; i < 4; i++) {
      await tester.pump(const Duration(milliseconds: 350));
    }
    expect(find.text('Processing'), findsOneWidget);
    await capture(
      tester,
      'docs/refactor_visuals/phase3/scan_processing_390.png',
    );

    // V08 — result, after automatic completion.
    for (var i = 0; i < 40; i++) {
      await tester.pump(const Duration(milliseconds: 350));
    }
    expect(store.sessions.single['stage'], 'completed');
    router.go(AppRoutes.scanResultPath(store.sessions.single['id'].toString()));
    for (var i = 0; i < 4; i++) {
      await tester.pump(const Duration(milliseconds: 350));
    }
    expect(find.text('Back to home'), findsOneWidget);
    await capture(tester, 'docs/refactor_visuals/phase3/scan_result_390.png');
    await tester.pumpAndSettle();
  });
}
