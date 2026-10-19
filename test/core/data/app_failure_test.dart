import 'package:eco_loop/core/data/app_failure.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('keeps existing failure API and optional correlation fields', () {
    const failure = AppFailure(
      code: AppFailureCodes.unavailable,
      messageKey: 'backend.unavailable',
      retryable: true,
      requestId: 'request-001',
      traceId: '0123456789abcdef0123456789abcdef',
    );

    expect(failure.code, AppFailureCodes.unavailable);
    expect(failure.retryable, isTrue);
    expect(failure.requestId, 'request-001');
    expect(failure.traceId, startsWith('0123456789'));
  });
}
