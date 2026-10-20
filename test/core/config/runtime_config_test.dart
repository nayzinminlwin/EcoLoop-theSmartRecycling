import 'package:eco_loop/core/config/runtime_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('mock mode is explicit and does not require Firebase clients', () {
    const config = RuntimeConfig(
      mode: FirebaseMode.mock,
      region: 'asia-southeast1',
      firestoreHost: '127.0.0.1',
      authHost: '127.0.0.1',
      functionsHost: '127.0.0.1',
      storageHost: '127.0.0.1',
      emulatorPort: 8080,
      useAppCheck: false,
    );

    config.validate();
    expect(config.usesFirebase, isFalse);
    expect(config.isProduction, isFalse);
  });

  test('emulator mode requires explicit hosts and valid ports', () {
    const config = RuntimeConfig(
      mode: FirebaseMode.emulator,
      region: 'asia-southeast1',
      firestoreHost: '127.0.0.1',
      authHost: '127.0.0.1',
      functionsHost: '127.0.0.1',
      storageHost: '127.0.0.1',
      emulatorPort: 8080,
      useAppCheck: true,
    );

    config.validate();
    expect(config.usesEmulator, isTrue);
    expect(config.useAppCheck, isTrue);
  });

  test('invalid emulator port fails visibly', () {
    const config = RuntimeConfig(
      mode: FirebaseMode.emulator,
      region: 'asia-southeast1',
      firestoreHost: '127.0.0.1',
      authHost: '127.0.0.1',
      functionsHost: '127.0.0.1',
      storageHost: '127.0.0.1',
      emulatorPort: 0,
      useAppCheck: false,
    );

    expect(config.validate, throwsFormatException);
  });

  test('empty Firebase region fails visibly', () {
    const config = RuntimeConfig(
      mode: FirebaseMode.firebase,
      region: '',
      firestoreHost: '',
      authHost: '',
      functionsHost: '',
      storageHost: '',
      emulatorPort: 8080,
      useAppCheck: false,
    );

    expect(config.validate, throwsFormatException);
  });
}
