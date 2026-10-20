import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'scanner_frame.dart';

enum QrCameraPermission { unknown, granted, denied }

typedef QrSurfaceBuilder = Widget Function(
  BuildContext context,
  ValueChanged<String> onCode,
);

class QrCaptureView extends StatefulWidget {
  const QrCaptureView({
    required this.onCodeCaptured,
    super.key,
    this.commandActive = false,
    this.visible = true,
    this.controller,
    this.surfaceBuilder,
    this.permissionOverride,
  });

  final Future<void> Function(String code) onCodeCaptured;
  final bool commandActive;
  final bool visible;
  final MobileScannerController? controller;
  final QrSurfaceBuilder? surfaceBuilder;
  final QrCameraPermission? permissionOverride;

  @override
  State<QrCaptureView> createState() => _QrCaptureViewState();
}

class _QrCaptureViewState extends State<QrCaptureView>
    with WidgetsBindingObserver {
  late final MobileScannerController _controller =
      widget.controller ??
      MobileScannerController(
        detectionSpeed: DetectionSpeed.normal,
        detectionTimeoutMs: 500,
      );
  late final bool _ownsController = widget.controller == null;
  bool _handlingCapture = false;
  bool _active = false;
  Timer? _syncDebounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _active = widget.visible && !widget.commandActive;
    _syncCamera();
  }

  @override
  void didUpdateWidget(covariant QrCaptureView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.visible != widget.visible ||
        oldWidget.commandActive != widget.commandActive) {
      _active = widget.visible && !widget.commandActive;
      _debouncedSyncCamera();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _active =
        widget.visible &&
        !widget.commandActive &&
        state == AppLifecycleState.resumed;
    _debouncedSyncCamera();
  }

  void _debouncedSyncCamera() {
    _syncDebounce?.cancel();
    _syncDebounce = Timer(const Duration(milliseconds: 300), _syncCamera);
  }

  @override
  void dispose() {
    _syncDebounce?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    if (_ownsController) unawaited(_controller.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final surface =
        widget.surfaceBuilder?.call(context, _handleCode) ??
        _productionSurface();
    return ValueListenableBuilder<MobileScannerState>(
      valueListenable: _controller,
      builder: (context, state, child) {
        if (widget.permissionOverride == QrCameraPermission.denied ||
            state.error?.errorCode == MobileScannerErrorCode.permissionDenied) {
          return const _CameraDenied();
        }
        return ScannerStage(child: child!);
      },
      child: surface,
    );
  }

  Widget _productionSurface() => MobileScanner(
    controller: _controller,
    onDetect: (capture) {
      for (final barcode in capture.barcodes) {
        final value = barcode.rawValue;
        if (value != null && value.trim().isNotEmpty) {
          _handleCode(value);
          break;
        }
      }
    },
  );

  void _syncCamera() {
    if (widget.surfaceBuilder != null) return;
    final state = _controller.value;
    if (!state.isInitialized && !state.isStarting) {
      if (_active) unawaited(_controller.start());
      return;
    }
    if (state.isStarting) return; // Guard: don't call start while initializing
    if (_active && !state.isRunning) {
      unawaited(_controller.start());
    } else if (!_active && state.isRunning) {
      unawaited(_controller.stop());
    }
  }

  void _handleCode(String value) {
    if (!_active || _handlingCapture || widget.commandActive) return;
    final normalized = value.trim();
    if (normalized.isEmpty) return;
    _handlingCapture = true;
    _active = false;
    unawaited(
      _controller.stop().then((_) async {
        try {
          await widget.onCodeCaptured(normalized);
        } finally {
          _handlingCapture = false;
          if (mounted && widget.visible && !widget.commandActive) {
            _active = true;
            _syncCamera();
          }
        }
      }),
    );
  }
}

class _CameraDenied extends StatelessWidget {
  const _CameraDenied();

  @override
  Widget build(BuildContext context) => const Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(Icons.no_photography_outlined, color: Colors.white, size: 42),
      SizedBox(height: 10),
      Text(
        'Camera permission is required to scan a bin QR code.',
        textAlign: TextAlign.center,
        style: TextStyle(color: Colors.white),
      ),
    ],
  );
}
