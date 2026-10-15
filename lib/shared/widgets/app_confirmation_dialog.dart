import 'package:eco_loop/core/presentation/app_copy.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class AppConfirmationDialog extends StatefulWidget {
  const AppConfirmationDialog({
    required this.title,
    required this.body,
    super.key,
    this.confirmLabel = AppCopy.confirm,
    this.cancelLabel = AppCopy.cancel,
    this.onConfirm,
    this.content,
    this.failureText,
  });

  final String title;
  final String body;
  final String confirmLabel;
  final String cancelLabel;
  final Future<void> Function()? onConfirm;
  final Widget? content;
  final String? failureText;

  static Future<bool?> show(
    BuildContext context, {
    required String title,
    required String body,
    String confirmLabel = AppCopy.confirm,
    String cancelLabel = AppCopy.cancel,
    Future<void> Function()? onConfirm,
    Widget? content,
    String? failureText,
  }) => showDialog<bool>(
    context: context,
    builder: (_) => AppConfirmationDialog(
      title: title,
      body: body,
      confirmLabel: confirmLabel,
      cancelLabel: cancelLabel,
      onConfirm: onConfirm,
      content: content,
      failureText: failureText,
    ),
  );

  @override
  State<AppConfirmationDialog> createState() => _AppConfirmationDialogState();
}

class _AppConfirmationDialogState extends State<AppConfirmationDialog> {
  bool _pending = false;
  String? _failure;

  Future<void> _confirm() async {
    if (widget.onConfirm == null) {
      if (mounted) Navigator.of(context).pop(true);
      return;
    }
    setState(() {
      _pending = true;
      _failure = null;
    });
    try {
      await widget.onConfirm!();
      if (mounted) Navigator.of(context).pop(true);
    } catch (error, stackTrace) {
      FlutterError.reportError(
        FlutterErrorDetails(
          exception: error,
          stack: stackTrace,
          library: 'eco_loop shared widgets',
          context: ErrorDescription('while confirming an action'),
        ),
      );
      if (!mounted) return;
      setState(() {
        _pending = false;
        _failure = widget.failureText ?? 'Unable to complete this action.';
      });
    }
  }

  @override
  Widget build(BuildContext context) => Center(
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 560),
      child: AlertDialog(
        title: Text(widget.title),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.body),
              if (widget.content != null) ...[
                const SizedBox(height: 16),
                widget.content!,
              ],
              if (_failure != null) ...[
                const SizedBox(height: 12),
                Text(
                  _failure!,
                  style: const TextStyle(color: AppColors.redText),
                ),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: _pending ? null : () => Navigator.of(context).pop(false),
            child: Text(widget.cancelLabel),
          ),
          FilledButton(
            onPressed: _pending ? null : _confirm,
            child: _pending
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(widget.confirmLabel),
          ),
        ],
      ),
    ),
  );
}
