import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/core/presentation/app_copy.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_radii.dart';
import 'package:eco_loop/core/theme/app_spacing.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_filter.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
import 'package:eco_loop/features/activity/presentation/controllers/history_controller.dart';
import 'package:eco_loop/features/activity/presentation/widgets/deposit_activity_tile.dart';
import 'package:eco_loop/features/activity/presentation/widgets/history_filter_sheet.dart';
import 'package:eco_loop/shared/widgets/app_error_view.dart';
import 'package:eco_loop/shared/widgets/app_icon.dart';
import 'package:eco_loop/shared/widgets/app_loading_view.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';
import 'package:eco_loop/shared/widgets/app_page_header.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

class HistoryScreen extends ConsumerStatefulWidget {
  const HistoryScreen({super.key, this.routeFilter});

  final DepositFilter? routeFilter;

  @override
  ConsumerState<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends ConsumerState<HistoryScreen> {
  DepositFilter? _syncedFilter;

  @override
  void initState() {
    super.initState();
    _scheduleRouteFilterSync();
  }

  @override
  void didUpdateWidget(HistoryScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.routeFilter != oldWidget.routeFilter) _scheduleRouteFilterSync();
  }

  void _scheduleRouteFilterSync() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _syncRouteFilter();
    });
  }

  /// Applies query-derived filters from a direct link; equal filters are
  /// ignored so returning to the same URI does not retrigger work.
  void _syncRouteFilter() {
    final routeFilter = widget.routeFilter;
    if (routeFilter == null) return;
    final synced = _syncedFilter;
    if (synced != null &&
        synced.from == routeFilter.from &&
        synced.toExclusive == routeFilter.toExclusive &&
        synced.status == routeFilter.status) {
      return;
    }
    _syncedFilter = routeFilter;
    final clock = ref.read(appClockProvider);
    ref
        .read(historyFilterProvider.notifier)
        .setFilter(
          HistoryFilterState(
            datePreset:
                routeFilter.from == null && routeFilter.toExclusive == null
                ? HistoryDatePreset.all
                : HistoryDatePreset.custom,
            status: routeFilter.status,
            customFrom: routeFilter.from == null
                ? null
                : clock.calendarDate(routeFilter.from!),
            customTo: routeFilter.toExclusive == null
                ? null
                : clock.calendarDate(
                    routeFilter.toExclusive!.subtract(const Duration(days: 1)),
                  ),
          ),
        );
  }

  @override
  Widget build(BuildContext context) {
    final value = ref.watch(historyControllerProvider);
    final filterState = ref.watch(historyFilterProvider);
    return AppPage(
      header: const AppPageHeader(
        title: 'Recycling history',
        eyebrow: 'YOUR IMPACT',
      ),
      child: value.when(
        loading: () => value.hasValue
            ? _content(context, value.requireValue, filterState)
            : const SizedBox(
                height: 500,
                child: AppLoadingView(message: 'Loading activity'),
              ),
        error: (_, _) => AppErrorView(
          message: AppCopy.loadHistoryFailed,
          onRetry: () => ref.read(historyControllerProvider.notifier).refresh(),
        ),
        data: (data) => _content(context, data, filterState),
      ),
    );
  }

  Widget _content(
    BuildContext context,
    HistoryViewData data,
    HistoryFilterState filterState,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (data.refreshFailed) ...[
        _refreshFailureBanner(context),
        const SizedBox(height: AppSpacing.section),
      ],
      Row(
        children: [
          Expanded(
            child: _FilterControl(
              label: _dateLabel(filterState),
              onPressed: () => _openFilters(dateSection: true),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _FilterControl(
              label: _statusLabel(filterState),
              onPressed: () => _openFilters(dateSection: false),
            ),
          ),
        ],
      ),
      const SizedBox(height: 12),
      if (data.items.isEmpty)
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 24),
          child: Text('No recycling activity matches these filters.'),
        )
      else
        _groupedList(data.items),
      const SizedBox(height: 12),
      _demoNote(context),
    ],
  );

  Widget _groupedList(List<DepositTransaction> items) => DecoratedBox(
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadii.card),
      border: Border.all(color: AppColors.border),
    ),
    child: ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.card),
      child: Column(
        children: [
          for (var index = 0; index < items.length; index++) ...[
            if (index > 0) Container(height: 1, color: AppColors.border),
            DepositActivityTile(
              deposit: items[index],
              clock: ref.read(appClockProvider),
              showWeight: true,
            ),
          ],
        ],
      ),
    ),
  );

  Widget _refreshFailureBanner(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: AppColors.grayBackground,
      borderRadius: BorderRadius.circular(AppRadii.button),
    ),
    child: Row(
      children: [
        const AppIcon('alert', size: 18, color: AppColors.muted),
        const SizedBox(width: 9),
        Expanded(
          child: Text(
            'History could not be refreshed. Showing the last loaded activity.',
            style: AppTypography.activityMetadata.copyWith(
              fontSize: 11,
              color: AppColors.muted,
            ),
          ),
        ),
        TextButton(
          onPressed: () =>
              ref.read(historyControllerProvider.notifier).refresh(),
          child: const Text(AppCopy.retry),
        ),
      ],
    ),
  );

  Widget _demoNote(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: AppColors.grayBackground,
      borderRadius: BorderRadius.circular(AppRadii.button),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const AppIcon('shield', size: 18, color: AppColors.muted),
        const SizedBox(width: 9),
        Expanded(
          child: Text(
            'All figures are illustrative prototype data. Pending deposits do '
            'not receive points until verified.',
            style: AppTypography.activityMetadata.copyWith(
              fontSize: 11,
              height: 1.45,
              color: AppColors.muted,
            ),
          ),
        ),
      ],
    ),
  );

  String _dateLabel(HistoryFilterState filter) {
    return switch (filter.datePreset) {
      HistoryDatePreset.all => 'All dates',
      HistoryDatePreset.today => 'Today',
      HistoryDatePreset.lastSevenDays => 'Last 7 days',
      HistoryDatePreset.thisMonth => 'This month',
      HistoryDatePreset.custom =>
        filter.customFrom == null && filter.customTo == null
            ? 'All dates'
            : 'Custom range',
    };
  }

  String _statusLabel(HistoryFilterState filter) {
    return switch (filter.status) {
      null => 'All statuses',
      DepositStatus.verified => 'Verified',
      DepositStatus.review => 'Review',
      DepositStatus.rejected => 'Rejected',
      DepositStatus.unknown => 'All statuses',
    };
  }

  Future<void> _openFilters({required bool dateSection}) async {
    final selected = await showModalBottomSheet<HistoryFilterState>(
      context: context,
      isScrollControlled: true,
      builder: (_) => HistoryFilterSheet(
        initial: ref.read(historyFilterProvider),
        clock: ref.read(appClockProvider),
        initialSection: dateSection
            ? FilterSheetSection.date
            : FilterSheetSection.status,
      ),
    );
    if (selected == null || !mounted) return;
    await ref.read(historyControllerProvider.notifier).apply(selected);
    if (mounted) _updateUri(selected);
  }

  /// Reflects the applied filter in the URI so refresh and sharing keep it.
  /// Skips silently when no router is above this context (isolated hosting).
  void _updateUri(HistoryFilterState selected) {
    try {
      final clock = ref.read(appClockProvider);
      final filter = selected.toFilter(clock.now);
      final params = <String, String>{
        if (selected.status != null) 'status': selected.status!.wireValue,
        if (filter.from != null)
          'from': DateFormat('yyyy-MM-dd')
              .format(clock.toDisplay(filter.from!)),
        if (filter.toExclusive != null)
          'to': DateFormat('yyyy-MM-dd').format(
            clock.toDisplay(
              filter.toExclusive!.subtract(const Duration(days: 1)),
            ),
          ),
      };
      final target = params.isEmpty
          ? AppRoutes.history
          : Uri(path: AppRoutes.history, queryParameters: params).toString();
      if (GoRouterState.of(context).uri.toString() == target) return;
      context.go(target);
    } on GoError {
      // No router in the current context; the filter still applies in state.
    }
  }
}

/// Dropdown-style filter control matching the source filter row.
class _FilterControl extends StatelessWidget {
  const _FilterControl({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 48,
    child: Material(
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: const BorderSide(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onPressed,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.activityMetadata.copyWith(
                      fontSize: 11,
                      color: AppColors.text,
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                RotatedBox(
                  quarterTurns: 1,
                  child: AppIcon('arrow', size: 12, color: AppColors.muted),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
