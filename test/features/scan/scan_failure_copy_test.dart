import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/features/scan/presentation/controllers/scan_controller.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('explains a timed-out session', () {
    expect(
      scanFailureCopy(
        const AppFailure(
          code: 'session_expired',
          messageKey: 'backend.session_expired',
          retryable: true,
        ),
        action: 'starting the recycling step',
      ),
      'The scan session timed out. Return to the scanner and scan the bin again.',
    );
  });

  test('explains an unknown backend rejection with its code', () {
    expect(
      scanFailureCopy(
        const AppFailure(
          code: 'some_backend_rule',
          messageKey: 'backend.some_backend_rule',
          retryable: false,
        ),
        action: 'starting the recycling step',
      ),
      'The backend rejected starting the recycling step (some_backend_rule). Try again or return to the scanner.',
    );
  });

  test('explains an unexpected non-backend failure', () {
    expect(
      scanFailureCopy(
        StateError('network stack unavailable'),
        action: 'confirming the bin session',
      ),
      'EcoLoop could not complete confirming the bin session because of an unexpected error. Try again.',
    );
  });

  test('explains a local pending scan conflict', () {
    expect(
      scanFailureCopy(
        const AppFailure(
          code: AppFailureCodes.conflict,
          messageKey: 'pendingOperation.payloadChanged',
          retryable: false,
        ),
      ),
      'Another scan action is still being processed. Wait a moment, then try again.',
    );
  });
}
