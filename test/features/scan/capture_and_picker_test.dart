import 'dart:async';

import 'package:eco_loop/features/scan/domain/models/simulation_asset.dart';
import 'package:eco_loop/features/scan/presentation/widgets/qr_capture_view.dart';
import 'package:eco_loop/features/scan/presentation/widgets/simulation_asset_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'picker is controlled and a second selection replaces the first',
    (tester) async {
      final assets = [_asset('asset-1'), _asset('asset-2')];
      String? selected;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SimulationAssetPicker(
              assets: assets,
              selectedAssetId: selected,
              onAssetSelected: (asset) => selected = asset.id,
            ),
          ),
        ),
      );

      await tester.tap(find.text('asset-1'));
      expect(selected, 'asset-1');
      await tester.tap(find.text('asset-2'));
      expect(selected, 'asset-2');
    },
  );

  testWidgets('capture callback is debounced while command is active', (
    tester,
  ) async {
    final captured = <String>[];
    final callbacks = <ValueChanged<String>>[];
    final completion = Completer<void>();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: QrCaptureView(
            onCodeCaptured: (value) async {
              captured.add(value);
              await completion.future;
            },
            surfaceBuilder: (_, onCode) {
              callbacks.add(onCode);
              return const SizedBox();
            },
          ),
        ),
      ),
    );

    callbacks.single('first');
    callbacks.single('duplicate');
    await tester.pump();
    expect(captured, ['first']);
    completion.complete();
    await tester.pump();
  });

  testWidgets('capture surface is released when hidden and disposed', (
    tester,
  ) async {
    var captures = 0;
    final callback = <ValueChanged<String>>[];
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: QrCaptureView(
            visible: false,
            onCodeCaptured: (_) async => captures++,
            surfaceBuilder: (_, onCode) {
              callback.add(onCode);
              return const Text('camera surface');
            },
          ),
        ),
      ),
    );
    callback.single('ignored');
    expect(captures, 0);
    await tester.pumpWidget(const SizedBox());
    expect(find.text('camera surface'), findsNothing);
  });

  testWidgets('camera denial is rendered through the permission seam', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: QrCaptureView(
            permissionOverride: QrCameraPermission.denied,
            onCodeCaptured: _ignoreCapture,
            surfaceBuilder: _emptySurface,
          ),
        ),
      ),
    );

    expect(
      find.textContaining('Camera permission is required'),
      findsOneWidget,
    );
  });
}

Future<void> _ignoreCapture(String _) async {}

Widget _emptySurface(BuildContext _, ValueChanged<String> _) =>
    const SizedBox();

SimulationAsset _asset(String id) => SimulationAsset(
  id: id,
  enabled: true,
  version: 'v1',
  mimeType: 'image/png',
  width: 100,
  height: 100,
  contentSha256: 'a' * 64,
  displayName: id,
  sortOrder: 1,
  storageReference: null,
);
