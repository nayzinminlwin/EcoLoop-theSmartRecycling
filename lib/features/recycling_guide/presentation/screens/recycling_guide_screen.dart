import 'package:eco_loop/core/presentation/app_copy.dart';
import 'package:eco_loop/shared/widgets/app_error_view.dart';
import 'package:eco_loop/shared/widgets/app_icon.dart';
import 'package:eco_loop/shared/widgets/app_loading_view.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/models/recycling_guide.dart';
import '../controllers/recycling_guide_controller.dart';
import '../widgets/material_guide_card.dart';
import '../widgets/material_rates_table.dart';
import '../widgets/recycling_steps_list.dart';

class RecyclingGuideScreen extends ConsumerWidget {
  const RecyclingGuideScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final guide = ref.watch(recyclingGuideProvider);
    return AppPage(
      child: guide.when(
        loading: () => const AppLoadingView(message: 'Loading recycling guide'),
        error: (_, _) => AppErrorView(
          message: AppCopy.loadGuideFailed,
          onRetry: () => ref.invalidate(recyclingGuideProvider),
        ),
        data: (data) => _GuideContent(data: data),
      ),
    );
  }
}

class _GuideContent extends StatelessWidget {
  const _GuideContent({required this.data});

  final RecyclingGuide data;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text('LEARN', style: Theme.of(context).textTheme.labelMedium),
      const SizedBox(height: 4),
      Text('How to recycle', style: Theme.of(context).textTheme.headlineMedium),
      const SizedBox(height: 16),
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: const Color(0xFFE4F1E6),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          children: [
            const AppIcon('recycle', size: 46, color: Color(0xFF176B45)),
            const SizedBox(height: 12),
            Text(
              data.heroTitle,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 6),
            Text(data.heroDescription, textAlign: TextAlign.center),
          ],
        ),
      ),
      const SizedBox(height: 24),
      _sectionTitle(context, 'What can I recycle?'),
      const SizedBox(height: 12),
      LayoutBuilder(
        builder: (context, constraints) {
          final columns = constraints.maxWidth >= 380 ? 2 : 1;
          return GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: data.materials.length,
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: columns,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: columns == 2 ? 1.45 : 3.2,
            ),
            itemBuilder: (context, index) =>
                MaterialGuideCard(material: data.materials[index]),
          );
        },
      ),
      if (data.toDo.isNotEmpty || data.toAvoid.isNotEmpty) ...[
        const SizedBox(height: 24),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _bulletSection(context, 'To-do', data.toDo, 'check'),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _bulletSection(context, 'To-avoid', data.toAvoid, 'close'),
            ),
          ],
        ),
      ],
      if (data.steps.isNotEmpty) ...[
        const SizedBox(height: 24),
        _sectionTitle(context, 'Using the smart bin'),
        RecyclingStepsList(steps: data.steps),
      ],
      if (data.rates.isNotEmpty) ...[
        const SizedBox(height: 24),
        _sectionTitle(context, 'EcoPoints per item'),
        const SizedBox(height: 12),
        MaterialRatesTable(rates: data.rates),
      ],
      const SizedBox(height: 12),
      Text(data.pointsDisclaimer, style: Theme.of(context).textTheme.bodySmall),
      const SizedBox(height: 24),
    ],
  );

  Widget _sectionTitle(BuildContext context, String title) =>
      Text(title, style: Theme.of(context).textTheme.titleLarge);

  Widget _bulletSection(
    BuildContext context,
    String title,
    List<String> items,
    String icon,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(
        children: [
          AppIcon(icon, size: 18, color: Theme.of(context).colorScheme.primary),
          const SizedBox(width: 6),
          Flexible(
            child: Text(title, style: Theme.of(context).textTheme.titleSmall),
          ),
        ],
      ),
      ...items.map(
        (item) =>
            Padding(padding: const EdgeInsets.only(top: 8), child: Text(item)),
      ),
    ],
  );
}
