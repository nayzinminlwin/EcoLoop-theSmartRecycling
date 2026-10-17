import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/shared/widgets/app_card.dart';
import 'package:eco_loop/shared/widgets/app_icon.dart';
import 'package:flutter/material.dart';

import '../../domain/models/recycling_material.dart';

class MaterialGuideCard extends StatelessWidget {
  const MaterialGuideCard({required this.material, super.key});

  final RecyclingMaterial material;

  static const _allowedIcons = {'recycle', 'book'};

  @override
  Widget build(BuildContext context) {
    final icon = _allowedIcons.contains(material.iconKey)
        ? material.iconKey
        : 'recycle';
    return AppCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: AppColors.mint,
              borderRadius: BorderRadius.circular(10),
            ),
            child: AppIcon(icon, color: AppColors.primary, size: 22),
          ),
          const SizedBox(height: 10),
          Text(material.title, style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 3),
          Text(
            material.preparationTip,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
