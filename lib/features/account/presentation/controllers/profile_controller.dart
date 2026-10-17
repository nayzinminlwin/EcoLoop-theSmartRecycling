import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/providers/app_providers.dart';
import '../../domain/models/profile_update_request.dart';
import '../../domain/models/resident_profile.dart';

final profileControllerProvider =
    AsyncNotifierProvider<ProfileController, ResidentProfile>(
      ProfileController.new,
    );

class ProfileController extends AsyncNotifier<ResidentProfile> {
  @override
  Future<ResidentProfile> build() =>
      ref.watch(accountRepositoryProvider).getProfile();

  Future<void> save(ProfileUpdateRequest request) async {
    final previous = state;
    state = AsyncLoading<ResidentProfile>().copyWithPrevious(previous);
    final next = await AsyncValue.guard(
      () => ref.read(accountRepositoryProvider).updateProfile(request),
    );
    state = next.hasError
        ? AsyncError<ResidentProfile>(
            next.error!,
            next.stackTrace ?? StackTrace.current,
          ).copyWithPrevious(previous)
        : next;
  }
}
