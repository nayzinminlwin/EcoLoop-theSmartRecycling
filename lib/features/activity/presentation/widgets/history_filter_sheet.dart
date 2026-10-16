import 'package:eco_loop/core/presentation/app_copy.dart';
import 'package:eco_loop/core/presentation/app_formatters.dart';
import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
import 'package:eco_loop/features/activity/presentation/controllers/history_controller.dart';
import 'package:flutter/material.dart';

class HistoryFilterSheet extends StatefulWidget {
  const HistoryFilterSheet({
    required this.initial,
    required this.clock,
    super.key,
  });

  final HistoryFilterState initial;
  final AppClock clock;

  @override
  State<HistoryFilterSheet> createState() => _HistoryFilterSheetState();
}

class _HistoryFilterSheetState extends State<HistoryFilterSheet> {
  late HistoryFilterState _filter = widget.initial;

  void _setPreset(HistoryDatePreset preset) {
    setState(
      () => _filter = HistoryFilterState(
        datePreset: preset,
        status: _filter.status,
        customFrom: _filter.customFrom,
        customTo: _filter.customTo,
      ),
    );
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Filter history', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          Text('Date', style: Theme.of(context).textTheme.titleSmall),
          Wrap(
            spacing: 8,
            children: [
              for (final preset in HistoryDatePreset.values)
                ChoiceChip(
                  label: Text(_presetLabel(preset)),
                  selected: _filter.datePreset == preset,
                  onSelected: (_) => _setPreset(preset),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Text('Status', style: Theme.of(context).textTheme.titleSmall),
          Wrap(
            spacing: 8,
            children: [
              _statusChip(null, 'All'),
              _statusChip(DepositStatus.verified, 'Verified'),
              _statusChip(DepositStatus.review, 'Review'),
              _statusChip(DepositStatus.rejected, 'Rejected'),
            ],
          ),
          if (_filter.datePreset == HistoryDatePreset.custom) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _pickDate(isStart: true),
                    child: Text(
                      _filter.customFrom == null
                          ? 'Start date'
                          : AppFormatters.date(_filter.customFrom!),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _pickDate(isStart: false),
                    child: Text(
                      _filter.customTo == null
                          ? 'End date'
                          : AppFormatters.date(_filter.customTo!),
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 24),
          Row(
            children: [
              TextButton(
                onPressed: () =>
                    Navigator.of(context).pop(const HistoryFilterState()),
                child: const Text('Reset'),
              ),
              const Spacer(),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text(AppCopy.cancel),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(_filter),
                child: const Text('Apply'),
              ),
            ],
          ),
        ],
      ),
    ),
  );

  Widget _statusChip(DepositStatus? status, String label) => ChoiceChip(
    label: Text(label),
    selected: _filter.status == status,
    onSelected: (_) => setState(
      () => _filter = HistoryFilterState(
        datePreset: _filter.datePreset,
        status: status,
        customFrom: _filter.customFrom,
        customTo: _filter.customTo,
      ),
    ),
  );

  Future<void> _pickDate({required bool isStart}) async {
    final selected = await showDatePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
      initialDate: isStart
          ? (_filter.customFrom ?? _filter.customTo ?? widget.clock.now)
          : (_filter.customTo ?? _filter.customFrom ?? widget.clock.now),
    );
    if (selected == null || !mounted) return;
    final from = isStart ? selected : _filter.customFrom;
    final to = isStart ? _filter.customTo : selected;
    setState(
      () => _filter = HistoryFilterState(
        datePreset: HistoryDatePreset.custom,
        status: _filter.status,
        customFrom: from,
        customTo: to,
      ),
    );
  }

  String _presetLabel(HistoryDatePreset preset) => switch (preset) {
    HistoryDatePreset.all => 'All dates',
    HistoryDatePreset.today => 'Today',
    HistoryDatePreset.lastSevenDays => 'Last 7 days',
    HistoryDatePreset.thisMonth => 'This month',
    HistoryDatePreset.custom => 'Custom range',
  };
}
