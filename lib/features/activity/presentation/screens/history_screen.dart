import 'package:eco_loop/core/presentation/app_copy.dart';
import 'package:eco_loop/shared/widgets/app_error_view.dart';
import 'package:eco_loop/shared/widgets/app_loading_view.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';
import 'package:eco_loop/shared/widgets/app_page_header.dart';
import 'package:eco_loop/features/activity/presentation/controllers/history_controller.dart';
import 'package:eco_loop/features/activity/presentation/widgets/deposit_activity_tile.dart';
import 'package:eco_loop/features/activity/presentation/widgets/history_filter_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(historyControllerProvider);
    return AppPage(
      header: AppPageHeader(
        title: 'Recycling history',
        onBack: () => context.go('/home'),
        trailing: IconButton(
          tooltip: 'Filter history',
          onPressed: () => _openFilters(context, ref),
          icon: const Icon(Icons.tune),
        ),
      ),
      child: state.when(
        loading: () => const SizedBox(
          height: 500,
          child: AppLoadingView(message: 'Loading activity'),
        ),
        error: (_, _) => AppErrorView(
          message: AppCopy.loadHistoryFailed,
          onRetry: () => ref.read(historyControllerProvider.notifier).refresh(),
        ),
        data: (items) => RefreshIndicator(
          onRefresh: () =>
              ref.read(historyControllerProvider.notifier).refresh(),
          child: items.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  shrinkWrap: true,
                  children: const [
                    SizedBox(height: 180),
                    Center(
                      child: Text(
                        'No recycling activity matches these filters.',
                      ),
                    ),
                  ],
                )
              : ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(),
                  shrinkWrap: true,
                  itemCount: items.length,
                  itemBuilder: (_, index) =>
                      DepositActivityTile(deposit: items[index]),
                ),
        ),
      ),
    );
  }

  Future<void> _openFilters(BuildContext context, WidgetRef ref) async {
    final selected = await showModalBottomSheet<HistoryFilterState>(
      context: context,
      isScrollControlled: true,
      builder: (_) =>
          HistoryFilterSheet(initial: ref.read(historyFilterProvider)),
    );
    if (selected != null && context.mounted) {
      await ref.read(historyControllerProvider.notifier).apply(selected);
    }
  }
}
