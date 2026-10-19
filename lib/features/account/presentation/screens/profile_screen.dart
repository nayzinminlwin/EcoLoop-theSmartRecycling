import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/app/router/leave_decision_coordinator.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_radii.dart';
import 'package:eco_loop/core/theme/app_spacing.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/features/account/domain/models/profile_update_request.dart';
import 'package:eco_loop/features/account/domain/models/resident_profile.dart';
import 'package:eco_loop/features/account/presentation/controllers/profile_controller.dart';
import 'package:eco_loop/shared/widgets/app_avatar.dart';
import 'package:eco_loop/shared/widgets/app_button.dart';
import 'package:eco_loop/shared/widgets/app_error_view.dart';
import 'package:eco_loop/shared/widgets/app_loading_view.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';
import 'package:eco_loop/shared/widgets/app_page_header.dart';
import 'package:eco_loop/shared/widgets/app_text_field.dart';
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
  VoidCallback? _removeLeaveGuard;
  bool _editing = false;
  String? _error;

  bool get _dirty => _editing;

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
    _removeLeaveGuard?.call();
    _name.dispose();
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(profileControllerProvider);
    final profile = state.value;
    return PopScope(
      canPop: !_dirty,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leaveToSettings();
      },
      child: AppPage(
        header: AppPageHeader(
          eyebrow: 'SETTINGS',
          title: 'Profile & personal details',
          onBack: _leaveToSettings,
        ),
        child: profile == null
            ? state.when(
                loading: () => const AppLoadingView(message: 'Loading profile'),
                error: (_, _) => AppErrorView(
                  message: 'We could not load your profile.',
                  onRetry: () => ref.invalidate(profileControllerProvider),
                ),
                data: (_) => const SizedBox.shrink(),
              )
            : _content(profile, state.isLoading),
      ),
    );
  }

  Widget _content(ResidentProfile profile, bool saving) {
    if (!_editing && _name.text.isEmpty) {
      _name.text = profile.fullName;
      _email.text = profile.email;
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _ProfileSummary(profile: profile),
        const SizedBox(height: AppSpacing.lg),
        if (_editing) ...[
          AppTextField(
            controller: _name,
            label: 'Full name',
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(
            controller: _email,
            label: 'Email',
            enabled: false,
            helperText: 'Email is managed by your sign-in provider.',
            onChanged: (_) => setState(() {}),
          ),
          if (_error != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(_error!, style: const TextStyle(color: AppColors.red)),
          ],
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: 'Cancel',
                  variant: AppButtonVariant.secondary,
                  onPressed: () => _cancel(profile),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: AppButton(
                  label: 'Save',
                  onPressed: () => _save(profile.avatarUrl),
                  isLoading: saving,
                ),
              ),
            ],
          ),
        ] else
          AppButton(
            label: 'Edit profile',
            expand: true,
            onPressed: () => setState(() => _editing = true),
          ),
      ],
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
    if (ref.read(profileControllerProvider).hasError) {
      setState(() => _error = 'Profile could not be saved. Try again.');
    } else {
      setState(() {
        _editing = false;
        _error = null;
      });
    }
  }

  void _cancel(ResidentProfile profile) => setState(() {
    _editing = false;
    _error = null;
    _name.text = profile.fullName;
    _email.text = profile.email;
  });

  Future<bool> _confirmDiscard() async {
    if (!_dirty || !mounted) return true;
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Discard changes?'),
        content: const Text('Your profile edits have not been saved.'),
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

class _ProfileSummary extends StatelessWidget {
  const _ProfileSummary({required this.profile});

  final ResidentProfile profile;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(AppSpacing.md),
    decoration: BoxDecoration(
      color: AppColors.surface,
      border: Border.all(color: AppColors.border),
      borderRadius: BorderRadius.circular(AppRadii.card),
    ),
    child: Row(
      children: [
        AppAvatar(initials: profile.initials, radius: 26),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(profile.fullName, style: AppTypography.sectionHeading),
              Text(profile.email, style: AppTypography.textTheme.bodySmall),
            ],
          ),
        ),
      ],
    ),
  );
}
