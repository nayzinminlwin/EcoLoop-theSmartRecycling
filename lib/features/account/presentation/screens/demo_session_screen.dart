import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/shared/widgets/app_brand.dart';
import 'package:eco_loop/shared/widgets/app_button.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';
import 'package:eco_loop/features/account/presentation/controllers/demo_session_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class DemoSessionScreen extends ConsumerWidget {
  const DemoSessionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => AppPage(
    child: Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const AppBrand(),
          const SizedBox(height: 24),
          const Text('You are signed out of the demo.'),
          const SizedBox(height: 16),
          AppButton(
            label: 'Continue demo',
            expand: true,
            onPressed: () async {
              await ref.read(demoSessionControllerProvider.notifier).resume();
              if (context.mounted) context.go(AppRoutes.home);
            },
          ),
        ],
      ),
    ),
  );
}
