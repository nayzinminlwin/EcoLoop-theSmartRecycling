import 'package:eco_loop/features/scan/domain/models/deposit_session.dart';
import 'package:eco_loop/features/scan/presentation/widgets/scan_progress_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('maps queued work to the first progress segment', () {
    final progress = ScanProgress.fromSession(_session(jobSubstage: 'queued'));

    expect(progress.step, 1);
    expect(
      progress.activeMessage,
      'Request received — waiting for verification to start',
    );
  });

  test('maps additional analysis to the fourth segment', () {
    final progress = ScanProgress.fromSession(
      _session(jobSubstage: 'additional_analysis'),
    );

    expect(progress.step, 4);
    expect(progress.activeMessage, 'Confirming materials');
    expect(progress.detailMessage, 'Some items need an additional check.');
  });

  testWidgets('renders five segments and elapsed time accessibly', (
    tester,
  ) async {
    final startedAt = DateTime(2026, 10, 22, 6, 0, 15);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ScanProgressCard(
            session: _session(jobSubstage: 'detecting', updatedAt: startedAt),
            now: () => startedAt.add(const Duration(minutes: 1, seconds: 2)),
          ),
        ),
      ),
    );

    expect(find.text('Identifying recyclable items'), findsOneWidget);
    expect(find.text('Step 3 of 5 · 01:02'), findsOneWidget);
    expect(
      find.bySemanticsLabel(
        RegExp(r'Identifying recyclable items.*Step 3 of 5'),
      ),
      findsOneWidget,
    );
  });
}

DepositSession _session({String? jobSubstage, DateTime? updatedAt}) {
  final timestamp = updatedAt ?? DateTime(2026, 10, 22, 6);
  return DepositSession(
    id: 'session-1',
    residentId: 'resident-1',
    binId: 'bin-1',
    stage: ScanStage.processing,
    createdAt: timestamp,
    updatedAt: timestamp,
    creationRequestId: 'request-1',
    jobSubstage: jobSubstage,
  );
}
