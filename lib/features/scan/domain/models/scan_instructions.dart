import 'package:eco_loop/core/data/json_readers.dart';

class ScanInstructions {
  const ScanInstructions({
    required this.id,
    required this.scannerTitle,
    required this.scannerDescription,
    required this.binFoundTitle,
    required this.readyTitle,
    required this.readyDescription,
    required this.itemDetectedTitle,
    required this.itemDetectedDescription,
    required this.processingTitle,
    required this.processingDescription,
    required this.verifiedTitle,
    required this.reviewTitle,
    required this.rejectedTitle,
    required this.pointsTimingNotice,
  });

  final String id;
  final String scannerTitle;
  final String scannerDescription;
  final String binFoundTitle;
  final String readyTitle;
  final String readyDescription;
  final String itemDetectedTitle;
  final String itemDetectedDescription;
  final String processingTitle;
  final String processingDescription;
  final String verifiedTitle;
  final String reviewTitle;
  final String rejectedTitle;
  final String pointsTimingNotice;

  factory ScanInstructions.fromJson(JsonMap json) => ScanInstructions(
    id: JsonReaders.string(json, 'id'),
    scannerTitle: JsonReaders.string(json, 'scannerTitle'),
    scannerDescription: JsonReaders.string(json, 'scannerDescription'),
    binFoundTitle: JsonReaders.string(json, 'binFoundTitle'),
    readyTitle: JsonReaders.string(json, 'readyTitle'),
    readyDescription: JsonReaders.string(json, 'readyDescription'),
    itemDetectedTitle: JsonReaders.string(json, 'itemDetectedTitle'),
    itemDetectedDescription: JsonReaders.string(
      json,
      'itemDetectedDescription',
    ),
    processingTitle: JsonReaders.string(json, 'processingTitle'),
    processingDescription: JsonReaders.string(json, 'processingDescription'),
    verifiedTitle: JsonReaders.string(json, 'verifiedTitle'),
    reviewTitle: JsonReaders.string(json, 'reviewTitle'),
    rejectedTitle: JsonReaders.string(json, 'rejectedTitle'),
    pointsTimingNotice: JsonReaders.string(json, 'pointsTimingNotice'),
  );

  JsonMap toJson() => {
    'id': id,
    'scannerTitle': scannerTitle,
    'scannerDescription': scannerDescription,
    'binFoundTitle': binFoundTitle,
    'readyTitle': readyTitle,
    'readyDescription': readyDescription,
    'itemDetectedTitle': itemDetectedTitle,
    'itemDetectedDescription': itemDetectedDescription,
    'processingTitle': processingTitle,
    'processingDescription': processingDescription,
    'verifiedTitle': verifiedTitle,
    'reviewTitle': reviewTitle,
    'rejectedTitle': rejectedTitle,
    'pointsTimingNotice': pointsTimingNotice,
  };
}
