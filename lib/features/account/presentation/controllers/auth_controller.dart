import 'package:flutter/foundation.dart';

import '../../domain/models/auth_state.dart';
import '../../domain/repositories/account_repository.dart';
import '../../../../core/data/exit_intent_coordinator.dart';

enum AuthControllerStatus { idle, signingIn, signedIn, cancelled, error }

class AuthController extends ChangeNotifier {
  AuthController(this._repository, [this._exitCoordinator]);

  final AccountRepository _repository;
  final ExitIntentCoordinator? _exitCoordinator;
  AuthControllerStatus status = AuthControllerStatus.idle;
  AuthState? authState;
  Object? error;

  Future<void> signIn() async {
    status = AuthControllerStatus.signingIn;
    error = null;
    notifyListeners();
    try {
      authState = await _repository.signInWithGoogle();
      if (authState?.isSignedIn == true) {
        _exitCoordinator?.clearSignedOutFence();
      }
      status = authState?.isSignedIn == true
          ? AuthControllerStatus.signedIn
          : AuthControllerStatus.cancelled;
    } catch (value) {
      error = value;
      status = AuthControllerStatus.error;
    }
    notifyListeners();
  }

  Future<void> signOut() async {
    await _repository.signOut();
    authState = const AuthState(uid: null, role: null, isSignedIn: false);
    status = AuthControllerStatus.idle;
    notifyListeners();
  }
}
