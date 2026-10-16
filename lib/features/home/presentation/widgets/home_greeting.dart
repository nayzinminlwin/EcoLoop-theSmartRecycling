import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_spacing.dart';
import 'package:eco_loop/shared/widgets/app_avatar.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class HomeGreeting extends StatelessWidget {
  const HomeGreeting({
    required this.name,
    required this.initials,
    super.key,
    this.clock,
  });

  final String name;
  final String initials;
  final AppClock? clock;

  @override
  Widget build(BuildContext context) {
    final date = (clock ?? AppClock()).now;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                DateFormat('EEEE, d MMM').format(date).toUpperCase(),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: AppColors.muted,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Good morning, $name',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Ready to make today a little greener?',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
        AppAvatar(initials: initials),
      ],
    );
  }
}
