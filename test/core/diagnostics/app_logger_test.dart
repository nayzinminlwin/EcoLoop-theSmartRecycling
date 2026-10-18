import 'package:flutter_test/flutter_test.dart';
import 'package:eco_loop/core/diagnostics/app_logger.dart';

void main() {
  test('logger includes context and redacts sentinel secrets', () {
    final lines = <String>[];
    final logger = AppLogger(sink: lines.add);
    final traceId = 'a' * 32;

    logger.withContext(
      AppLogContext(traceId: traceId, requestId: 'request-1'),
      () => logger.log(
        AppLogLevel.info,
        'inspection.submission_committed',
        fields: const <String, Object?>{
          'token': 'sentinel-token',
          'voucherCode': 'raw-code',
        },
      ),
    );

    expect(lines.single, contains('traceId=$traceId'));
    expect(lines.single, contains('token=[REDACTED]'));
    expect(lines.single, isNot(contains('sentinel-token')));
    expect(lines.single, isNot(contains('raw-code')));
  });

  test('throttles repeated debug events', () {
    final lines = <String>[];
    var now = DateTime(2026, 1, 1);
    final logger = AppLogger(sink: lines.add, now: () => now);

    logger.log(AppLogLevel.debug, 'scan.draft_selected', throttle: true);
    logger.log(AppLogLevel.debug, 'scan.draft_selected', throttle: true);
    expect(lines, hasLength(1));
    now = now.add(const Duration(seconds: 2));
    logger.log(AppLogLevel.debug, 'scan.draft_selected', throttle: true);
    expect(lines, hasLength(2));
  });
}
