import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
import 'package:eco_loop/core/domain/material_type.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('decodes legacy backend deposits without item lines', () {
    final deposit = DepositTransaction.fromBackendJson({
      'id': 'deposit-legacy',
      'ownerId': 'resident-1',
      'sessionId': 'session-1',
      'binId': 'bin-1',
      'binLocation': 'EcoLoop Demo Bin',
      'status': 'review',
      'updatedAt': '2026-10-23T12:30:03.335Z',
      'totalDetectedObjectCount': null,
      'pointsAwarded': null,
    });

    expect(deposit.lines, isEmpty);
    expect(deposit.materialType, MaterialType.unknown);
    expect(deposit.materialLabel, 'No material');
    expect(deposit.status, DepositStatus.review);
  });
}
