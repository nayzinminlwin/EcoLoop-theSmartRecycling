import 'package:eco_loop/features/account/domain/models/auth_state.dart';
import 'package:eco_loop/features/account/domain/models/resident_profile.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('profile derives first name and initials and round-trips', () {
    final profile = ResidentProfile(
      id: 'RES-1',
      fullName: 'Faris Rahman',
      email: 'faris@example.com',
      avatarUrl: null,
      createdAt: DateTime.parse('2024-01-01T00:00:00Z'),
    );
    expect(profile.firstName, 'Faris');
    expect(profile.initials, 'FR');
    expect(ResidentProfile.fromJson(profile.toJson()).id, 'RES-1');
  });

  test('auth role projection is limited to supported claims', () {
    expect(AppRole.fromWire('user'), AppRole.user);
    expect(AppRole.fromWire('unknown'), isNull);
    const state = AuthState(uid: 'RES-1', role: AppRole.user, isSignedIn: true);
    expect(state.isSignedIn, isTrue);
  });
}
