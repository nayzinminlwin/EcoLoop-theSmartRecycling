import 'package:eco_loop/core/theme/app_theme.dart';
import 'package:eco_loop/shared/widgets/app_button.dart';
import 'package:eco_loop/shared/widgets/app_confirmation_dialog.dart';
import 'package:eco_loop/shared/widgets/app_error_view.dart';
import 'package:eco_loop/shared/widgets/app_text_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget host(Widget child) => MaterialApp(theme: AppTheme.light, home: child);

void main() {
  testWidgets('button disables callback while loading', (tester) async {
    var calls = 0;
    await tester.pumpWidget(
      host(AppButton(label: 'Save', isLoading: true, onPressed: () => calls++)),
    );

    await tester.tap(find.byType(AppButton));
    expect(calls, 0);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('button invokes callback when enabled', (tester) async {
    var calls = 0;
    await tester.pumpWidget(
      host(AppButton(label: 'Save', onPressed: () => calls++)),
    );

    await tester.tap(find.text('Save'));
    expect(calls, 1);
  });

  testWidgets('text field displays externally supplied validation error', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        const Scaffold(
          body: Form(
            child: AppTextField(label: 'Email', errorText: 'Enter an email'),
          ),
        ),
      ),
    );

    expect(find.text('Enter an email'), findsOneWidget);
  });

  testWidgets('confirmation dialog returns false on cancel', (tester) async {
    await tester.pumpWidget(
      host(
        Builder(
          builder: (context) => ElevatedButton(
            onPressed: () => AppConfirmationDialog.show(
              context,
              title: 'Remove item',
              body: 'This cannot be undone.',
            ),
            child: const Text('Open'),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(find.text('Remove item'), findsNothing);
  });

  testWidgets('confirmation dialog awaits confirm action', (tester) async {
    var confirmed = false;
    await tester.pumpWidget(
      host(
        Builder(
          builder: (context) => ElevatedButton(
            onPressed: () => AppConfirmationDialog.show(
              context,
              title: 'Confirm',
              body: 'Continue?',
              onConfirm: () async => confirmed = true,
            ),
            child: const Text('Open'),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Confirm'));
    await tester.pumpAndSettle();
    expect(confirmed, isTrue);
    expect(find.text('Continue?'), findsNothing);
  });

  testWidgets('error view exposes retry action', (tester) async {
    var retried = false;
    await tester.pumpWidget(
      host(
        AppErrorView(message: 'Could not load', onRetry: () => retried = true),
      ),
    );

    await tester.tap(find.text('Try again'));
    expect(retried, isTrue);
  });
}
