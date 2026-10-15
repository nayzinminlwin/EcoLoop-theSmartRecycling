import '../models/auth_state.dart';
import '../models/resident_profile.dart';

abstract interface class AccountRepository {
  Future<AuthState> getAuthState();
  Stream<AuthState> watchAuthState();
  Future<ResidentProfile> getProfile();
  Stream<ResidentProfile?> watchProfile();
}
