import 'package:cloud_firestore/cloud_firestore.dart';
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

  test('ignores stale wallet versions from the reactive stream', () async {
    final repository = FirebaseWalletRepository(
      uid: 'resident-a',
      reads: _SequencedWalletReads(),
    );

    final values = await repository.watchWallet().take(2).toList();

    expect(values.map((wallet) => wallet?.version), [2, 3]);
    expect(values.map((wallet) => wallet?.balance), [12, 25]);
  });

  test('normalizes SDK timestamps at the wallet adapter boundary', () async {
    final repository = FirebaseWalletRepository(
      uid: 'resident-a',
      reads: _FakeWalletReads({
        'resident-a': {
          'residentId': 'resident-a',
          'balance': 12,
          'version': 2,
          'updatedAt': Timestamp.fromDate(DateTime.utc(2026, 10, 21)),
        },
      }),
    );

    expect(
      (await repository.getWallet()).updatedAt.toUtc(),
      DateTime.utc(2026, 10, 21),
    );
  });
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

class _SequencedWalletReads implements WalletReadTransport {
  @override
  Future<Map<String, Object?>?> read(String uid) async => null;

  @override
  Stream<Map<String, Object?>> watch(String uid) async* {
    for (final value in [
      {
        'residentId': uid,
        'balance': 12,
        'version': 2,
        'updatedAt': '2026-10-21T00:00:00Z',
      },
      {
        'residentId': uid,
        'balance': 8,
        'version': 1,
        'updatedAt': '2026-10-21T00:01:00Z',
      },
      {
        'residentId': uid,
        'balance': 25,
        'version': 3,
        'updatedAt': '2026-10-21T00:02:00Z',
      },
    ]) {
      yield value;
    }
  }
}
