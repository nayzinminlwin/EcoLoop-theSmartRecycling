import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/app/router/leave_decision_coordinator.dart';
import 'package:eco_loop/shared/widgets/app_button.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';
import 'package:eco_loop/shared/widgets/app_page_header.dart';
import 'package:eco_loop/shared/widgets/app_text_field.dart';
import 'package:eco_loop/features/account/domain/models/password_change_request.dart';
import 'package:eco_loop/features/account/presentation/controllers/security_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class SecurityScreen extends ConsumerStatefulWidget {
  const SecurityScreen({super.key});
  @override
  ConsumerState<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends ConsumerState<SecurityScreen> {
  final _current = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirm = TextEditingController();
  String? _error;
  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  VoidCallback? _removeLeaveGuard;

  bool get _dirty =>
      _current.text.isNotEmpty ||
      _newPassword.text.isNotEmpty ||
      _confirm.text.isNotEmpty;

  @override
  void initState() {
    super.initState();
    _removeLeaveGuard = ref
        .read(leaveDecisionProvider)
        .register(
          () async => await _confirmDiscard()
              ? LeaveDecision.leave
              : LeaveDecision.stay,
        );
  }

  @override
  void dispose() {
    _current.dispose();
    _newPassword.dispose();
    _confirm.dispose();
    _removeLeaveGuard?.call();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(securityControllerProvider);
    final security = state.value;
    return PopScope(
      canPop: !_dirty,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leaveToSettings();
      },
      child: AppPage(
        header: AppPageHeader(
          title: 'Account security',
          onBack: _leaveToSettings,
        ),
        child: security == null
            ? state.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (_, _) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Security information is unavailable.'),
                    TextButton(
                      onPressed: () =>
                          ref.invalidate(securityControllerProvider),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
                data: (_) => const SizedBox.shrink(),
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    security.isProtected
                        ? 'Account protected'
                        : 'Protection unavailable',
                  ),
                  const SizedBox(height: 8),
                  Text(
                    security.passwordUpdatedAt == null
                        ? 'Sign-in security is managed by ${security.provider}.'
                        : 'Password updated ${_age(security.passwordUpdatedAt!)} days ago.',
                  ),
                  const SizedBox(height: 24),
                  if (security.passwordUpdatedAt != null)
                    AppTextField(
                      controller: _current,
                      label: 'Current password',
                      obscureText: _obscureCurrent,
                      suffixIcon: IconButton(
                        onPressed: () =>
                            setState(() => _obscureCurrent = !_obscureCurrent),
                        icon: Icon(
                          _obscureCurrent
                              ? Icons.visibility
                              : Icons.visibility_off,
                        ),
                      ),
                      errorText: _error,
                    ),
                  if (security.passwordUpdatedAt != null)
                    const SizedBox(height: 12),
                  if (security.passwordUpdatedAt != null)
                    AppTextField(
                      controller: _newPassword,
                      label: 'New password',
                      helperText:
                          'At least 8 characters with a letter and number.',
                      obscureText: _obscureNew,
                      suffixIcon: IconButton(
                        onPressed: () =>
                            setState(() => _obscureNew = !_obscureNew),
                        icon: Icon(
                          _obscureNew ? Icons.visibility : Icons.visibility_off,
                        ),
                      ),
                    ),
                  if (security.passwordUpdatedAt != null)
                    const SizedBox(height: 12),
                  if (security.passwordUpdatedAt != null)
                    AppTextField(
                      controller: _confirm,
                      label: 'Confirm new password',
                      obscureText: _obscureConfirm,
                      suffixIcon: IconButton(
                        onPressed: () =>
                            setState(() => _obscureConfirm = !_obscureConfirm),
                        icon: Icon(
                          _obscureConfirm
                              ? Icons.visibility
                              : Icons.visibility_off,
                        ),
                      ),
                    ),
                  if (security.passwordUpdatedAt != null)
                    const SizedBox(height: 20),
                  if (security.passwordUpdatedAt != null)
                    AppButton(
                      label: 'Save password',
                      onPressed: () => _save(),
                      isLoading: state.isLoading,
                      expand: true,
                    ),
                ],
              ),
      ),
    );
  }

  int _age(DateTime updatedAt) =>
      ref.read(appClockProvider).now.difference(updatedAt).inDays;

  Future<void> _save() async {
    if (_newPassword.text != _confirm.text) {
      setState(() => _error = 'Passwords do not match.');
      return;
    }
    if (_newPassword.text.length < 8 ||
        !RegExp('[A-Za-z]').hasMatch(_newPassword.text) ||
        !RegExp(r'\d').hasMatch(_newPassword.text)) {
      setState(() => _error = 'Use 8 characters with a letter and number.');
      return;
    }
    await ref
        .read(securityControllerProvider.notifier)
        .change(
          PasswordChangeRequest(
            currentPassword: _current.text,
            newPassword: _newPassword.text,
          ),
        );
    if (!mounted) return;
    final state = ref.read(securityControllerProvider);
    setState(
      () => _error = state.hasError ? 'Current password is incorrect.' : null,
    );
    if (!state.hasError) {
      _current.clear();
      _newPassword.clear();
      _confirm.clear();
    }
  }

  Future<bool> _confirmDiscard() async {
    if (!_dirty || !mounted) return true;
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Discard password changes?'),
        content: const Text('Your password form has not been saved.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep editing'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Discard'),
          ),
        ],
      ),
    );
    return result == true;
  }

  Future<void> _leaveToSettings() async {
    if (await _confirmDiscard() && mounted) context.go(AppRoutes.settings);
  }
}
