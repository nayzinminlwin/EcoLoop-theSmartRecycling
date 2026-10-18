import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';

import '../config/runtime_config.dart';
import '../../firebase_options.dart';

class FirebaseClients {
  const FirebaseClients({
    required this.app,
    required this.auth,
    required this.firestore,
    required this.functions,
    required this.storage,
    required this.messaging,
    required this.appCheck,
  });

  final FirebaseApp app;
  final FirebaseAuth auth;
  final FirebaseFirestore firestore;
  final FirebaseFunctions functions;
  final FirebaseStorage storage;
  final FirebaseMessaging messaging;
  final FirebaseAppCheck appCheck;

  static Future<FirebaseClients> initialize(RuntimeConfig config) async {
    if (!config.usesFirebase) {
      throw StateError('Firebase clients cannot be initialized in mock mode');
    }

    final app = Firebase.apps.isEmpty
        ? await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform)
        : Firebase.app();
    final auth = FirebaseAuth.instanceFor(app: app);
    final firestore = FirebaseFirestore.instanceFor(app: app);
    final functions = FirebaseFunctions.instanceFor(
      app: app,
      region: config.region,
    );
    final storage = FirebaseStorage.instanceFor(app: app);
    final messaging = FirebaseMessaging.instance;
    final appCheck = FirebaseAppCheck.instanceFor(app: app);

    if (config.usesEmulator) {
      await auth.useAuthEmulator(config.authHost, 9099);
      firestore.useFirestoreEmulator(config.firestoreHost, 8080);
      functions.useFunctionsEmulator(config.functionsHost, 5001);
      await storage.useStorageEmulator(config.storageHost, 9199);
    }

    if (config.useAppCheck) {
      if (!config.usesEmulator || !kDebugMode) {
        throw StateError(
          'App Check debug activation is limited to debug emulator mode',
        );
      }
      if (!kIsWeb) {
        await appCheck.activate(providerAndroid: const AndroidDebugProvider());
      }
    }

    return FirebaseClients(
      app: app,
      auth: auth,
      firestore: firestore,
      functions: functions,
      storage: storage,
      messaging: messaging,
      appCheck: appCheck,
    );
  }
}
