import 'dart:async';

import 'package:eco_loop/core/data/pending_operation_store.dart';
import 'package:eco_loop/core/firebase/command_client.dart';
import 'package:eco_loop/features/notifications/data/firebase_notification_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('denied permission leaves the account unregistered', () async {
    final messaging = FakeMessaging(
      permission: NotificationAuthorization.denied,
    );
    final calls = <Map<String, Object?>>[];
    final service = FirebaseNotificationService(
      authState: messaging.auth.stream,
      messaging: messaging,
      commandClient: _commands(calls),
      installationStore: PendingOperationStore(
        preferences: MemoryPreferences(),
      ),
      backgroundHandler: () {},
    );
    addTearDown(service.dispose);

    await service.start();
    messaging.auth.add('resident-1');
    await _settle();

    expect(calls, isEmpty);
    expect(messaging.foregroundPresentationCalls, isEmpty);
  });

  test('registers the installation, refreshes its token, and unregisters on sign-out', () async {
    final messaging = FakeMessaging(
      permission: NotificationAuthorization.authorized,
      token: 'token-1',
    );
    final calls = <Map<String, Object?>>[];
    final service = FirebaseNotificationService(
      authState: messaging.auth.stream,
      messaging: messaging,
      commandClient: _commands(calls),
      installationStore: PendingOperationStore(
        preferences: MemoryPreferences(),
      ),
      backgroundHandler: () {},
    );
    addTearDown(service.dispose);

    await service.start();
    messaging.auth.add('resident-1');
    await _settle();
    messaging.tokens.add('token-2');
    await _settle();
    messaging.auth.add(null);
    await _settle();

    expect(calls.map((call) => call['operation']), [
      'registerResidentDevice',
      'registerResidentDevice',
      'unregisterResidentDevice',
    ]);
    expect(calls[0]['uid'], 'resident-1');
    final firstPayload =
        (calls[0]['payload']! as Map<String, Object?>)['payload']!
            as Map<String, Object?>;
    final secondPayload =
        (calls[1]['payload']! as Map<String, Object?>)['payload']!
            as Map<String, Object?>;
    expect(firstPayload['token'], 'token-1');
    expect(secondPayload['token'], 'token-2');
  });

  test('switching accounts unregisters the old association before registering the new owner', () async {
    final messaging = FakeMessaging(
      permission: NotificationAuthorization.authorized,
      token: 'token-1',
    );
    final calls = <Map<String, Object?>>[];
    final service = FirebaseNotificationService(
      authState: messaging.auth.stream,
      messaging: messaging,
      commandClient: _commands(calls),
      installationStore: PendingOperationStore(
        preferences: MemoryPreferences(),
      ),
      backgroundHandler: () {},
    );
    addTearDown(service.dispose);

    await service.start();
    messaging.auth.add('resident-1');
    await _settle();
    messaging.token = 'token-2';
    messaging.auth.add('resident-2');
    await _settle();

    expect(calls.map((call) => '${call['uid']}:${call['operation']}'), [
      'resident-1:registerResidentDevice',
      'resident-1:unregisterResidentDevice',
      'resident-2:registerResidentDevice',
    ]);
  });

  test(
    'forwards foreground and opened events without changing business state',
    () async {
      final messaging = FakeMessaging(
        permission: NotificationAuthorization.authorized,
        token: 'token-1',
      );
      final service = FirebaseNotificationService(
        authState: messaging.auth.stream,
        messaging: messaging,
        commandClient: _commands(<Map<String, Object?>>[]),
        installationStore: PendingOperationStore(
          preferences: MemoryPreferences(),
        ),
        backgroundHandler: () {},
      );
      addTearDown(service.dispose);
      final events = <NotificationEvent>[];
      final subscription = service.events.listen(events.add);
      addTearDown(subscription.cancel);

      await service.start();
      final event = const NotificationEvent(
        id: 'event-1',
        targetType: 'deposit',
        targetId: 'batch-1',
        decisionVersion: '1',
        fromBackground: false,
      );
      messaging.foreground.add(event);
      await _settle();

      expect(events.single.targetId, 'batch-1');
    },
  );
}

NotificationCommandFactory _commands(List<Map<String, Object?>> calls) =>
    (uid) => CommandClient(
      uid: uid,
      store: PendingOperationStore(preferences: MemoryPreferences()),
      requestIdFactory: () => 'request-001',
      transport: (operation, payload) async {
        calls.add({'uid': uid, 'operation': operation, 'payload': payload});
        return <String, Object?>{
          'schemaVersion': 'backend.v1',
          'operation': operation,
          'requestId': 'request-001',
          'traceId': '0123456789abcdef0123456789abcdef',
          'status': 'committed',
          'data': <String, Object?>{},
        };
      },
    );

Future<void> _settle() async {
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
}

class FakeMessaging implements NotificationMessagingClient {
  FakeMessaging({required this.permission, this.token});

  final NotificationAuthorization permission;
  final auth = StreamController<String?>.broadcast();
  final tokens = StreamController<String>.broadcast();
  final foreground = StreamController<NotificationEvent>.broadcast();
  String? token;
  final foregroundPresentationCalls = <bool>[];

  @override
  Stream<String> get onTokenRefresh => tokens.stream;

  @override
  Stream<NotificationEvent> get onMessage => foreground.stream;

  @override
  Stream<NotificationEvent> get onMessageOpenedApp =>
      const Stream<NotificationEvent>.empty();

  @override
  Future<NotificationEvent?> get initialMessage async => null;

  @override
  Future<NotificationAuthorization> requestPermission() async => permission;

  @override
  Future<String?> getToken() async => token;

  @override
  Future<void> setForegroundPresentation({required bool alert}) async {
    foregroundPresentationCalls.add(alert);
  }
}

class MemoryPreferences implements PendingOperationPreferences {
  final values = <String, String>{};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> remove(String key) async {
    values.remove(key);
  }

  @override
  Future<void> write(String key, String value) async => values[key] = value;
}
