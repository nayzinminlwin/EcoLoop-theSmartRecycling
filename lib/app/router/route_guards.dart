import 'dart:async';

import 'package:eco_loop/features/account/domain/models/auth_state.dart';
import 'package:eco_loop/features/account/domain/repositories/account_repository.dart';
import 'package:flutter/foundation.dart';

import 'app_routes.dart';
import '../../core/data/exit_intent_coordinator.dart';

class RouteGuards extends ChangeNotifier {
  RouteGuards(this._repository, [this._exitCoordinator]) {
    _subscribe();
  }

  final AccountRepository _repository;
  final ExitIntentCoordinator? _exitCoordinator;
  StreamSubscription<AuthState>? _subscription;
  AuthState? _authState;
  Object? _error;
  String? _pendingLocation;

  bool get isResolved => _authState != null;
  bool get hasError => _error != null;
  bool get isResident =>
      _exitCoordinator?.isLocallySignedOut != true &&
      _authState?.isSignedIn == true &&
      _authState?.role == AppRole.user;

  void _subscribe() {
    _subscription = _repository.watchAuthState().listen(
      (value) {
        final signedOutAfterResidentSession =
            _authState?.isSignedIn == true && !value.isSignedIn;
        if (signedOutAfterResidentSession) _pendingLocation = null;
        _authState = value;
        _error = null;
        notifyListeners();
      },
      onError: (error) {
        _authState = null;
        _error = error;
        notifyListeners();
      },
    );
    unawaited(_resolveInitialState());
  }

  Future<void> _resolveInitialState() async {
    try {
      final value = await _repository.getAuthState();
      if (_authState == null) {
        _authState = value;
        _error = null;
        notifyListeners();
      }
    } catch (error) {
      if (_authState == null) {
        _error = error;
        notifyListeners();
      }
    }
  }

  Future<void> retry() async {
    await _subscription?.cancel();
    _authState = null;
    _error = null;
    _subscribe();
    notifyListeners();
  }

  String? redirect(Uri uri) {
    final location = uri.path;
    final isSignedOut = location == AppRoutes.signedOut;
    final isRoot = location == AppRoutes.root;
    if (hasError) return isRoot ? null : AppRoutes.root;
    if (!isResolved) {
      // Park cold-start deep links on the bootstrap screen and remember the
      // full URI (path, query, fragment) so restoration can resume it.
      if (!isRoot) _pendingLocation = uri.toString();
      return isRoot ? null : AppRoutes.root;
    }
    if (!isResident) {
      if (!isSignedOut && !isRoot) _pendingLocation = uri.toString();
      return isSignedOut ? null : AppRoutes.signedOut;
    }
    if (isSignedOut) return _consumePending();
    if (isRoot) return _consumePending();
    return null;
  }

  String _consumePending() {
    final pending = _pendingLocation;
    _pendingLocation = null;
    return pending ?? AppRoutes.home;
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}
