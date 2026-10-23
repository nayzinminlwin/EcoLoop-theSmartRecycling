import 'package:eco_loop/features/scan/domain/models/deposit_session.dart';
import 'package:eco_loop/features/scan/presentation/widgets/scan_progress_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('uses the first timed segment for newly submitted work', () {
    final startedAt = DateTime(2026, 10, 22, 6);
    final progress = ScanProgress.fromSession(
      _session(jobSubstage: 'queued', updatedAt: startedAt),
      now: startedAt.add(const Duration(seconds: 9)),
    );

    expect(progress.step, 1);
    expect(progress.activeMessage, 'Preparing your image for verification');
  });

  test('advances through all five segments by elapsed time', () {
    final startedAt = DateTime(2026, 10, 22, 6);

    expect(
      ScanProgress.fromSession(
        _session(jobSubstage: 'queued', updatedAt: startedAt),
        now: startedAt.add(const Duration(seconds: 10)),
      ).step,
      2,
    );
    expect(
      ScanProgress.fromSession(
        _session(jobSubstage: 'queued', updatedAt: startedAt),
        now: startedAt.add(const Duration(seconds: 25)),
      ).step,
      3,
    );
    expect(
      ScanProgress.fromSession(
        _session(jobSubstage: 'queued', updatedAt: startedAt),
        now: startedAt.add(const Duration(seconds: 45)),
      ).step,
      4,
    );
    expect(
      ScanProgress.fromSession(
        _session(jobSubstage: 'queued', updatedAt: startedAt),
        now: startedAt.add(const Duration(seconds: 75)),
      ).step,
      5,
    );
  });

  test('does not use backend progress to choose the displayed segment', () {
    final startedAt = DateTime(2026, 10, 22, 6);
    final progress = ScanProgress.fromSession(
      _session(jobSubstage: 'additional_analysis', updatedAt: startedAt),
      now: startedAt.add(const Duration(seconds: 9)),
    );

    expect(progress.step, 1);
    expect(progress.activeMessage, 'Preparing your image for verification');
  });

  test('shows timed reassurance while continuing to use timed segments', () {
    final startedAt = DateTime(2026, 10, 22, 6);

    expect(
      ScanProgress.fromSession(
        _session(updatedAt: startedAt),
        now: startedAt.add(const Duration(seconds: 9)),
      ).step,
      1,
    );
    expect(
      ScanProgress.fromSession(
        _session(updatedAt: startedAt),
        now: startedAt.add(const Duration(seconds: 30)),
      ).step,
      3,
    );
    expect(
      ScanProgress.fromSession(
        _session(updatedAt: startedAt),
        now: startedAt.add(const Duration(seconds: 60)),
      ).detailMessage,
      'This is taking longer than usual; you can continue using EcoLoop.',
    );
  });

  test('shows deadline recovery without changing the active segment', () {
    final startedAt = DateTime(2026, 10, 22, 6);
    final progress = ScanProgress.fromSession(
      _session(
        updatedAt: startedAt,
        deadlineAt: startedAt.add(const Duration(seconds: 30)),
      ),
      now: startedAt.add(const Duration(seconds: 31)),
    ).withDetail('Checking whether your request completed...');

    expect(progress.step, 3);
    expect(
      progress.detailMessage,
      'Checking whether your request completed...',
    );
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
            now: () => startedAt.add(const Duration(seconds: 42)),
          ),
        ),
      ),
    );

    expect(find.text('Identifying recyclable items'), findsOneWidget);
    expect(find.text('Step 3 of 5 · 00:42'), findsOneWidget);
    expect(
      find.bySemanticsLabel(
        RegExp(r'Identifying recyclable items.*Step 3 of 5'),
      ),
      findsOneWidget,
    );
  });
}

DepositSession _session({
  String? jobSubstage,
  DateTime? updatedAt,
  DateTime? deadlineAt,
}) {
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
    deadlineAt: deadlineAt,
  );
}
