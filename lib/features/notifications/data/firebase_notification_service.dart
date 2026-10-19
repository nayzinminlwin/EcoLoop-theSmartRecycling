import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'package:eco_loop/core/data/pending_operation_store.dart';
import 'package:eco_loop/core/firebase/command_client.dart';
import 'package:eco_loop/firebase_options.dart';

typedef NotificationCommandFactory = CommandClient Function(String uid);

class NotificationEvent {
  const NotificationEvent({
    required this.id,
    required this.targetType,
    required this.targetId,
    required this.decisionVersion,
    required this.fromBackground,
  });

  final String id;
  final String targetType;
  final String targetId;
  final String decisionVersion;
  final bool fromBackground;
}

abstract interface class NotificationMessagingClient {
  Stream<String> get onTokenRefresh;
  Stream<NotificationEvent> get onMessage;
  Stream<NotificationEvent> get onMessageOpenedApp;
  Future<NotificationEvent?> get initialMessage;
  Future<NotificationAuthorization> requestPermission();
  Future<String?> getToken();
  Future<void> setForegroundPresentation({required bool alert});
}

enum NotificationAuthorization { denied, authorized, provisional }

class FirebaseNotificationMessagingClient
    implements NotificationMessagingClient {
  FirebaseNotificationMessagingClient({FirebaseMessaging? messaging})
    : _messaging = messaging ?? FirebaseMessaging.instance;

  final FirebaseMessaging _messaging;

  @override
  // FCM send delivery still requires the registration token; the package's
  // replacement stream exposes the installation ID rather than that token.
  // ignore: deprecated_member_use
  Stream<String> get onTokenRefresh => _messaging.onTokenRefresh;

  @override
  Stream<NotificationEvent> get onMessage =>
      FirebaseMessaging.onMessage.map((message) => _event(message, false));

  @override
  Stream<NotificationEvent> get onMessageOpenedApp => FirebaseMessaging
      .onMessageOpenedApp
      .map((message) => _event(message, true));

  @override
  Future<NotificationEvent?> get initialMessage async {
    final message = await _messaging.getInitialMessage();
    return message == null ? null : _event(message, true);
  }

  @override
  Future<NotificationAuthorization> requestPermission() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: true,
    );
    return switch (settings.authorizationStatus) {
      AuthorizationStatus.authorized => NotificationAuthorization.authorized,
      AuthorizationStatus.provisional => NotificationAuthorization.provisional,
      _ => NotificationAuthorization.denied,
    };
  }

  @override
  // ignore: deprecated_member_use
  Future<String?> getToken() {
    final vapidKey = const String.fromEnvironment('ECOLOOP_WEB_VAPID_KEY');
    if (kIsWeb && vapidKey.isEmpty) {
      throw StateError(
        'ECOLOOP_WEB_VAPID_KEY must be supplied for web notification builds',
      );
    }
    // ignore: deprecated_member_use
    return _messaging.getToken(vapidKey: kIsWeb ? vapidKey : null);
  }

  @override
  Future<void> setForegroundPresentation({required bool alert}) =>
      _messaging.setForegroundNotificationPresentationOptions(
        alert: alert,
        badge: alert,
        sound: alert,
      );

  static NotificationEvent _event(RemoteMessage message, bool fromBackground) {
    final data = message.data;
    return NotificationEvent(
      id: data['eventId'] ?? message.messageId ?? '',
      targetType: data['targetType'] ?? '',
      targetId: data['targetId'] ?? '',
      decisionVersion: data['decisionVersion'] ?? '',
      fromBackground: fromBackground,
    );
  }
}

@pragma('vm:entry-point')
Future<void> firebaseNotificationBackgroundHandler(
  RemoteMessage message,
) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
}

class FirebaseNotificationService {
  FirebaseNotificationService({
    required this.authState,
    required this.messaging,
    required this.commandClient,
    PendingOperationStore? installationStore,
    this.backgroundHandler,
  }) : _installationStore = installationStore ?? PendingOperationStore();

  final Stream<String?> authState;
  final NotificationMessagingClient messaging;
  final NotificationCommandFactory commandClient;
  final void Function()? backgroundHandler;
  final PendingOperationStore _installationStore;
  final _events = StreamController<NotificationEvent>.broadcast();
  NotificationEvent? _initialEvent;
  StreamSubscription<String?>? _authSubscription;
  StreamSubscription<String>? _tokenSubscription;
  StreamSubscription<NotificationEvent>? _foregroundSubscription;
  StreamSubscription<NotificationEvent>? _openedSubscription;
  String? _uid;
  String? _token;
  String? _installationId;

  Stream<NotificationEvent> get events => _events.stream;

  Future<void> start() async {
    (backgroundHandler ??
        () => FirebaseMessaging.onBackgroundMessage(
          firebaseNotificationBackgroundHandler,
        ))();
    _foregroundSubscription = messaging.onMessage.listen(_events.add);
    _openedSubscription = messaging.onMessageOpenedApp.listen(_events.add);
    final initial = await messaging.initialMessage;
    _initialEvent = initial;
    _authSubscription = authState.listen(
      _handleAuthState,
      onError: _events.addError,
    );
  }

  NotificationEvent? takeInitialEvent() {
    final event = _initialEvent;
    _initialEvent = null;
    return event;
  }

  Future<void> unregisterCurrentDevice() async {
    final uid = _uid;
    final token = _token;
    if (uid == null || token == null) return;
    await commandClient(uid)
        .execute('unregisterResidentDevice', {'deviceId': await _deviceId()});
    _token = null;
  }

  Future<void> dispose() async {
    await _authSubscription?.cancel();
    await _tokenSubscription?.cancel();
    await _foregroundSubscription?.cancel();
    await _openedSubscription?.cancel();
    await _events.close();
  }

  Future<void> _handleAuthState(String? uid) async {
    if (uid == _uid) return;
    if (_uid != null) {
      await _unregister(_uid!);
    }
    await _tokenSubscription?.cancel();
    _tokenSubscription = null;
    _uid = uid;
    _token = null;
    if (uid == null) return;
    final authorization = await messaging.requestPermission();
    if (authorization == NotificationAuthorization.denied) return;
    await messaging.setForegroundPresentation(alert: false);
    await _register(uid, await messaging.getToken());
    _tokenSubscription = messaging.onTokenRefresh.listen(
      (token) => _register(uid, token),
    );
  }

  Future<void> _register(String uid, String? token) async {
    if (token == null || token.isEmpty || uid != _uid) return;
    await commandClient(uid).execute('registerResidentDevice', {
      'deviceId': await _deviceId(),
      'platform': _platform,
      'token': token,
    });
    _token = token;
  }

  Future<void> _unregister(String uid) async {
    await commandClient(uid)
        .execute('unregisterResidentDevice', {'deviceId': await _deviceId()});
    _token = null;
  }

  Future<String> _deviceId() async {
    return _installationId ??= await _installationStore.installationId();
  }

  String get _platform {
    if (kIsWeb) return 'web';
    return switch (defaultTargetPlatform) {
      TargetPlatform.android => 'android',
      TargetPlatform.iOS => 'ios',
      TargetPlatform.macOS => 'macos',
      TargetPlatform.windows => 'windows',
      TargetPlatform.linux => 'linux',
      TargetPlatform.fuchsia => 'fuchsia',
    };
  }
}
