import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:eco_loop/core/mock/mock_data_store.dart';

/// Builds an in-memory store with the resident scan fixtures so repository
/// and flow tests exercise the same store-backed path as production.
MockDataStore buildScanStore({
  int balance = 245,
  int capacityPercent = 65,
  bool isOnline = true,
  int pointsPerItem = 5,
  Map<String, Object?> classification = const {
    'id': 'baseline',
    'materialType': 'plastic',
    'materialLabel': 'PET plastic bottles',
    'itemCount': 2,
    'outcome': 'verified',
    'explanation': 'Two recyclable PET plastic bottles were verified.',
    'capacityIncreasePercent': 20,
  },
  List<Map<String, Object?>>? deposits,
  AppClock? clock,
}) => MockDataStore(
  clock: clock,
  metadata: const {
    'referenceNow': '2024-05-20T11:00:00+08:00',
    'locale': 'en_MY',
    'utcOffsetMinutes': 480,
  },
  profile: const {
    'id': 'RES-000842',
    'fullName': 'Faris Rezza',
    'email': 'rezza@example.com',
    'avatarUrl': null,
    'createdAt': '2024-01-12T08:00:00+08:00',
  },
  wallet: {
    'wallet': {
      'residentId': 'RES-000842',
      'balance': balance,
      'updatedAt': '2024-05-20T11:00:00+08:00',
      'version': 1,
    },
  },
  deposits:
      deposits ??
      const [
        {
          'id': 'DEP-001',
          'residentId': 'RES-000842',
          'sessionId': null,
          'binId': 'BIN-004',
          'binLocation': 'BIN-004 · Cedar Residence',
          'materialType': 'plastic',
          'materialLabel': 'PET plastic',
          'itemCount': 2,
          'pointsAwarded': 10,
          'status': 'verified',
          'occurredAt': '2024-05-20T10:42:00+08:00',
          'verifiedAt': '2024-05-20T10:42:30+08:00',
        },
      ],
  scanConfig: const {'demoQrPayload': 'ecoloop://bin/BIN-004'},
  bins: [
    {
      'id': 'BIN-004',
      'locationName': 'Cedar Residence',
      'locationDetail': 'Ground Floor',
      'capacityPercent': capacityPercent,
      'acceptedMaterials': ['plastic', 'aluminium'],
      'isOnline': isOnline,
      'lastUpdatedAt': '2024-05-20T10:55:00+08:00',
    },
  ],
  scanInstructions: const [
    {
      'id': 'default',
      'scannerTitle': 'Scan a smart bin',
      'scannerDescription': 'Point your camera at the bin QR code to begin.',
      'binFoundTitle': 'Smart bin found',
      'readyTitle': 'Ready to recycle?',
      'readyDescription':
          'Insert your items, then press the red finish button.',
      'itemDetectedTitle': 'Items detected',
      'itemDetectedDescription': 'We are checking your recyclable items.',
      'processingTitle': 'Identifying your items',
      'processingDescription': 'This usually takes a few seconds.',
      'verifiedTitle': 'Deposit verified',
      'reviewTitle': 'Deposit sent for review',
      'rejectedTitle': 'Deposit not eligible',
      'pointsTimingNotice': 'Verified points are added after classification.',
    },
  ],
  classifications: [classification],
  sessions: const [],
  results: const [],
  materialRates: [
    {
      'materialType': 'plastic',
      'displayName': 'Plastic',
      'pointsPerItem': pointsPerItem,
      'eligible': true,
    },
    {
      'materialType': 'aluminium',
      'displayName': 'Aluminium',
      'pointsPerItem': 8,
      'eligible': true,
    },
  ],
);
