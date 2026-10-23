import 'package:flutter/foundation.dart';

enum FirebaseMode { mock, emulator, firebase }

class RuntimeConfig {
  static const residentFunctionsRegion = 'us-central1';
  static const workerFunctionsRegion = 'us-central1';
  static const visionTasksRegion = 'asia-southeast1';
  static const firestoreDatabaseId = 'ecoloop-db';

  const RuntimeConfig({
    required this.mode,
    required this.region,
    required this.firestoreHost,
    required this.authHost,
    required this.functionsHost,
    required this.storageHost,
    required this.emulatorPort,
    required this.useAppCheck,
    required this.webAppCheckSiteKey,
  });

  factory RuntimeConfig.fromEnvironment() {
    final rawMode = const String.fromEnvironment(
      'ECOLOOP_FIREBASE_MODE',
      defaultValue: 'mock',
    );
    final mode = FirebaseMode.values.firstWhere(
      (candidate) => candidate.name == rawMode,
      orElse: () => throw ArgumentError.value(
        rawMode,
        'ECOLOOP_FIREBASE_MODE',
        'Expected mock, emulator, or firebase',
      ),
    );
    final config = RuntimeConfig(
      mode: mode,
      region: const String.fromEnvironment(
        'ECOLOOP_FIREBASE_REGION',
        defaultValue: residentFunctionsRegion,
      ),
      firestoreHost: const String.fromEnvironment(
        'ECOLOOP_FIRESTORE_HOST',
        defaultValue: '127.0.0.1',
      ),
      authHost: const String.fromEnvironment(
        'ECOLOOP_AUTH_HOST',
        defaultValue: '127.0.0.1',
      ),
      functionsHost: const String.fromEnvironment(
        'ECOLOOP_FUNCTIONS_HOST',
        defaultValue: '127.0.0.1',
      ),
      storageHost: const String.fromEnvironment(
        'ECOLOOP_STORAGE_HOST',
        defaultValue: '127.0.0.1',
      ),
      emulatorPort: int.tryParse(
            const String.fromEnvironment(
              'ECOLOOP_EMULATOR_PORT',
              defaultValue: '8080',
            ),
          ) ??
          8080,
      useAppCheck: const bool.fromEnvironment(
        'ECOLOOP_USE_APP_CHECK',
        defaultValue: false,
      ),
      webAppCheckSiteKey: const String.fromEnvironment(
        'ECOLOOP_WEB_APP_CHECK_SITE_KEY',
        defaultValue: '',
      ),
    );
    config.validate();
    return config;
  }

  final FirebaseMode mode;
  final String region;
  final String firestoreHost;
  final String authHost;
  final String functionsHost;
  final String storageHost;
  final int emulatorPort;
  final bool useAppCheck;
  final String webAppCheckSiteKey;

  bool get usesFirebase => mode != FirebaseMode.mock;
  bool get usesEmulator => mode == FirebaseMode.emulator;
  bool get isProduction => mode == FirebaseMode.firebase;

  void validate() {
    if (region.trim().isEmpty) {
      throw const FormatException('Firebase region must not be empty');
    }
    if (usesEmulator &&
        (firestoreHost.trim().isEmpty ||
            authHost.trim().isEmpty ||
            functionsHost.trim().isEmpty ||
            storageHost.trim().isEmpty)) {
      throw const FormatException('Emulator hosts must be configured explicitly');
    }
    if (emulatorPort < 1 || emulatorPort > 65535) {
      throw FormatException('Invalid emulator port: $emulatorPort');
    }
    if (kReleaseMode && mode != FirebaseMode.firebase) {
      throw StateError('Release builds must use ECOLOOP_FIREBASE_MODE=firebase');
    }
  }
}
