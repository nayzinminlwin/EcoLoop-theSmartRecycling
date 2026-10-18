import 'package:flutter/foundation.dart';

import '../../domain/models/auth_state.dart';
import '../../domain/repositories/account_repository.dart';

enum AuthControllerStatus { idle, signingIn, signedIn, cancelled, error }

class AuthController extends ChangeNotifier {
  AuthController(this._repository);

  final AccountRepository _repository;
  AuthControllerStatus status = AuthControllerStatus.idle;
  AuthState? authState;
  Object? error;

  Future<void> signIn() async {
    status = AuthControllerStatus.signingIn;
    error = null;
    notifyListeners();
    try {
      authState = await _repository.signInWithGoogle();
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
