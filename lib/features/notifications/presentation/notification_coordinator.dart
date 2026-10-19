import 'dart:async';

import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/features/account/presentation/controllers/account_providers.dart';
import 'package:eco_loop/features/notifications/data/firebase_notification_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class NotificationCoordinator extends ConsumerStatefulWidget {
  const NotificationCoordinator({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<NotificationCoordinator> createState() =>
      _NotificationCoordinatorState();
}

class _NotificationCoordinatorState
    extends ConsumerState<NotificationCoordinator> {
  StreamSubscription<NotificationEvent>? _subscription;
  final Set<String> _handledEventIds = <String>{};
  NotificationEvent? _pendingEvent;

  @override
  void initState() {
    super.initState();
    final service = ref.read(firebaseNotificationServiceProvider);
    ref.listenManual(residentUidProvider, (_, next) {
      if (next.valueOrNull != null && _pendingEvent != null) {
        final event = _pendingEvent!;
        _pendingEvent = null;
        _handle(event);
      }
    });
    if (service != null) {
      _subscription = service.events.listen(_handle);
      final initial = service.takeInitialEvent();
      if (initial != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _handle(initial));
      }
    }
  }

  @override
  void dispose() {
    unawaited(_subscription?.cancel());
    super.dispose();
  }

  void _handle(NotificationEvent event) {
    if (event.id.isEmpty || _handledEventIds.contains(event.id)) return;
    if (event.targetType != 'deposit' || event.targetId.isEmpty) return;
    final uid = ref.read(residentUidProvider).valueOrNull;
    if (uid == null) {
      _pendingEvent = event;
      return;
    }
    if (!mounted) return;
    _handledEventIds.add(event.id);
    final context = this.context;
    final router = GoRouter.of(context);
    router.go(AppRoutes.history);
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      const SnackBar(content: Text('Your recycling update is ready.')),
    );
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
