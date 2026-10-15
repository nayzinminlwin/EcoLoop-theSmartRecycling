import '../models/wallet_snapshot.dart';

abstract interface class WalletRepository {
  Future<WalletSnapshot> getWallet();
  Stream<WalletSnapshot?> watchWallet();
}
