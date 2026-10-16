import 'dart:async';

import 'package:eco_loop/features/account/domain/models/auth_state.dart';
import 'package:eco_loop/features/account/domain/repositories/account_repository.dart';
import 'package:flutter/foundation.dart';

import 'app_routes.dart';

class RouteGuards extends ChangeNotifier {
  RouteGuards(AccountRepository repository) {
    _subscription = repository.watchAuthState().listen(
      (value) {
        _authState = value;
        notifyListeners();
      },
      onError: (_) {
        _authState = null;
        notifyListeners();
      },
    );
  }

  AuthState? _authState;
  late final StreamSubscription<AuthState> _subscription;

  bool get isResolved => _authState != null;
  bool get isResident =>
      _authState?.isSignedIn == true && _authState?.role == AppRole.user;

  String? redirect(String location) {
    final isSignedOut = location == AppRoutes.signedOut;
    final isRoot = location == AppRoutes.root;
    // The app starts at root, while direct links remain renderable until the
    // first auth snapshot arrives and can apply the session guard.
    if (!isResolved) return null;
    if (!isResident) return isSignedOut ? null : AppRoutes.signedOut;
    if (isSignedOut || isRoot) return AppRoutes.home;
    return null;
  }

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
