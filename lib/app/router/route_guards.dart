import 'dart:async';

import 'package:eco_loop/features/account/domain/models/auth_state.dart';
import 'package:eco_loop/features/account/domain/repositories/account_repository.dart';
import 'package:flutter/foundation.dart';

import 'app_routes.dart';

class RouteGuards extends ChangeNotifier {
  RouteGuards(this._repository) {
    _subscribe();
  }

  final AccountRepository _repository;
  StreamSubscription<AuthState>? _subscription;
  AuthState? _authState;
  Object? _error;

  bool get isResolved => _authState != null;
  bool get hasError => _error != null;
  bool get isResident =>
      _authState?.isSignedIn == true && _authState?.role == AppRole.user;

  void _subscribe() {
    _subscription = _repository.watchAuthState().listen(
      (value) {
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
  }

  Future<void> retry() async {
    await _subscription?.cancel();
    _authState = null;
    _error = null;
    _subscribe();
    notifyListeners();
  }

  String? redirect(String location) {
    final isSignedOut = location == AppRoutes.signedOut;
    final isRoot = location == AppRoutes.root;
    if (hasError) return isRoot ? null : AppRoutes.root;
    if (!isResolved) return isRoot ? null : AppRoutes.root;
    if (!isResident) return isSignedOut ? null : AppRoutes.signedOut;
    if (isSignedOut || isRoot) return AppRoutes.home;
    return null;
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}
