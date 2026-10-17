import 'package:flutter/foundation.dart';

/// Outcome of a leave decision guard.
enum LeaveDecision { stay, leave }

/// Single app-level hook that guards app-wide leave transitions.
///
/// Features that own unsaved or in-flight work (scan sessions in Phase 3,
/// dirty account forms in Phase 5) register a guard through [register]. The
/// shell consults [confirmLeave] before branch switches or resets; the shell
/// itself never duplicates feature-specific confirmation dialogs.
class LeaveDecisionCoordinator {
  final List<Future<LeaveDecision> Function()> _guards = [];

  /// Registers a guard and returns a disposer that removes it.
  VoidCallback register(Future<LeaveDecision> Function() guard) {
    _guards.add(guard);
    return () => _guards.remove(guard);
  }

  /// Runs every registered guard in registration order. Returns true only
  /// when all guards allow the transition.
  Future<bool> confirmLeave() async {
    for (final guard in List.of(_guards)) {
      if (await guard() == LeaveDecision.stay) return false;
    }
    return true;
  }
}
