import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:eco_loop/core/mock/mock_data_store.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('transactions roll back and isolate mutable values', () async {
    final store = MockDataStore(
      profile: {'id': 'RES-1'},
      wallet: {'balance': 10},
      deposits: [
        {'id': 'DEP-1'},
      ],
      clock: AppClock(),
    );

    final copy = store.wallet;
    copy['balance'] = 999;
    expect(store.wallet['balance'], 10);

    await expectLater(
      store.transaction<void>((profile, wallet, deposits) {
        wallet['balance'] = 20;
        throw StateError('fail');
      }),
      throwsStateError,
    );
    expect(store.wallet['balance'], 10);

    await store.transaction<void>((profile, wallet, deposits) {
      wallet['balance'] = 25;
    });
    expect(store.wallet['balance'], 25);
  });

  test('fresh stores do not share state', () {
    final first = MockDataStore(
      profile: {},
      wallet: {'balance': 1},
      deposits: [],
    );
    final second = MockDataStore(
      profile: {},
      wallet: {'balance': 2},
      deposits: [],
    );
    expect(first.wallet['balance'], 1);
    expect(second.wallet['balance'], 2);
    first.dispose();
    second.dispose();
  });
}
