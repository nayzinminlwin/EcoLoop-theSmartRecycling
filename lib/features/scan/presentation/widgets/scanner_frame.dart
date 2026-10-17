import 'dart:math' as math;

import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/shared/widgets/app_icon.dart';
import 'package:flutter/material.dart';

/// The dark 250px stage surface shared by every scan stage.
///
/// Source `.scanner`: height 250, radius 22, `#16251d` background, a radial
/// darkening overlay, and an optional 11px caption near the bottom edge. The
/// result stage swaps the background for the primary green (`.success`).
class ScannerStage extends StatelessWidget {
  const ScannerStage({
    required this.child,
    super.key,
    this.caption,
    this.success = false,
  });

  final Widget child;
  final String? caption;
  final bool success;

  @override
  Widget build(BuildContext context) => Container(
    height: 250,
    decoration: BoxDecoration(
      color: success ? AppColors.primary : AppColors.scanner,
      borderRadius: BorderRadius.circular(22),
    ),
    child: Stack(
      children: [
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              gradient: RadialGradient(
                colors: [
                  Colors.transparent,
                  Colors.black.withValues(alpha: .4),
                ],
              ),
            ),
          ),
        ),
        Center(child: child),
        if (caption != null)
          Positioned(
            left: 0,
            right: 0,
            bottom: 17,
            child: Text(
              caption!,
              textAlign: TextAlign.center,
              style: AppTypography.activityMetadata.copyWith(
                fontSize: 11,
                color: const Color(0xFFAAB9B0),
              ),
            ),
          ),
      ],
    ),
  );
}

/// Scanner-stage content: four 42px corner brackets and the scan icon,
/// matching the source `.scan-frame` (170px, 3px `#65bf8f` corners).
class ScannerFrameContent extends StatelessWidget {
  const ScannerFrameContent({super.key});

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 170,
    height: 170,
    child: Stack(
      alignment: Alignment.center,
      children: [
        const AppIcon('scan', size: 42, color: Color(0xFFAACABB)),
        Positioned(top: 0, left: 0, child: _corner(top: true, left: true)),
        Positioned(top: 0, right: 0, child: _corner(top: true, right: true)),
        Positioned(
          bottom: 0,
          left: 0,
          child: _corner(bottom: true, left: true),
        ),
        Positioned(
          bottom: 0,
          right: 0,
          child: _corner(bottom: true, right: true),
        ),
      ],
    ),
  );

  Widget _corner({
    bool top = false,
    bool right = false,
    bool bottom = false,
    bool left = false,
  }) => Container(
    width: 42,
    height: 42,
    decoration: const BoxDecoration().copyWith(
      border: Border(
        top: top
            ? const BorderSide(color: AppColors.scannerCorner, width: 3)
            : BorderSide.none,
        right: right
            ? const BorderSide(color: AppColors.scannerCorner, width: 3)
            : BorderSide.none,
        bottom: bottom
            ? const BorderSide(color: AppColors.scannerCorner, width: 3)
            : BorderSide.none,
        left: left
            ? const BorderSide(color: AppColors.scannerCorner, width: 3)
            : BorderSide.none,
      ),
    ),
  );
}

/// 105px mint circle used by the detected pulse and the success ring
/// (source `.pulse` / `.success-ring`: rgba(93,190,137,.16) fill with an
/// 18px outer ring at rgba(93,190,137,.06)).
class PulseCircle extends StatelessWidget {
  const PulseCircle({
    required this.child,
    super.key,
    this.animate = false,
    this.onWhite = false,
  });

  final Widget child;
  final bool animate;
  final bool onWhite;

  @override
  Widget build(context) {
    final ring = BoxDecoration(
      shape: BoxShape.circle,
      color: onWhite
          ? Colors.white.withValues(alpha: .14)
          : const Color(0x295DBE89),
      boxShadow: [
        BoxShadow(
          color: onWhite
              ? Colors.white.withValues(alpha: .06)
              : const Color(0x0F5DBE89),
          blurStyle: BlurStyle.solid,
          spreadRadius: 18,
        ),
      ],
    );
    if (!animate) {
      return Container(width: 105, height: 105, decoration: ring, child: child);
    }
    return _Pulsing(circle: ring, child: child);
  }
}

class _Pulsing extends StatefulWidget {
  const _Pulsing({required this.circle, required this.child});
  final BoxDecoration circle;
  final Widget child;

  @override
  State<_Pulsing> createState() => _PulsingState();
}

class _PulsingState extends State<_Pulsing>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  );

  @override
  void initState() {
    super.initState();
    _controller.repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scale = Tween<double>(
      begin: 1,
      end: 1.06,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
    return ScaleTransition(scale: scale, child: _staticCircle());
  }

  Widget _staticCircle() => Container(
    width: 105,
    height: 105,
    decoration: widget.circle,
    child: widget.child,
  );
}

/// Slow 2s spin used by the processing loader (source `@keyframes spin`).
class SpinningIcon extends StatefulWidget {
  const SpinningIcon({required this.child, super.key});

  final Widget child;

  @override
  State<SpinningIcon> createState() => _SpinningIconState();
}

class _SpinningIconState extends State<SpinningIcon>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 2),
  );

  @override
  void initState() {
    super.initState();
    _controller.repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _controller,
    child: widget.child,
    builder: (context, child) =>
        Transform.rotate(angle: _controller.value * 2 * math.pi, child: child),
  );
}
