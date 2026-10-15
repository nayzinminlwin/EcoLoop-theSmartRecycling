import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class AppAvatar extends StatelessWidget {
  const AppAvatar({
    super.key,
    this.imageUrl,
    this.initials,
    this.radius = 22,
    this.semanticLabel,
  });

  final String? imageUrl;
  final String? initials;
  final double radius;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final fallback = CircleAvatar(
      radius: radius,
      backgroundColor: AppColors.sage,
      child: Text(
        initials ?? '?',
        style: TextStyle(
          color: AppColors.primaryDark,
          fontWeight: FontWeight.w700,
          fontSize: radius * .62,
        ),
      ),
    );
    final avatar = imageUrl == null
        ? fallback
        : ClipOval(
            child: Image.network(
              imageUrl!,
              width: radius * 2,
              height: radius * 2,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => fallback,
            ),
          );
    return Semantics(
      label: semanticLabel ?? 'Profile picture',
      image: true,
      child: SizedBox(width: radius * 2, height: radius * 2, child: avatar),
    );
  }
}
