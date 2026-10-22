import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_spacing.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
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
    final clock = this.clock ?? AppClock();
    final date = clock.toDisplay(clock.now);
    final greeting = switch (date.hour) {
      >= 5 && < 12 => 'morning',
      >= 12 && < 18 => 'afternoon',
      _ => 'night',
    };
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                DateFormat('EEEE, d MMM').format(date).toUpperCase(),
                style: AppTypography.eyebrow.copyWith(color: AppColors.primary),
              ),
              const SizedBox(height: 5),
              Text(
                'Good $greeting, $name',
                style: AppTypography.homeGreeting.copyWith(
                  color: AppColors.text,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Ready to make today a little greener?',
                style: AppTypography.body.copyWith(color: AppColors.muted),
              ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        AppAvatar(initials: initials, radius: 20),
      ],
    );
  }
}
