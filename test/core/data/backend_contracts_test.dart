import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/core/firebase/backend_envelope.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const traceId = '0123456789abcdef0123456789abcdef';

  test('parses a committed envelope with UTC timestamp and safe data', () {
    final envelope = BackendEnvelope.fromJson(<String, Object?>{
      'schemaVersion': 'backend.v1',
      'operation': 'submitInspection',
      'requestId': 'request-001',
      'traceId': traceId,
      'status': 'committed',
      'timestamp': '2026-10-18T12:00:00.000Z',
      'data': <String, Object?>{
        'residentId': 'resident-001',
        'recordIds': <Object?>['deposit-001'],
        'version': 1,
      },
    });

    expect(envelope.isCommitted, isTrue);
    expect(envelope.traceId, traceId);
    expect(envelope.timestamp, DateTime.utc(2026, 10, 18, 12));
    expect(envelope.data?['residentId'], 'resident-001');
  });

  test('parses retryable safe errors without SDK types', () {
    final envelope = BackendEnvelope.fromJson(<String, Object?>{
      'schemaVersion': 'backend.v1',
      'requestId': 'request-002',
      'traceId': traceId,
      'status': 'error',
      'error': <String, Object?>{
        'code': 'processing_unavailable',
        'message': 'Processing is temporarily unavailable.',
        'retryable': true,
        'details': <String, Object?>{'operationId': 'operation-001'},
      },
    });

    expect(envelope.error?.code, 'processing_unavailable');
    expect(envelope.error?.retryable, isTrue);
    expect(envelope.error?.details['operationId'], 'operation-001');
  });

  test('rejects unsupported versions, malformed dates, and unsafe trace IDs', () {
    final base = <String, Object?>{
      'schemaVersion': 'backend.v1',
      'requestId': 'request-003',
      'traceId': traceId,
      'status': 'committed',
      'data': <String, Object?>{},
    };
    expect(
      () => BackendEnvelope.fromJson(<String, Object?>{...base, 'schemaVersion': 'backend.v0'}),
      throwsA(isA<AppFailure>()),
    );
    expect(
      () => BackendEnvelope.fromJson(<String, Object?>{...base, 'timestamp': 'not-a-date'}),
      throwsA(isA<AppFailure>()),
    );
    expect(
      () => BackendEnvelope.fromJson(<String, Object?>{...base, 'traceId': 'not-a-trace'}),
      throwsA(isA<AppFailure>()),
    );
  });
}
