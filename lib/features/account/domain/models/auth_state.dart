enum AppRole {
  user('user'),
  admin('admin');

  const AppRole(this.wireValue);
  final String wireValue;

  static AppRole? fromWire(String? value) {
    for (final item in values) {
      if (item.wireValue == value) return item;
    }
    return null;
  }
}

class AuthState {
  const AuthState({
    required this.uid,
    required this.role,
    required this.isSignedIn,
  });

  final String? uid;
  final AppRole? role;
  final bool isSignedIn;
}
