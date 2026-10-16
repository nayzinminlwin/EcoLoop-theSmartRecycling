import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/models/recycling_guide.dart';

final recyclingGuideProvider = StreamProvider<RecyclingGuide>((ref) async* {
  final repository = ref.watch(recyclingGuideRepositoryProvider);
  yield* repository.watchGuide();
});

final recyclingGuideControllerProvider =
    AsyncNotifierProvider<RecyclingGuideController, RecyclingGuide>(
      RecyclingGuideController.new,
    );

class RecyclingGuideController extends AsyncNotifier<RecyclingGuide> {
  @override
  Future<RecyclingGuide> build() =>
      ref.watch(recyclingGuideRepositoryProvider).getGuide();

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(recyclingGuideRepositoryProvider).getGuide(),
    );
  }
}
