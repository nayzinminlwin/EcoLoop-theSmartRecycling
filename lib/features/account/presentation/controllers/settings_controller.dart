import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/providers/app_providers.dart';
import '../../domain/models/resident_profile.dart';

final settingsProfileProvider = StreamProvider.autoDispose<ResidentProfile?>(
  (ref) => ref.watch(accountRepositoryProvider).watchProfile(),
);
