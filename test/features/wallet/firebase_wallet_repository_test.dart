import 'package:eco_loop/features/wallet/data/firebase_wallet_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('reads and watches only the configured owner wallet', () async {
    final reads = _FakeWalletReads({
      'resident-a': {
        'residentId': 'resident-a',
        'balance': 37,
        'version': 4,
        'updatedAt': '2026-10-19T04:00:00Z',
      },
    });
    final repository = FirebaseWalletRepository(
      uid: 'resident-a',
      reads: reads,
    );

    final wallet = await repository.getWallet();

    expect(reads.readUid, 'resident-a');
    expect(wallet.residentId, 'resident-a');
    expect(wallet.balance, 37);
    expect(wallet.version, 4);
  });

  test(
    'missing owner wallet is surfaced instead of becoming a zero balance',
    () {
      final repository = FirebaseWalletRepository(
        uid: 'resident-b',
        reads: _FakeWalletReads(const {}),
      );

      expect(repository.getWallet(), throwsA(isA<StateError>()));
    },
  );
}

class _FakeWalletReads implements WalletReadTransport {
  _FakeWalletReads(this.values);

  final Map<String, Map<String, Object?>> values;
  String? readUid;

  @override
  Future<Map<String, Object?>?> read(String uid) async {
    readUid = uid;
    return values[uid];
  }

  @override
  Stream<Map<String, Object?>> watch(String uid) =>
      values[uid] == null ? const Stream.empty() : Stream.value(values[uid]!);
}
