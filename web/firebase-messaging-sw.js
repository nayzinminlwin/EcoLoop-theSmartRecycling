/* Firebase Messaging worker for the resident Hosting target.
 * Keep this SDK version aligned with pubspec.yaml's Firebase packages.
 */
importScripts(
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js',
);

firebase.initializeApp({
  apiKey: 'AIzaSyAxqVn5aH6S-PTQQPJmXImXE9TeIkGwPZQ',
  appId: '1:353725053297:web:f9c407f5c8c886692f5ed0',
  messagingSenderId: '353725053297',
  projectId: 'ecoloop-thesmartrecycling',
  authDomain: 'ecoloop-thesmartrecycling.firebaseapp.com',
  storageBucket: 'ecoloop-thesmartrecycling.firebasestorage.app',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = payload.notification?.title || 'EcoLoop update';
  const options = {
    body: payload.notification?.body || 'Your recycling update is ready.',
    data: {
      eventId: data.eventId || '',
      targetType: data.targetType || '',
      targetId: data.targetId || '',
      decisionVersion: data.decisionVersion || '',
    },
  };
  return self.registration.showNotification(title, options);
});
