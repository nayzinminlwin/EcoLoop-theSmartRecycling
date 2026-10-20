import '../models/auth_state.dart';
import '../models/account_security_info.dart';
import '../models/demo_session.dart';
import '../models/notification_preferences.dart';
import '../models/password_change_request.dart';
import '../models/profile_update_request.dart';
import '../models/resident_profile.dart';

abstract interface class AccountRepository {
  Future<AuthState> signInWithGoogle();
  Future<AuthState> getAuthState();
  Stream<AuthState> watchAuthState();
  Future<ResidentProfile> getProfile();
  Stream<ResidentProfile?> watchProfile();
  Future<ResidentProfile> updateProfile(ProfileUpdateRequest request);
  Future<AccountSecurityInfo> getSecurityInfo();
  Future<AccountSecurityInfo> changePassword(PasswordChangeRequest request);
  Future<NotificationPreferences> getNotificationPreferences();
  Future<NotificationPreferences> updateNotificationPreferences(
    NotificationPreferences preferences,
  );
  Future<DemoSession> getDemoSession();
  Future<void> signOut();
  Future<DemoSession> resumeDemoSession();
  Stream<AccountSecurityInfo?> watchSecurityInfo();
  Stream<NotificationPreferences?> watchNotificationPreferences();
  Stream<DemoSession> watchDemoSession();
}
