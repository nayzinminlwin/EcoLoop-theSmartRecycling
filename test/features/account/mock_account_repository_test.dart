import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_data_store.dart';
import 'package:eco_loop/features/account/data/mock_account_repository.dart';
import 'package:eco_loop/features/account/domain/models/password_change_request.dart';
import 'package:eco_loop/features/account/domain/models/profile_update_request.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final clock = AppClock();

  MockAccountRepository createRepository() {
    final store = MockDataStore(
      profile: const {
        'id': 'RES-000842',
        'fullName': 'Faris Rahman',
        'email': 'faris@example.com',
        'avatarUrl': null,
        'createdAt': '2024-01-12T08:00:00+08:00',
      },
      wallet: const {},
      deposits: const [],
      security: const {
        'residentId': 'RES-000842',
        'passwordUpdatedAt': '2024-04-20T11:00:00+08:00',
        'isProtected': true,
      },
      session: const {
        'id': 'demo-session',
        'residentId': 'RES-000842',
        'isSignedIn': true,
        'startedAt': '2024-05-20T11:00:00+08:00',
      },
      clock: clock,
    );
    return MockAccountRepository(
      store: store,
      api: MockApi(readDelay: Duration.zero, writeDelay: Duration.zero),
      clock: clock,
    );
  }

  test('profile updates trim fields and preserve the avatar URL', () async {
    final repository = createRepository();
    final profile = await repository.updateProfile(
      const ProfileUpdateRequest(
        fullName: '  Amina Noor ',
        email: ' amina@example.com ',
        avatarUrl: 'https://example.test/avatar.png',
      ),
    );

    expect(profile.fullName, 'Amina Noor');
    expect(profile.email, 'amina@example.com');
    expect(profile.avatarUrl, 'https://example.test/avatar.png');
    expect((await repository.getProfile()).fullName, 'Amina Noor');
  });

  test('wrong password does not change security metadata', () async {
    final repository = createRepository();
    final before = await repository.getSecurityInfo();

    await expectLater(
      repository.changePassword(
        const PasswordChangeRequest(
          currentPassword: 'wrong',
          newPassword: 'ValidPass1',
        ),
      ),
      throwsA(
        isA<AppFailure>().having(
          (failure) => failure.code,
          'code',
          AppFailureCodes.validation,
        ),
      ),
    );
    expect(
      (await repository.getSecurityInfo()).passwordUpdatedAt,
      before.passwordUpdatedAt,
    );
  });

  test('sign out and resume emit the same demo resident session', () async {
    final repository = createRepository();
    await repository.signOut();
    expect((await repository.getAuthState()).isSignedIn, isFalse);
    final session = await repository.resumeDemoSession();
    expect(session.residentId, 'RES-000842');
    expect((await repository.getAuthState()).isSignedIn, isTrue);
  });
}
