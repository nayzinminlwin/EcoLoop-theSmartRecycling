import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/shared/widgets/app_button.dart';
import 'package:eco_loop/shared/widgets/app_error_view.dart';
import 'package:eco_loop/shared/widgets/app_loading_view.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';
import 'package:eco_loop/shared/widgets/app_page_header.dart';
import 'package:eco_loop/shared/widgets/app_text_field.dart';
import 'package:eco_loop/features/account/domain/models/profile_update_request.dart';
import 'package:eco_loop/features/account/presentation/controllers/profile_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});
  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  bool _editing = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(profileControllerProvider);
    return AppPage(
      header: AppPageHeader(
        title: 'Profile',
        onBack: () => context.go(AppRoutes.settings),
      ),
      child: state.when(
        loading: () => const AppLoadingView(message: 'Loading profile'),
        error: (_, _) => AppErrorView(
          message: 'We could not load your profile.',
          onRetry: () => ref.invalidate(profileControllerProvider),
        ),
        data: (profile) {
          if (!_editing && _name.text.isEmpty) {
            _name.text = profile.fullName;
            _email.text = profile.email;
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppTextField(
                controller: _name,
                label: 'Full name',
                enabled: _editing,
              ),
              const SizedBox(height: 16),
              AppTextField(
                controller: _email,
                label: 'Email',
                enabled: _editing,
                keyboardType: TextInputType.emailAddress,
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Colors.red)),
              ],
              const SizedBox(height: 24),
              if (!_editing)
                AppButton(
                  label: 'Edit profile',
                  onPressed: () => setState(() => _editing = true),
                  expand: true,
                )
              else
                Row(
                  children: [
                    Expanded(
                      child: AppButton(
                        label: 'Cancel',
                        variant: AppButtonVariant.secondary,
                        onPressed: () => setState(() {
                          _editing = false;
                          _error = null;
                          _name.text = profile.fullName;
                          _email.text = profile.email;
                        }),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: AppButton(
                        label: 'Save',
                        onPressed: () => _save(profile.avatarUrl),
                        isLoading: state.isLoading,
                      ),
                    ),
                  ],
                ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _save(String? avatarUrl) async {
    final name = _name.text.trim();
    final email = _email.text.trim();
    if (name.isEmpty ||
        !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
      setState(() => _error = 'Enter a valid name and email address.');
      return;
    }
    await ref
        .read(profileControllerProvider.notifier)
        .save(
          ProfileUpdateRequest(
            fullName: name,
            email: email,
            avatarUrl: avatarUrl,
          ),
        );
    if (!mounted) return;
    final state = ref.read(profileControllerProvider);
    if (state.hasError) {
      setState(() => _error = 'Profile could not be saved. Try again.');
    } else {
      setState(() {
        _editing = false;
        _error = null;
      });
    }
  }
}
