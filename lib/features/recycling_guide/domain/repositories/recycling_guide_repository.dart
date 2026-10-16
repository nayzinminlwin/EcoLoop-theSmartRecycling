import '../models/recycling_guide.dart';

abstract interface class RecyclingGuideRepository {
  Future<RecyclingGuide> getGuide();

  Stream<RecyclingGuide> watchGuide();
}
