import 'package:eco_loop/core/domain/deposit_line_item.dart';
import 'package:eco_loop/core/domain/material_type.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_result.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final line = <String, Object?>{
    'lineId': 'line-plastic',
    'class': 'plastic_bottle',
    'eligible': true,
    'count': 2,
    'points': 10,
    'spaceSpc': 20,
  };

  test('backend result preserves lines, metadata, and accepted counts', () {
    final result = DepositResult.fromBackendJson({
      'id': 'result-1',
      'sessionId': 'session-1',
      'batchId': 'batch-1',
      'outcome': 'verified',
      'pointsAwarded': 10,
      'totalDetectedObjectCount': 3,
      'lines': [
        line,
        {
          ...line,
          'lineId': 'line-cardboard',
          'class': 'cardboard_item',
          'eligible': false,
          'count': 1,
          'points': 0,
          'spaceSpc': 15,
        },
      ],
      'updatedAt': '2026-10-19T04:00:00Z',
      'explanation': 'Verified accepted material.',
      'policyVersion': 'policy-v1',
      'decisionVersion': 1,
      'traceId': 'trace-1',
    });

    expect(result.lines, hasLength(2));
    expect(result.lines.first.materialType, MaterialType.plastic);
    expect(result.totalDetectedObjectCount, 3);
    expect(result.decisionVersion, 1);
    expect(result.traceId, 'trace-1');
  });

  test('null line counts remain explanatory instead of becoming zero', () {
    final parsed = DepositLineItem.fromJson({
      ...line,
      'count': null,
      'eligible': false,
    });

    expect(parsed.count, isNull);
    expect(parsed.acceptedCount, 0);
  });

  test(
    'legacy transaction construction remains compatible and accepted-only',
    () {
      final transaction = DepositTransaction.fromJson({
        'id': 'deposit-1',
        'residentId': 'resident-1',
        'sessionId': 'session-1',
        'binId': 'bin-1',
        'binLocation': 'Cedar Residence',
        'materialType': 'plastic',
        'materialLabel': 'PET plastic bottles',
        'itemCount': 2,
        'pointsAwarded': 10,
        'status': 'verified',
        'occurredAt': '2026-10-19T04:00:00Z',
        'verifiedAt': '2026-10-19T04:00:00Z',
      });

      expect(transaction.acceptedItemCount, 2);
      expect(transaction.lines, isEmpty);
    },
  );
}
