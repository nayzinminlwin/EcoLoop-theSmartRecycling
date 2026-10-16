import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'resident_bottom_navigation.dart';
import 'resident_top_bar.dart';

class ResidentShell extends StatelessWidget {
  const ResidentShell({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: const ResidentTopBar(),
    body: navigationShell,
    bottomNavigationBar: ResidentBottomNavigation(
      navigationShell: navigationShell,
    ),
  );
}
