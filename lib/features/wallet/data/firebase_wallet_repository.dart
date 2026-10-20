import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../domain/models/wallet_snapshot.dart';
import '../domain/repositories/wallet_repository.dart';

abstract interface class WalletReadTransport {
  Future<Map<String, Object?>?> read(String uid);
  Stream<Map<String, Object?>> watch(String uid);
}

class FirestoreWalletReadTransport implements WalletReadTransport {
  const FirestoreWalletReadTransport(this.firestore);

  final FirebaseFirestore firestore;

  @override
  Future<Map<String, Object?>?> read(String uid) async {
    final snapshot = await firestore
        .doc('residents/$uid/wallet/current')
        .get();
    final data = snapshot.data();
    return data == null ? null : Map<String, Object?>.from(data);
  }

  @override
  Stream<Map<String, Object?>> watch(String uid) =>
      firestore.doc('residents/$uid/wallet/current').snapshots().map((snapshot) {
        final data = snapshot.data();
        if (data == null) throw StateError('Wallet $uid does not exist');
        return Map<String, Object?>.from(data);
      });
}

class FirebaseWalletRepository implements WalletRepository {
  FirebaseWalletRepository({
    required this.uid,
    FirebaseFirestore? firestore,
    WalletReadTransport? reads,
  }) : _reads =
           reads ??
           FirestoreWalletReadTransport(
             firestore ?? FirebaseFirestore.instance,
           );

  final String uid;
  final WalletReadTransport _reads;

  @override
  Future<WalletSnapshot> getWallet() async {
    final data = await _reads.read(uid);
    if (data == null) throw StateError('Wallet $uid does not exist');
    return _map(data);
  }

  @override
  Stream<WalletSnapshot?> watchWallet() async* {
    await for (final data in _reads.watch(uid)) {
      yield _map(data);
    }
  }

  WalletSnapshot _map(Map<String, Object?> data) {
    final wallet = WalletDocument.fromJson({
      ...data,
      'id': data['id'] ?? data['residentId'] ?? uid,
    });
    return WalletSnapshot(
      residentId: wallet.residentId,
      balance: wallet.balance,
      nextRewardCost: null,
      updatedAt: wallet.updatedAt,
      version: wallet.version,
    );
  }
}
