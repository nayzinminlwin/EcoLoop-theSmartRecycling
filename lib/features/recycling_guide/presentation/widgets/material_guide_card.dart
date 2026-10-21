import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/shared/widgets/app_card.dart';
import 'package:eco_loop/shared/widgets/app_icon.dart';
import 'package:flutter/material.dart';

import '../../domain/models/recycling_material.dart';

class MaterialGuideCard extends StatelessWidget {
  const MaterialGuideCard({required this.material, super.key});

  final RecyclingMaterial material;

  static const _allowedIcons = {'recycle', 'book'};

  String? get _imageAsset {
    final key = material.canonicalClass ?? material.id;
    return switch (key) {
      'plastic' ||
      'plastic_bottle' ||
      'plastic-bottles' => 'assets/icons/plastic-bottle.png',
      'glass' ||
      'glass_bottle' ||
      'glass-bottles' => 'assets/icons/milk-bottle.png',
      'aluminium' ||
      'aluminium_can' ||
      'aluminium-cans' => 'assets/icons/open-can.png',
      'paper' ||
      'paper_item' ||
      'paper_bag' ||
      'paper-items' ||
      'paper-bags' => 'assets/icons/paper-recycle.png',
      _ => switch (material.type.wireValue) {
        'plastic' => 'assets/icons/plastic-bottle.png',
        'glass' => 'assets/icons/milk-bottle.png',
        'aluminium' => 'assets/icons/open-can.png',
        'paper' => 'assets/icons/paper-recycle.png',
        _ => null,
      },
    };
  }

  @override
  Widget build(BuildContext context) {
    final imageAsset = _imageAsset;
    final icon = _allowedIcons.contains(material.iconKey)
        ? material.iconKey
        : 'recycle';
    return AppCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 52,
            height: 52,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.mint,
              borderRadius: BorderRadius.circular(12),
            ),
            child: imageAsset != null
                ? Image.asset(
                    imageAsset,
                    width: 32,
                    height: 32,
                    fit: BoxFit.contain,
                  )
                : AppIcon(icon, color: AppColors.primary, size: 28),
          ),
          const SizedBox(height: 12),
          Text(
            material.title,
            style: Theme.of(context).textTheme.titleSmall,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 6),
          Text(
            material.preparationTip,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
