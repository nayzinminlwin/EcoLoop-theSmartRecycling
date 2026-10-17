import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_spacing.dart';
import 'package:eco_loop/shared/widgets/app_page_header.dart';
import 'package:flutter/material.dart';

/// One page scroll owner inside the resident shell.
///
/// The shell Scaffold owns app bar and bottom insets; this widget only owns
/// the page padding, the optional content header, and the scroll view.
class AppPage extends StatelessWidget {
  const AppPage({
    required this.child,
    super.key,
    this.header,
    this.padding = const EdgeInsets.symmetric(horizontal: AppSpacing.page),
  });

  final Widget child;
  final AppPageHeader? header;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) => Material(
    color: AppColors.background,
    child: LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        padding: padding.add(const EdgeInsets.only(bottom: AppSpacing.section)),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (header != null) ...[
                header!,
                const SizedBox(height: AppSpacing.section),
              ],
              child,
            ],
          ),
        ),
      ),
    ),
  );
}
