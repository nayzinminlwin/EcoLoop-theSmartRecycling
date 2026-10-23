import 'dart:io';
import 'dart:ui' as ui;

import 'package:eco_loop/app/eco_loop_app.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Renders the production composition at reference viewport sizes and saves
/// comparison captures for the visual checklist (V01–V03).
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

  Future<void> pumpAt(WidgetTester tester, double width) async {
    tester.view.physicalSize = Size(width, 844);
    tester.view.devicePixelRatio = 1;
    pumpKeyCurrent = ValueKey('capture-root-${pumpSequence++}');
    await tester.pumpWidget(
      RepaintBoundary(
        key: pumpKeyCurrent,
        child: const ProviderScope(child: EcoLoopApp()),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('phase 2 comparison captures', (tester) async {
    addTearDown(tester.view.reset);
    await tester.runAsync(loadInterFonts);

    // V01 — home, top position at 390.
    await pumpAt(tester, 390);
    await capture(tester, 'docs/archive/refactor_visuals/phase2/home_390_top.png');

    // V02 — home scrolled to the recent activity section.
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -560));
    await tester.pumpAndSettle();
    await capture(tester, 'docs/archive/refactor_visuals/phase2/home_390_activity.png');

    // V03 — history page.
    await tester.drag(find.byType(Scrollable).first, const Offset(0, 800));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Recycling history').first, warnIfMissed: false);
    await tester.pumpAndSettle();
    await capture(tester, 'docs/archive/refactor_visuals/phase2/history_390.png');

    // Home at 480 for the constrained-frame check.
    await pumpAt(tester, 480);
    await capture(tester, 'docs/archive/refactor_visuals/phase2/home_480_top.png');

    // 320 spot check.
    await pumpAt(tester, 320);
    expect(tester.takeException(), isNull);
    await capture(tester, 'docs/archive/refactor_visuals/phase2/home_320_top.png');
  });
}
