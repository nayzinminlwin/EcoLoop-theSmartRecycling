import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class AppPage extends StatelessWidget {
  const AppPage({
    required this.child,
    super.key,
    this.header,
    this.padding = const EdgeInsets.symmetric(horizontal: 20),
    this.backgroundColor,
  });

  final Widget child;
  final PreferredSizeWidget? header;
  final EdgeInsetsGeometry padding;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: backgroundColor ?? AppColors.background,
    appBar: header,
    body: SafeArea(
      child: LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          padding: padding,
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: child,
          ),
        ),
      ),
    ),
  );
}
