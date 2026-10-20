import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not configured for this platform.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyAxqVn5aH6S-PTQQPJmXImXE9TeIkGwPZQ',
    appId: '1:353725053297:web:f9c407f5c8c886692f5ed0',
    messagingSenderId: '353725053297',
    projectId: 'ecoloop-thesmartrecycling',
    authDomain: 'ecoloop-thesmartrecycling.firebaseapp.com',
    storageBucket: 'ecoloop-thesmartrecycling.firebasestorage.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyAxqVn5aH6S-PTQQPJmXImXE9TeIkGwPZQ',
    appId: '1:353725053297:android:5f87dfd3ae7c99552f5ed0',
    messagingSenderId: '353725053297',
    projectId: 'ecoloop-thesmartrecycling',
    storageBucket: 'ecoloop-thesmartrecycling.firebasestorage.app',
  );
}
