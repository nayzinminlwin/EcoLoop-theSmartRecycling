import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/app/router/app_routes.dart';
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

  @override
  void dispose() {
    _current.dispose();
    _newPassword.dispose();
    _confirm.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(securityControllerProvider);
    return AppPage(
      header: AppPageHeader(
        title: 'Account security',
        onBack: () => context.go(AppRoutes.settings),
      ),
      child: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => const Text('Security information is unavailable.'),
        data: (security) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              security.isProtected
                  ? 'Account protected'
                  : 'Protection unavailable',
            ),
            const SizedBox(height: 8),
            Text(
              'Password updated ${_age(security.passwordUpdatedAt)} days ago.',
            ),
            const SizedBox(height: 24),
            AppTextField(
              controller: _current,
              label: 'Current password',
              obscureText: true,
              errorText: _error,
            ),
            const SizedBox(height: 12),
            AppTextField(
              controller: _newPassword,
              label: 'New password',
              helperText: 'At least 8 characters with a letter and number.',
              obscureText: true,
            ),
            const SizedBox(height: 12),
            AppTextField(
              controller: _confirm,
              label: 'Confirm new password',
              obscureText: true,
            ),
            const SizedBox(height: 20),
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
}
