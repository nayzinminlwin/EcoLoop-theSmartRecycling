import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/features/account/data/mock_account_repository.dart';
import 'package:eco_loop/features/account/presentation/controllers/account_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'UID-scoped account stream clears owner data on account switch',
    () async {
      final repository = MockAccountRepository(
        api: MockApi(readDelay: Duration.zero),
      );
      final container = ProviderContainer(
        overrides: [accountRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      final values = <String?>[];
      final subscription = container.listen(residentUidProvider, (
        previous,
        next,
      ) {
        next.whenData(values.add);
      }, fireImmediately: true);
      addTearDown(subscription.close);

      await Future<void>.delayed(Duration.zero);
      await repository.signOut();
      await Future<void>.delayed(Duration.zero);

      expect(values, contains('RES-000842'));
      expect(values.last, isNull);
    },
  );

  test('UID-scoped profile stream switches to signed-out state', () async {
    final repository = MockAccountRepository(
      api: MockApi(readDelay: Duration.zero),
    );
    final container = ProviderContainer(
      overrides: [accountRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);

    final values = <String?>[];
    final subscription = container.listen(accountProfileProvider, (
      previous,
      next,
    ) {
      next.whenData((profile) => values.add(profile?.id));
    }, fireImmediately: true);
    addTearDown(subscription.close);

    await Future<void>.delayed(Duration.zero);
    await repository.signOut();
    await Future<void>.delayed(Duration.zero);

    expect(values, contains('RES-000842'));
    expect(values.last, isNull);
  });
}
