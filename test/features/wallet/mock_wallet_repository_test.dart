import 'package:eco_loop/core/mock/mock_seed_loader.dart';
import 'package:eco_loop/features/wallet/data/mock_wallet_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('fixture wallet computes next reward without persisting it', () async {
    final wallet = await MockWalletRepository().getWallet();
    expect(wallet.balance, 245);
    expect(wallet.nextRewardCost, 350);
    expect(wallet.toJson()['nextRewardCost'], 350);

    final document = await const MockSeedLoader().loadMap(
      'assets/mock/wallet/wallet.json',
    );
    expect((document['wallet'] as Map)['nextRewardCost'], isNull);
  });
}
