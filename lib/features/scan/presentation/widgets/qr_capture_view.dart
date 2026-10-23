import 'dart:async';

import 'package:eco_loop/core/diagnostics/app_logger.dart';
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
        autoStart: false,
        detectionSpeed: DetectionSpeed.normal,
        detectionTimeoutMs: 500,
      );
  late final bool _ownsController = widget.controller == null;
  bool _handlingCapture = false;
  bool _active = false;
  bool _cameraTransition = false;
  bool _cameraError = false;
  Timer? _syncDebounce;
  final AppLogger _logger = AppLogger();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _active = widget.visible && !widget.commandActive;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _syncCamera();
    });
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
    if (state == AppLifecycleState.resumed) {
      _active = widget.visible && !widget.commandActive;
      _debouncedSyncCamera();
    }
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
        if (_cameraError) {
          return _CameraStartError(
            message: _cameraErrorMessage(),
            onRetry: _retryCamera,
          );
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
    if (_cameraTransition) return;
    final state = _controller.value;
    if (_active && !state.isRunning && !state.isStarting) {
      _cameraTransition = true;
      unawaited(
        _controller.start().then((_) {
          if (mounted) {
            final error = _controller.value.error;
            if (error != null) {
              _logger.error(
                'scan.camera_start_failed',
                error,
                fields: <String, Object?>{
                  'errorCode': error.errorCode.name,
                  'platformCode': error.errorDetails?.code,
                  'platformMessage': error.errorDetails?.message,
                },
              );
            }
            setState(() => _cameraError = error != null);
          }
        }).catchError((Object error, StackTrace stackTrace) {
          _logger.error(
            'scan.camera_start_threw',
            error,
            fields: <String, Object?>{
              'stackTrace': stackTrace.toString(),
            },
          );
          if (mounted) setState(() => _cameraError = true);
        }).whenComplete(() {
          _cameraTransition = false;
          if (mounted && !_cameraError) _syncCamera();
        }),
      );
    } else if (!_active && state.isRunning) {
      _cameraTransition = true;
      unawaited(
        _controller.stop().whenComplete(() {
          _cameraTransition = false;
          if (mounted) _syncCamera();
        }),
      );
    }
  }

  void _retryCamera() {
    if (!mounted) return;
    setState(() => _cameraError = false);
    _active = widget.visible && !widget.commandActive;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _syncCamera();
    });
  }

  String _cameraErrorMessage() {
    final error = _controller.value.error;
    if (error == null) return 'Camera could not be started. Check that no other app is using it.';
    final detail = error.errorDetails?.message;
    return detail == null || detail.trim().isEmpty
        ? 'Camera could not be started (${error.errorCode.name}). Check that no other app is using it.'
        : 'Camera could not be started: $detail';
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

class _CameraStartError extends StatelessWidget {
  const _CameraStartError({
    required this.message,
    required this.onRetry,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => ScannerStage(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.warning_amber_rounded, color: Colors.amber, size: 42),
        const SizedBox(height: 10),
        Text(
          message,
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white),
        ),
        const SizedBox(height: 12),
        ElevatedButton(onPressed: onRetry, child: const Text('Try again')),
      ],
    ),
  );
}
